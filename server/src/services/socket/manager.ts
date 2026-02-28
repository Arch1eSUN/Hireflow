import { WebSocket } from 'ws';

interface SocketConnection {
    socket: WebSocket;
    userId?: string;     // For monitor (HR) users
    companyId?: string;
    interviewId: string; // The session ID
    role: 'candidate' | 'monitor';
}

export type RoomSurface = 'monitor' | 'window' | 'browser' | 'application' | 'unknown';

export interface RoomState {
    interviewId: string;
    participantCount: number;
    candidateCount: number;
    monitorCount: number;
    candidateOnline: boolean;
    monitorOnline: boolean;
    screenShareActive: boolean;
    screenSurface: RoomSurface;
    screenMuted: boolean;
    lastScreenShareAt: string | null;
    updatedAt: string;
}

interface ScreenShareUpdate {
    active: boolean;
    surface?: RoomSurface;
    muted?: boolean;
    timestamp?: number;
}

function createEmptyRoomState(interviewId: string): RoomState {
    return {
        interviewId,
        participantCount: 0,
        candidateCount: 0,
        monitorCount: 0,
        candidateOnline: false,
        monitorOnline: false,
        screenShareActive: false,
        screenSurface: 'unknown',
        screenMuted: false,
        lastScreenShareAt: null,
        updatedAt: new Date().toISOString(),
    };
}

export class SocketManager {
    private static instance: SocketManager;
    // Map<interviewId, Set<SocketConnection>>
    private rooms: Map<string, Set<SocketConnection>> = new Map();
    private roomStates: Map<string, RoomState> = new Map();

    private constructor() { }

    public static getInstance(): SocketManager {
        if (!SocketManager.instance) {
            SocketManager.instance = new SocketManager();
        }
        return SocketManager.instance;
    }

    private refreshRoomPresence(interviewId: string): RoomState | null {
        const room = this.rooms.get(interviewId);
        if (!room || room.size === 0) {
            this.roomStates.delete(interviewId);
            return null;
        }

        let candidateCount = 0;
        let monitorCount = 0;

        room.forEach((connection) => {
            if (connection.role === 'candidate') {
                candidateCount += 1;
                return;
            }
            monitorCount += 1;
        });

        const previous = this.roomStates.get(interviewId) || createEmptyRoomState(interviewId);
        const shouldResetScreenShare = candidateCount === 0;
        const nextState: RoomState = {
            ...previous,
            interviewId,
            participantCount: room.size,
            candidateCount,
            monitorCount,
            candidateOnline: candidateCount > 0,
            monitorOnline: monitorCount > 0,
            screenShareActive: shouldResetScreenShare ? false : previous.screenShareActive,
            screenSurface: shouldResetScreenShare ? 'unknown' : previous.screenSurface,
            screenMuted: shouldResetScreenShare ? false : previous.screenMuted,
            updatedAt: new Date().toISOString(),
        };
        this.roomStates.set(interviewId, nextState);
        return nextState;
    }

    private emitRoomState(interviewId: string, state?: RoomState) {
        const payloadState = state || this.refreshRoomPresence(interviewId);
        if (!payloadState) return;
        this.broadcast(interviewId, {
            type: 'room_state',
            state: payloadState,
        });
    }

    public addConnection(interviewId: string, connection: SocketConnection) {
        if (!this.rooms.has(interviewId)) {
            this.rooms.set(interviewId, new Set());
        }
        this.rooms.get(interviewId)?.add(connection);
        this.emitRoomState(interviewId);

        connection.socket.on('close', () => {
            this.removeConnection(interviewId, connection);
        });
    }

    public removeConnection(interviewId: string, connection: SocketConnection) {
        const room = this.rooms.get(interviewId);
        if (room) {
            room.delete(connection);
            if (room.size === 0) {
                this.rooms.delete(interviewId);
                this.roomStates.delete(interviewId);
                return;
            }
        }
        this.emitRoomState(interviewId);
    }

    // Broadcast message to everyone in the room (Monitor + Candidate)
    // Or selectively based on role
    public broadcast(interviewId: string, message: any, excludeSocket?: WebSocket) {
        const room = this.rooms.get(interviewId);
        if (!room) return;

        const payload = JSON.stringify(message);
        room.forEach(conn => {
            if (conn.socket !== excludeSocket && conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.send(payload);
            }
        });
    }

    // Send to monitors only (HR Dashboard)
    public sendToMonitors(interviewId: string, message: any) {
        const room = this.rooms.get(interviewId);
        if (!room) return;

        const payload = JSON.stringify(message);
        room.forEach(conn => {
            if (conn.role === 'monitor' && conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.send(payload);
            }
        });
    }

    // Send to candidate only
    public sendToCandidate(interviewId: string, message: any) {
        const room = this.rooms.get(interviewId);
        if (!room) return;

        const payload = JSON.stringify(message);
        room.forEach(conn => {
            if (conn.role === 'candidate' && conn.socket.readyState === WebSocket.OPEN) {
                conn.socket.send(payload);
            }
        });
    }

    public sendToCompanyMonitors(companyId: string, message: any) {
        if (!companyId) return;
        const payload = JSON.stringify(message);
        this.rooms.forEach((room) => {
            room.forEach((conn) => {
                if (
                    conn.role === 'monitor' &&
                    conn.companyId === companyId &&
                    conn.socket.readyState === WebSocket.OPEN
                ) {
                    conn.socket.send(payload);
                }
            });
        });
    }

    public updateScreenShareState(interviewId: string, update: ScreenShareUpdate): RoomState {
        const current = this.refreshRoomPresence(interviewId) || this.roomStates.get(interviewId) || createEmptyRoomState(interviewId);
        const updateTimestamp = update.timestamp ? new Date(update.timestamp).toISOString() : new Date().toISOString();
        const nextState: RoomState = {
            ...current,
            screenShareActive: !!update.active,
            screenSurface: update.active ? (update.surface || current.screenSurface || 'unknown') : (update.surface || 'unknown'),
            screenMuted: update.muted ?? current.screenMuted,
            lastScreenShareAt: updateTimestamp,
            updatedAt: new Date().toISOString(),
        };
        this.roomStates.set(interviewId, nextState);
        this.emitRoomState(interviewId, nextState);
        return nextState;
    }

    public getRoomState(interviewId: string): RoomState | null {
        return this.refreshRoomPresence(interviewId) || this.roomStates.get(interviewId) || null;
    }

    public getConnectionCount(interviewId: string): number {
        const room = this.rooms.get(interviewId);
        return room ? room.size : 0;
    }
}
