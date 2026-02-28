import { useState, useRef, useEffect, useCallback } from 'react';

export const useWebSocket = <T = any>(
    url: string,
    token: string,
    onMessage: (data: T) => void
) => {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectCount = useRef(0);
    const shouldReconnect = useRef(true);
    const onMessageRef = useRef(onMessage);
    const reconnectTimerRef = useRef<number | null>(null);
    const connectAttemptRef = useRef(0);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (!url || !token) return;
        const existing = wsRef.current;
        if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
            return;
        }

        if (reconnectTimerRef.current) {
            window.clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }

        // Ensure token is passed as query param
        const normalizedUrl = url.replace(/^http/, 'ws');
        const separator = normalizedUrl.includes('?') ? '&' : '?';
        const wsUrl = `${normalizedUrl}${separator}token=${encodeURIComponent(token)}`;
        const attempt = ++connectAttemptRef.current;

        console.log('Connecting to WS:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            if (attempt !== connectAttemptRef.current) return;
            console.log('WS Connected');
            setIsConnected(true);
            reconnectCount.current = 0;
        };

        ws.onmessage = (event) => {
            if (attempt !== connectAttemptRef.current) return;
            try {
                const data = JSON.parse(event.data);
                if (onMessageRef.current) {
                    onMessageRef.current(data);
                }
            } catch (e) {
                console.error('WS Parse Error', e);
            }
        };

        ws.onclose = (event) => {
            if (attempt !== connectAttemptRef.current) return;
            console.log('WS Closed', event.code, event.reason);
            setIsConnected(false);
            if (wsRef.current === ws) {
                wsRef.current = null;
            }

            if (shouldReconnect.current && event.code !== 1000 && event.code !== 1008) {
                if (reconnectCount.current < 5) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
                    console.log(`WS Reconnecting in ${delay}ms...`);
                    reconnectTimerRef.current = window.setTimeout(() => {
                        reconnectCount.current++;
                        connect();
                    }, delay);
                }
            }
        };

        ws.onerror = (error) => {
            if (attempt !== connectAttemptRef.current) return;
            console.error('WS Error', error);
        };

    }, [url, token]);

    useEffect(() => {
        shouldReconnect.current = true;
        connect();
        return () => {
            shouldReconnect.current = false;
            if (reconnectTimerRef.current) {
                window.clearTimeout(reconnectTimerRef.current);
                reconnectTimerRef.current = null;
            }
            if (wsRef.current) {
                try {
                    wsRef.current.close(1000, 'component_unmount');
                } catch {
                    wsRef.current.close();
                }
                wsRef.current = null;
            }
        };
    }, [connect]);

    const sendMessage = useCallback((data: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        } else {
            console.warn('WS not open, message dropped', data);
        }
    }, []);

    return { isConnected, sendMessage };
};
