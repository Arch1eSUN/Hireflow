import React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@hireflow/utils/src/index';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    actionIcon?: LucideIcon;
    onAction?: () => void;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    subtitle,
    actionLabel,
    actionIcon: ActionIcon,
    onAction,
    className
}) => {
    return (
        <div className={cn("flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-500", className)}>
            {/* Icon Circle */}
            {Icon && (
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-dim)] flex items-center justify-center mb-4">
                    <Icon size={32} className="text-[var(--color-text-secondary)] opacity-50" />
                </div>
            )}

            {/* Content */}
            <h3 className="text-[16px] font-medium text-[var(--color-text-primary)] mb-1">{title}</h3>
            {subtitle && (
                <p className="text-[13px] text-[var(--color-text-secondary)] max-w-sm mb-6">{subtitle}</p>
            )}

            {/* Action */}
            {actionLabel && onAction && (
                <button
                    className="btn btn-filled"
                    onClick={onAction}
                >
                    {ActionIcon && <ActionIcon size={16} />}
                    {actionLabel}
                </button>
            )}
        </div>
    );
};
