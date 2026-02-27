// ================================================
// HireFlow AI — EmptyState (Reusable Empty View)
// M3 Design: Icon in tinted circle, title, subtitle, optional CTA
// ================================================
import React from 'react';
import { motion } from 'framer-motion';
import { type LucideIcon } from 'lucide-react';

interface EmptyStateProps {
    icon: LucideIcon;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    actionIcon?: LucideIcon;
    onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    icon: Icon,
    title,
    subtitle,
    actionLabel,
    actionIcon: ActionIcon,
    onAction,
}) => {
    return (
        <motion.div
            className="empty-state"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.2, 0, 0, 1] }}
        >
            {/* Tinted icon circle */}
            <div className="empty-state__icon-ring">
                <div className="empty-state__icon-bg">
                    <Icon size={32} className="empty-state__icon" />
                </div>
            </div>

            {/* Text */}
            <h3 className="empty-state__title">{title}</h3>
            {subtitle && (
                <p className="empty-state__subtitle">{subtitle}</p>
            )}

            {/* Action CTA */}
            {actionLabel && onAction && (
                <motion.button
                    className="btn btn-filled empty-state__action"
                    onClick={onAction}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    {ActionIcon && <ActionIcon size={18} />}
                    {actionLabel}
                </motion.button>
            )}
        </motion.div>
    );
};
