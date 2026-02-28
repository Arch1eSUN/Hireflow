import { useState, useRef, useEffect, useCallback } from 'react';

export const useWebSocket = <T = any>(
    url: string,
    token: string,
    queryParams: Record<string, string> = {},
    onMessage: (data: T) => void
) => {
    const wsRef = useRef<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const reconnectCount = useRef(0);
    const shouldReconnect = useRef(true);
    const onMessageRef = useRef(onMessage);

    useEffect(() => {
        onMessageRef.current = onMessage;
    }, [onMessage]);

    const connect = useCallback(() => {
        if (!url || !token) return;

        // Construct URL
        const params = new URLSearchParams(queryParams);
        params.append('token', token);
        const wsUrl = `${url.replace(/^http/, 'ws')}?${params.toString()}`;

        console.log('Connecting to WS:', wsUrl);
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('WS Connected');
            setIsConnected(true);
            reconnectCount.current = 0;
        };

        ws.onmessage = (event) => {
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
            console.log('WS Closed', event.code, event.reason);
            setIsConnected(false);

            if (shouldReconnect.current && event.code !== 1000 && event.code !== 1008) {
                if (reconnectCount.current < 5) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectCount.current), 30000);
                    setTimeout(() => {
                        reconnectCount.current++;
                        connect();
                    }, delay);
                }
            }
        };

        ws.onerror = (error) => {
            console.error('WS Error', error);
        };

    }, [url, token, JSON.stringify(queryParams)]);

    useEffect(() => {
        shouldReconnect.current = true;
        connect();
        return () => {
            shouldReconnect.current = false;
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [connect]);

    const sendMessage = useCallback((data: any) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify(data));
        }
    }, []);

    return { isConnected, sendMessage };
};
