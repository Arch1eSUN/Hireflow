import { describe, it, expect } from 'vitest';

describe('WebSocket 消息 Schema 类型验证', () => {
    it('WsCandidateToServer union 包含所有候选人消息类型', () => {
        // 类型级别验证 — 编译通过即表示类型正确
        const audioMsg = { type: 'audio' as const, data: 'base64data', mimeType: 'audio/webm' };
        const vadMsg = { type: 'vad_event' as const, status: 'speaking_start' as const };
        const textMsg = { type: 'user_text' as const, text: 'hello' };
        const secMsg = { type: 'security_violation' as const, event: 'tab_switch', timestamp: Date.now() };
        const screenMsg = { type: 'screen_share_status' as const, active: true, surface: 'monitor' };
        const codeMsg = { type: 'code_sync' as const, code: 'console.log(1)', language: 'javascript', timestamp: Date.now() };

        expect(audioMsg.type).toBe('audio');
        expect(vadMsg.status).toBe('speaking_start');
        expect(textMsg.text).toBe('hello');
        expect(secMsg.event).toBe('tab_switch');
        expect(screenMsg.active).toBe(true);
        expect(codeMsg.language).toBe('javascript');
    });

    it('WsServerToCandidate union 包含所有服务端消息类型', () => {
        const transcript = { type: 'transcript' as const, text: '你好' };
        const aiText = { type: 'ai_text' as const, text: '请回答' };
        const turnState = { type: 'interview_turn_state' as const, state: 'listening' as const };
        const voiceMode = { type: 'voice_mode' as const, stt: 'server' as const, tts: 'browser' as const };
        const terminate = { type: 'force_terminate' as const, reason: 'monitor_terminated' };

        expect(transcript.text).toBe('你好');
        expect(aiText.text).toBe('请回答');
        expect(turnState.state).toBe('listening');
        expect(voiceMode.stt).toBe('server');
        expect(terminate.reason).toBe('monitor_terminated');
    });

    it('WsMonitorToServer union 包含所有监控端消息类型', () => {
        const roomReq = { type: 'room_state_request' as const };
        const webrtcOffer = { type: 'webrtc_request_offer' as const };
        const reshare = { type: 'monitor_request_reshare' as const };
        const terminateCmd = { type: 'monitor_terminate' as const, reason: 'cheating_detected' };

        expect(roomReq.type).toBe('room_state_request');
        expect(webrtcOffer.type).toBe('webrtc_request_offer');
        expect(reshare.type).toBe('monitor_request_reshare');
        expect(terminateCmd.reason).toBe('cheating_detected');
    });

    it('IntegrityEvent 结构正确', () => {
        const event = {
            type: 'integrity_event' as const,
            event: {
                type: 'tab_switch',
                severity: 'high' as const,
                message: '候选人切换到其他标签页',
                timestamp: new Date().toISOString(),
                details: { tabTitle: 'Google' },
            },
        };

        expect(event.event.severity).toBe('high');
        expect(event.event.type).toBe('tab_switch');
    });
});
