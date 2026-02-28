import { FastifyInstance } from 'fastify';
import { logger } from '../utils/logger';
import { SocketManager } from '../services/socket/manager';
import { InterviewOrchestrator } from '../services/interview/orchestrator';
import { resolveInterviewStartReadiness } from '../services/interview/modelConfig';
import { prisma } from '../utils/prisma';
import { verifyToken } from '../utils/jwt';
import {
    buildPublicIdentity,
    consumePublicQuota,
    readIntEnv,
    type PublicQuotaRule,
} from '../services/security/publicRateLimiter';

const WS_CONNECT_RULE: PublicQuotaRule = {
    id: 'public_interview_ws_connect',
    max: readIntEnv('PUBLIC_WS_CONNECT_RPM', 20, 3, 300),
    windowMs: 60_000,
};

const WS_AUDIO_RULE: PublicQuotaRule = {
    id: 'public_interview_ws_audio',
    max: readIntEnv('PUBLIC_WS_AUDIO_RPM', 360, 60, 2000),
    windowMs: 60_000,
};

const WS_CONTROL_RULE: PublicQuotaRule = {
    id: 'public_interview_ws_control',
    max: readIntEnv('PUBLIC_WS_CONTROL_RPM', 240, 20, 2000),
    windowMs: 60_000,
};

const WS_AUDIO_MAX_BASE64_CHARS = readIntEnv('PUBLIC_WS_AUDIO_MAX_BASE64_CHARS', 600_000, 8_000, 2_000_000);

export async function websocketRoutes(app: FastifyInstance) {
    const socketManager = SocketManager.getInstance();
    const allowedMonitorRoles = new Set(['owner', 'admin', 'hr_manager', 'interviewer']);

    app.get('/api/ws/interview/stream', { websocket: true }, async (connection, req) => {
        // fastify-websocket v11 handler receives `WebSocket`,
        // while some legacy code paths pass `{ socket: WebSocket }`.
        const socket = ((connection as any)?.socket ?? connection) as any;
        const query = req.query as { token?: string, interviewId?: string };

        let role: 'candidate' | 'monitor' = 'candidate';
        let interviewId = '';
        let userId: string | undefined = undefined;
        let companyId: string | undefined = undefined;
        let candidateRateIdentity: string | null = null;

        const rawToken = typeof query.token === 'string' ? query.token.trim() : '';
        if (rawToken.length > 0) {
            const connectIdentity = buildPublicIdentity({
                request: req,
                token: rawToken,
                suffix: 'ws-connect',
            });
            const connectQuota = consumePublicQuota({
                identity: connectIdentity,
                rule: WS_CONNECT_RULE,
            });
            if (!connectQuota.allowed) {
                socket.send(JSON.stringify({
                    type: 'system_blocked',
                    error: 'Too many websocket connections. Please retry shortly.',
                    code: 'RATE_LIMITED',
                    retryAfterSec: connectQuota.retryAfterSec,
                }));
                socket.close(1008, 'Rate limited');
                return;
            }
        }

        // 1. Authentication
        if (query.token) {
            // Check if it is a Candidate Token (Interview.token)
            const interview = await prisma.interview.findUnique({
                where: { token: query.token },
                select: { id: true, status: true, job: { select: { companyId: true } } }
            });

            if (interview) {
                // It is a candidate
                role = 'candidate';
                interviewId = interview.id;
                companyId = interview.job.companyId;
                candidateRateIdentity = buildPublicIdentity({
                    request: req,
                    token: query.token,
                    suffix: 'ws-candidate',
                });
                if (interview.status === 'completed' || interview.status === 'cancelled') {
                    socket.close(1008, 'Interview finished');
                    return;
                }
                if (interview.status !== 'active') {
                    socket.send(JSON.stringify({
                        type: 'system_blocked',
                        error: 'Interview has not started. Please start from waiting room first.',
                        code: 'INTERVIEW_NOT_STARTED',
                    }));
                    socket.close(1008, 'Interview not started');
                    return;
                }
                const readiness = await resolveInterviewStartReadiness(interview.job.companyId);
                if (!readiness.ready) {
                    socket.send(JSON.stringify({
                        type: 'system_blocked',
                        error: readiness.reason || 'AI interview service is not configured.',
                        code: 'AI_KEY_REQUIRED',
                    }));
                    socket.close(1008, 'AI key required');
                    return;
                }
            } else {
                // Try as JWT (Monitor)
                try {
                    const decoded = verifyToken(query.token);
                    if (!decoded?.userId) {
                        socket.close(1008, 'Invalid token');
                        return;
                    }
                    userId = decoded.userId;
                    role = 'monitor';
                    // For monitor, interviewId must be provided in query
                    if (!query.interviewId) {
                        socket.close(1008, 'Interview ID required for monitor');
                        return;
                    }
                    interviewId = query.interviewId;

                    // Ensure monitor belongs to same company as interview
                    const monitorUser = await prisma.user.findUnique({
                        where: { id: userId },
                        select: { companyId: true, role: true },
                    });
                    const monitorInterview = await prisma.interview.findUnique({
                        where: { id: interviewId },
                        select: { job: { select: { companyId: true } } },
                    });
                    if (
                        !monitorUser ||
                        !monitorInterview ||
                        monitorUser.companyId !== monitorInterview.job.companyId ||
                        !allowedMonitorRoles.has(monitorUser.role)
                    ) {
                        socket.close(1008, 'Unauthorized interview monitor access');
                        return;
                    }
                    companyId = monitorUser.companyId;
                } catch (e) {
                    socket.close(1008, 'Invalid token');
                    return;
                }
            }
        } else {
            socket.close(1008, 'Token required');
            return;
        }

        // 2. Join Room
        const conn = {
            socket,
            role,
            interviewId,
            userId,
            companyId,
        };
        socketManager.addConnection(interviewId, conn);
        socket.on('close', () => {
            setTimeout(() => {
                if (socketManager.getConnectionCount(interviewId) === 0) {
                    InterviewOrchestrator.releaseSession(interviewId);
                }
            }, 0);
        });

        // 3. Get Orchestrator
        // Only start orchestrator if candidate connects (or always?)
        // Better always get session to be ready
        const orchestrator = InterviewOrchestrator.getSession(interviewId);
        if (role === 'candidate') {
            const voiceMode = await orchestrator.getCandidateVoiceMode().catch(() => ({
                stt: 'browser' as const,
                tts: 'browser' as const,
            }));
            socket.send(JSON.stringify({
                type: 'interview_turn_state',
                state: orchestrator.getTurnState(),
            }));
            socket.send(JSON.stringify({
                type: 'voice_mode',
                ...voiceMode,
            }));
        }
        if (role === 'candidate') {
            void orchestrator.beginInterviewGreeting().catch((error: unknown) => {
                logger.error({ err: error }, 'Failed to deliver XiaoFan opening message');
            });
        }

        // 4. Handle Messages
        socket.on('message', async (message: any) => {
            try {
                const data = JSON.parse(message.toString());

                if (role === 'candidate') {
                    if (data.type === 'audio') {
                        if (!candidateRateIdentity) {
                            socket.close(1008, 'Missing candidate rate context');
                            return;
                        }
                        const base64Data = typeof data.data === 'string' ? data.data : '';
                        if (!base64Data) {
                            return;
                        }
                        if (base64Data.length > WS_AUDIO_MAX_BASE64_CHARS) {
                            socket.send(JSON.stringify({
                                type: 'system_blocked',
                                error: 'Audio chunk is too large.',
                                code: 'PAYLOAD_TOO_LARGE',
                            }));
                            socket.close(1008, 'Payload too large');
                            return;
                        }
                        const quota = consumePublicQuota({
                            identity: `${candidateRateIdentity}::audio`,
                            rule: WS_AUDIO_RULE,
                        });
                        if (!quota.allowed) {
                            socket.send(JSON.stringify({
                                type: 'system_blocked',
                                error: 'Audio upload rate is too high. Please retry shortly.',
                                code: 'RATE_LIMITED',
                                retryAfterSec: quota.retryAfterSec,
                            }));
                            socket.close(1008, 'Rate limited');
                            return;
                        }
                        const mimeType = typeof data.mimeType === 'string' ? data.mimeType : undefined;
                        orchestrator.handleAudio(base64Data, mimeType); // data.data is base64
                    } else if (data.type === 'vad_event') {
                        if (!candidateRateIdentity) {
                            socket.close(1008, 'Missing candidate rate context');
                            return;
                        }
                        const quota = consumePublicQuota({
                            identity: `${candidateRateIdentity}::control`,
                            rule: WS_CONTROL_RULE,
                        });
                        if (!quota.allowed) {
                            socket.send(JSON.stringify({
                                type: 'system_blocked',
                                error: 'Input event rate is too high. Please retry shortly.',
                                code: 'RATE_LIMITED',
                                retryAfterSec: quota.retryAfterSec,
                            }));
                            socket.close(1008, 'Rate limited');
                            return;
                        }
                        await orchestrator.handleVad(data.status);
                    } else if (data.type === 'user_text') {
                        if (!candidateRateIdentity) {
                            socket.close(1008, 'Missing candidate rate context');
                            return;
                        }
                        const quota = consumePublicQuota({
                            identity: `${candidateRateIdentity}::control`,
                            rule: WS_CONTROL_RULE,
                        });
                        if (!quota.allowed) {
                            socket.send(JSON.stringify({
                                type: 'system_blocked',
                                error: 'Input event rate is too high. Please retry shortly.',
                                code: 'RATE_LIMITED',
                                retryAfterSec: quota.retryAfterSec,
                            }));
                            socket.close(1008, 'Rate limited');
                            return;
                        }
                        const text = typeof data.text === 'string' ? data.text.slice(0, 6000) : '';
                        if (text.trim()) {
                            await orchestrator.handleUserText(text);
                        }
                    }
                } else if (role === 'monitor') {
                    if (data.type === 'human_intervention') {
                        // orchestrator.instruct(data.text);
                    } else if (data.type === 'room_state_request') {
                        const state = socketManager.getRoomState(interviewId);
                        if (state) {
                            socket.send(JSON.stringify({
                                type: 'room_state',
                                state,
                            }));
                        }
                    }
                }
            } catch (e) {
                logger.error({ err: e }, 'WS Message error');
            }
        });

    });
}
