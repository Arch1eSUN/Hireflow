/**
 * HireFlow WebSocket 消息协议 Schema (共享类型)
 *
 * 所有客户端↔服务端消息必须符合此处定义的类型。
 * 用于 runtime validation 和静态 TypeScript 检查。
 */

// ── 候选人 → 服务端 ──

export interface WsAudioMessage {
    type: 'audio';
    data: string;  // base64
    mimeType: string;
}

export interface WsVadEvent {
    type: 'vad_event';
    status: 'speaking_start' | 'speaking_stop';
}

export interface WsUserText {
    type: 'user_text';
    text: string;
}

export interface WsSecurityViolation {
    type: 'security_violation';
    event: string;
    timestamp: number;
    details?: Record<string, unknown>;
}

export interface WsScreenShareStatus {
    type: 'screen_share_status';
    active: boolean;
    surface?: string;
    reason?: string;
    muted?: boolean;
    timestamp?: number;
}

export interface WsCodeSync {
    type: 'code_sync';
    code: string;
    language: string;
    timestamp: number;
}

// ── 服务端 → 候选人 ──

export interface WsTranscript {
    type: 'transcript';
    text: string;
}

export interface WsAiText {
    type: 'ai_text';
    text: string;
}

export interface WsAudioPlayback {
    type: 'audio_playback';
    data: string;  // base64
}

export interface WsAssistantAudioDone {
    type: 'assistant_audio_done';
}

export interface WsTurnState {
    type: 'interview_turn_state';
    state: 'listening' | 'thinking' | 'speaking';
}

export interface WsVoiceMode {
    type: 'voice_mode';
    stt: 'server' | 'browser';
    tts: 'server' | 'browser';
    fallbackReason?: string;
    recovered?: boolean;
}

export interface WsSpeechCaptureHint {
    type: 'speech_capture_hint';
    text: string;
}

export interface WsInputGate {
    type: 'input_gate';
}

export interface WsSystemBlocked {
    type: 'system_blocked';
    error: string;
}

export interface WsForceTerminate {
    type: 'force_terminate';
    reason: string;
}

export interface WsInterventionWarning {
    type: 'intervention_warning';
    event: { message: string; severity?: string };
}

// ── 监控端 → 服务端 ──

export interface WsRoomStateRequest {
    type: 'room_state_request';
}

export interface WsWebRtcRequestOffer {
    type: 'webrtc_request_offer';
}

export interface WsWebRtcSignal {
    type: 'webrtc_signal';
    payload: {
        type: 'offer' | 'answer' | 'candidate';
        sdp?: string;
        candidate?: string;
        sdpMid?: string;
        sdpMLineIndex?: number;
    };
}

export interface WsMonitorRequestReshare {
    type: 'monitor_request_reshare';
}

export interface WsMonitorTerminate {
    type: 'monitor_terminate';
    reason?: string;
}

// ── 服务端 → 监控端 ──

export interface WsRoomState {
    type: 'room_state';
    state: {
        interviewId: string;
        candidateOnline: boolean;
        monitorCount: number;
        screenShareActive: boolean;
        screenSurface: string;
        screenMuted: boolean;
        lastScreenShareAt: string | null;
        updatedAt: string;
    };
}

export interface WsIntegrityEvent {
    type: 'integrity_event';
    event: {
        type: string;
        severity: 'low' | 'medium' | 'high';
        message: string;
        timestamp: string;
        details?: Record<string, unknown>;
    };
}

// ── Union types ──

export type WsCandidateToServer =
    | WsAudioMessage
    | WsVadEvent
    | WsUserText
    | WsSecurityViolation
    | WsScreenShareStatus
    | WsCodeSync;

export type WsServerToCandidate =
    | WsTranscript
    | WsAiText
    | WsAudioPlayback
    | WsAssistantAudioDone
    | WsTurnState
    | WsVoiceMode
    | WsSpeechCaptureHint
    | WsInputGate
    | WsSystemBlocked
    | WsForceTerminate
    | WsInterventionWarning;

export type WsMonitorToServer =
    | WsRoomStateRequest
    | WsWebRtcRequestOffer
    | WsWebRtcSignal
    | WsMonitorRequestReshare
    | WsMonitorTerminate
    | WsScreenShareStatus;

export type WsServerToMonitor =
    | WsRoomState
    | WsIntegrityEvent
    | WsTranscript
    | WsAiText
    | WsScreenShareStatus
    | WsWebRtcSignal
    | WsCodeSync;

export type WsMessage =
    | WsCandidateToServer
    | WsServerToCandidate
    | WsMonitorToServer
    | WsServerToMonitor;
