import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';

interface LoadingProps {
    type?: 'spinner' | 'skeleton' | 'overlay';
    text?: string;
    className?: string;
}

export const Loading: React.FC<LoadingProps> = ({ type = 'spinner', text, className }) => {
    if (type === 'overlay') {
        return (
            <div className="absolute inset-0 bg-white/50 z-50 flex items-center justify-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-[var(--color-primary)]" size={32} />
                    {text && <p className="text-sm font-medium text-[var(--color-text-secondary)]">{text}</p>}
                </div>
            </div>
        );
    }

    if (type === 'skeleton') {
        return (
            <div className={cn("animate-pulse space-y-4 w-full", className)}>
                <div className="h-8 bg-[var(--color-surface-hover)] rounded w-1/3"></div>
                <div className="space-y-2">
                    <div className="h-4 bg-[var(--color-surface-hover)] rounded"></div>
                    <div className="h-4 bg-[var(--color-surface-hover)] rounded w-5/6"></div>
                    <div className="h-4 bg-[var(--color-surface-hover)] rounded w-4/6"></div>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col items-center justify-center py-12 text-[var(--color-text-disabled)]", className)}>
            <Loader2 className="animate-spin mb-3" size={24} />
            {text && <p className="text-sm">{text}</p>}
        </div>
    );
};
