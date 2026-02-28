import { useState, useCallback, useRef, useEffect } from 'react';

type CodeSyncOptions = {
    syncIntervalMs?: number;
    onSync?: (code: string, language: string) => void;
};

export function useCodeSync({
    syncIntervalMs = 500,
    onSync,
}: CodeSyncOptions) {
    const [code, setCode] = useState('');
    const [language, setLanguage] = useState('javascript');

    const lastSyncedCodeRef = useRef('');
    const syncTimerRef = useRef<number | null>(null);

    const triggerSync = useCallback((currentCode: string, currentLanguage: string) => {
        if (currentCode === lastSyncedCodeRef.current) return;

        lastSyncedCodeRef.current = currentCode;
        if (onSync) {
            onSync(currentCode, currentLanguage);
        }
    }, [onSync]);

    const handleCodeChange = useCallback((newCode: string, newLanguage?: string) => {
        setCode(newCode);
        if (newLanguage) {
            setLanguage(newLanguage);
        }

        if (syncTimerRef.current) {
            window.clearTimeout(syncTimerRef.current);
        }

        syncTimerRef.current = window.setTimeout(() => {
            triggerSync(newCode, newLanguage || language);
        }, syncIntervalMs);
    }, [language, syncIntervalMs, triggerSync]);

    useEffect(() => {
        return () => {
            if (syncTimerRef.current) {
                window.clearTimeout(syncTimerRef.current);
            }
        };
    }, []);

    // Provide an immediate flush method if necessary before unmount/termination
    const flushSync = useCallback(() => {
        if (syncTimerRef.current) {
            window.clearTimeout(syncTimerRef.current);
        }
        triggerSync(code, language);
    }, [code, language, triggerSync]);

    return {
        code,
        language,
        handleCodeChange,
        flushSync
    };
}
