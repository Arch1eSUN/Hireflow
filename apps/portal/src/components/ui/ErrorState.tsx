import React from 'react';
import { AlertCircle, RotateCw } from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';

interface ErrorStateProps {
    title?: string;
    message?: string;
    onRetry?: () => void;
    className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
    title = 'Something went wrong',
    message = 'We encountered an error while loading this content.',
    onRetry,
    className
}) => {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8 text-center border border-[var(--color-error-bg)] bg-[var(--color-error-bg)] rounded-[var(--radius-md)]", className)}>
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-3 shadow-sm">
                <AlertCircle className="text-[var(--color-error)]" size={20} />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-error)] mb-1">{title}</h3>
            <p className="text-xs text-[var(--color-error)] opacity-80 max-w-xs mb-4">{message}</p>

            {onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-[var(--color-error)] text-[var(--color-error)] text-xs font-medium rounded hover:bg-[var(--color-surface)] transition-colors"
                >
                    <RotateCw size={14} />
                    Try Again
                </button>
            )}
        </div>
    );
};
