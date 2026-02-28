import React from 'react';
import { AlertTriangle, MonitorPlay } from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';

type SecureOverlayProps = {
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    icon?: React.ReactNode;
};

export const SecureOverlay: React.FC<SecureOverlayProps> = ({
    isOpen,
    title,
    description,
    actionLabel,
    onAction,
    icon = <AlertTriangle className="text-[var(--color-warning)]" size={48} />
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-[var(--color-surface)]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
            <div className="max-w-md w-full bg-[var(--color-surface-dim)] border border-[var(--color-outline)] rounded-2xl shadow-xl p-8 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-[var(--color-warning-bg)]/20 rounded-full flex items-center justify-center mb-6">
                    {icon}
                </div>

                <h2 className="text-xl font-bold text-[var(--color-on-surface)] mb-3">
                    {title}
                </h2>

                <p className="text-sm text-[var(--color-on-surface-variant)] leading-relaxed mb-8">
                    {description}
                </p>

                {actionLabel && onAction && (
                    <button
                        className="btn btn-filled w-full h-12 flex items-center justify-center gap-2"
                        onClick={onAction}
                    >
                        <MonitorPlay size={18} />
                        {actionLabel}
                    </button>
                )}
            </div>

            <div className="mt-8 text-xs font-mono text-[var(--color-text-secondary)] opacity-50">
                HireFlow AI Security Enclave
            </div>
        </div>
    );
};
