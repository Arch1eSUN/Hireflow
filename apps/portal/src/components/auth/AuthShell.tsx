import React from 'react';
import { Activity, ShieldCheck, Sparkles, Workflow } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { cn } from '@hireflow/utils/src/index';

type AuthMode = 'login' | 'register';

interface AuthShellProps {
    mode: AuthMode;
    title: string;
    subtitle: string;
    children: React.ReactNode;
}

const AuthShell: React.FC<AuthShellProps> = ({
    mode,
    title,
    subtitle,
    children,
}) => {
    const { t } = useI18n();

    const featureCards = [
        {
            icon: Activity,
            title: t('auth.shell.feature.realtimeTitle'),
            description: t('auth.shell.feature.realtimeDesc'),
            tone: 'text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success)]/20',
        },
        {
            icon: ShieldCheck,
            title: t('auth.shell.feature.integrityTitle'),
            description: t('auth.shell.feature.integrityDesc'),
            tone: 'text-[var(--color-primary)] bg-[var(--color-info-bg)] border-[var(--color-primary)]/20',
        },
        {
            icon: Workflow,
            title: t('auth.shell.feature.analyticsTitle'),
            description: t('auth.shell.feature.analyticsDesc'),
            tone: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] border-[var(--color-warning)]/20',
        },
    ];

    return (
        <div className="min-h-screen bg-[var(--color-surface-dim)] relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-28 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(25,103,210,0.26)_0%,rgba(25,103,210,0.04)_55%,transparent_72%)]" />
                <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(19,115,51,0.18)_0%,rgba(19,115,51,0.03)_58%,transparent_75%)]" />
                <div className="absolute top-1/2 left-[44%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(11,87,208,0.10)_0%,rgba(11,87,208,0.02)_60%,transparent_78%)]" />
            </div>

            <div className="absolute top-6 right-6 z-20">
                <LanguageSwitcher />
            </div>

            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1180px] items-center px-4 py-8 sm:px-8">
                <div className="w-full rounded-[28px] border border-[var(--color-outline)] bg-[var(--color-surface)]/92 backdrop-blur-xl shadow-[0_16px_64px_rgba(15,23,42,0.10)]">
                    <div className="grid min-h-[680px] lg:grid-cols-[1.1fr_0.9fr]">
                        <section className="relative overflow-hidden rounded-t-[28px] border-b border-[var(--color-outline)] bg-[var(--color-surface-container)] p-8 sm:p-10 lg:rounded-l-[28px] lg:rounded-tr-none lg:border-b-0 lg:border-r">
                            <div className="mb-10 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-primary)] text-white shadow-[0_8px_24px_rgba(11,87,208,0.30)]">
                                    <Sparkles size={20} />
                                </div>
                                <div>
                                    <div className="text-sm font-semibold tracking-wide text-[var(--color-text-primary)]">
                                        {t('auth.shell.brand')}
                                    </div>
                                    <div className="text-xs text-[var(--color-text-secondary)]">
                                        {t('auth.shell.badge')}
                                    </div>
                                </div>
                            </div>

                            <div className="max-w-[520px]">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                                    {mode === 'login' ? t('auth.shell.kicker.login') : t('auth.shell.kicker.register')}
                                </p>
                                <h2 className="mt-3 text-[2rem] font-medium leading-[1.18] text-[var(--color-text-primary)] sm:text-[2.3rem]">
                                    {t('auth.shell.headline')}
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                                    {t('auth.shell.subline')}
                                </p>
                            </div>

                            <div className="mt-10 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                                {featureCards.map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <div
                                            key={item.title}
                                            className={cn(
                                                'rounded-2xl border p-4 transition-transform duration-200 hover:-translate-y-0.5',
                                                item.tone
                                            )}
                                        >
                                            <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/80">
                                                <Icon size={16} />
                                            </div>
                                            <div className="text-sm font-semibold">{item.title}</div>
                                            <p className="mt-1 text-xs leading-5 text-[var(--color-text-secondary)]">
                                                {item.description}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>

                        <section className="flex items-center p-6 sm:p-10">
                            <div className="w-full">
                                <div className="mb-6">
                                    <h1 className="text-[1.65rem] font-medium leading-tight text-[var(--color-text-primary)]">
                                        {title}
                                    </h1>
                                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                        {subtitle}
                                    </p>
                                </div>
                                {children}
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthShell;
