import React from 'react';
import { useI18n } from '@hireflow/i18n/react';
import { cn } from '@hireflow/utils/src/index';

type Strength = 'weak' | 'medium' | 'strong';

function getStrength(password: string): { level: Strength; score: number } {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    if (score <= 2) return { level: 'weak', score };
    if (score <= 4) return { level: 'medium', score };
    return { level: 'strong', score };
}

interface PasswordStrengthMeterProps {
    password: string;
}

const PasswordStrengthMeter: React.FC<PasswordStrengthMeterProps> = ({ password }) => {
    const { t } = useI18n();

    if (!password) return null;

    const { level, score } = getStrength(password);
    const progress = Math.min(100, Math.max(20, Math.round((score / 5) * 100)));
    const tone =
        level === 'strong'
            ? 'bg-[var(--color-success)]'
            : level === 'medium'
                ? 'bg-[var(--color-warning)]'
                : 'bg-[var(--color-error)]';

    const labelKey =
        level === 'strong'
            ? 'auth.passwordStrength.strong'
            : level === 'medium'
                ? 'auth.passwordStrength.medium'
                : 'auth.passwordStrength.weak';

    return (
        <div className="mt-2">
            <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[11px] text-[var(--color-text-secondary)]">{t('auth.passwordStrength.label')}</span>
                <span
                    className={cn(
                        'text-[11px] font-semibold uppercase tracking-wide',
                        level === 'strong'
                            ? 'text-[var(--color-success)]'
                            : level === 'medium'
                                ? 'text-[var(--color-warning)]'
                                : 'text-[var(--color-error)]'
                    )}
                >
                    {t(labelKey)}
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-container-high)]">
                <div className={cn('h-full rounded-full transition-all duration-300', tone)} style={{ width: `${progress}%` }} />
            </div>
        </div>
    );
};

export default PasswordStrengthMeter;
