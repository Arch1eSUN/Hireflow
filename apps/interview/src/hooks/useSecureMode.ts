import { useEffect, useRef, useCallback } from 'react';

type SecurityEvent = {
    type: 'visibility' | 'contextmenu' | 'unload' | 'clipboard';
    timestamp: number;
    details?: string;
};

type SecureModeOptions = {
    enabled?: boolean;
    onViolation?: (event: SecurityEvent) => void;
    blockCopyPaste?: boolean;
    blockContextMenu?: boolean;
    warnOnLeave?: boolean;
};

export function useSecureMode({
    enabled = true,
    onViolation,
    blockCopyPaste = true,
    blockContextMenu = true,
    warnOnLeave = true,
}: SecureModeOptions) {
    const violationCountRef = useRef(0);

    const reportViolation = useCallback((type: SecurityEvent['type'], details?: string) => {
        violationCountRef.current++;
        if (onViolation) {
            onViolation({ type, timestamp: Date.now(), details });
        }
    }, [onViolation]);

    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                reportViolation('visibility', 'Candidate navigated away from tab');
            }
        };

        const handleContextMenu = (e: MouseEvent) => {
            if (blockContextMenu) {
                e.preventDefault();
                reportViolation('contextmenu', 'Context menu access blocked');
            }
        };

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (warnOnLeave) {
                e.preventDefault();
                e.returnValue = '';
                reportViolation('unload', 'Candidate attempted to close or refresh page');
                return '';
            }
        };

        const handleClipboard = (e: ClipboardEvent) => {
            if (blockCopyPaste) {
                const target = e.target as HTMLElement;
                // Allow clipboard on standard inputs if needed, or strictly block entirely
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    reportViolation('clipboard', `Clipboard ${e.type} blocked`);
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        document.addEventListener('contextmenu', handleContextMenu);
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('copy', handleClipboard);
        document.addEventListener('paste', handleClipboard);
        document.addEventListener('cut', handleClipboard);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            document.removeEventListener('contextmenu', handleContextMenu);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            document.removeEventListener('copy', handleClipboard);
            document.removeEventListener('paste', handleClipboard);
            document.removeEventListener('cut', handleClipboard);
        };
    }, [
        enabled,
        blockContextMenu,
        warnOnLeave,
        blockCopyPaste,
        reportViolation
    ]);

    return {
        violationCount: violationCountRef.current,
        isSecure: enabled
    };
}
