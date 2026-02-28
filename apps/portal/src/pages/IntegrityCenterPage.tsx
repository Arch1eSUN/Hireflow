import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, ShieldAlert, TriangleAlert, Search, Activity, Radar, ArrowUpRight } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { cn } from '@hireflow/utils/src/index';
import type { IntegrityOverviewSnapshot } from '@hireflow/types';
import api from '@/lib/api';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useDebounce } from '@/hooks/useDebounce';

const dateFormatter = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
});

const IntegrityCenterPage: React.FC = () => {
    const { t } = useI18n();
    const [search, setSearch] = useState('');
    const [level, setLevel] = useState<'all' | 'high' | 'medium' | 'low'>('all');
    const [windowDays, setWindowDays] = useState<7 | 30 | 90>(30);
    const debouncedSearch = useDebounce(search, 250);

    const { data, isLoading, isError, refetch } = useQuery<IntegrityOverviewSnapshot>({
        queryKey: ['integrity-overview', level, windowDays, debouncedSearch],
        queryFn: async () => {
            const res = await api.get<{ data: IntegrityOverviewSnapshot }>('/integrity/overview', {
                params: {
                    level,
                    days: windowDays,
                    search: debouncedSearch.trim() || undefined,
                },
            });
            return res.data.data;
        },
    });

    const riskTone = (risk: 'low' | 'medium' | 'high') => {
        if (risk === 'high') {
            return {
                className: 'text-[var(--color-error)] bg-[var(--color-error-bg)] border-[var(--color-error)]',
                icon: TriangleAlert,
            };
        }
        if (risk === 'medium') {
            return {
                className: 'text-[var(--color-warning)] bg-[var(--color-warning-bg)] border-[var(--color-warning)]',
                icon: ShieldAlert,
            };
        }
        return {
            className: 'text-[var(--color-success)] bg-[var(--color-success-bg)] border-[var(--color-success)]',
            icon: Shield,
        };
    };

    if (isLoading) {
        return (
            <div className="page-shell">
                <div className="page-header">
                    <h1 className="page-title">{t('integrity.title')}</h1>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="card animate-pulse h-[120px]" />
                    ))}
                </div>
                <div className="card animate-pulse h-[420px]" />
            </div>
        );
    }

    if (isError || !data) {
        return (
            <ErrorState
                title={t('analytics.loadFailed')}
                message={t('error.network')}
                onRetry={() => {
                    void refetch();
                }}
            />
        );
    }

    const summaryCards = [
        {
            key: 'avg',
            label: t('integrity.kpi.averageScore'),
            value: `${data.summary.averageScore}`,
            hint: '/100',
            icon: Radar,
            tone: 'var(--color-primary)',
        },
        {
            key: 'high',
            label: t('integrity.kpi.highRisk'),
            value: `${data.summary.highRisk}`,
            hint: `${(data.summary.highRiskRate * 100).toFixed(1)}%`,
            icon: TriangleAlert,
            tone: 'var(--color-error)',
        },
        {
            key: 'monitored',
            label: t('integrity.kpi.monitored'),
            value: `${data.summary.monitoredInterviews}`,
            hint: `${data.windowDays}d`,
            icon: Activity,
            tone: 'var(--color-success)',
        },
        {
            key: 'events',
            label: t('integrity.kpi.totalEvents'),
            value: `${data.summary.totalEvents}`,
            hint: `${data.summary.interviewsWithSignals}/${data.summary.monitoredInterviews}`,
            icon: ShieldAlert,
            tone: 'var(--color-warning)',
        },
    ];

    return (
        <div className="page-shell">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{t('integrity.title')}</h1>
                    <p className="page-subtitle">{t('integrity.subtitle')}</p>
                </div>
            </div>

            <div className="toolbar">
                <div className="toolbar-search">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" size={16} />
                    <input
                        type="text"
                        placeholder={t('integrity.searchPlaceholder')}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
                <div className="toolbar-separator" />
                <div className="segmented">
                    {([7, 30, 90] as const).map((value) => (
                        <button
                            key={value}
                            className={cn('segmented-item', windowDays === value && 'active')}
                            onClick={() => setWindowDays(value)}
                        >
                            {t(`integrity.window.${value}`)}
                        </button>
                    ))}
                </div>
                <div className="toolbar-separator" />
                <div className="segmented">
                    {(['all', 'high', 'medium', 'low'] as const).map((value) => (
                        <button
                            key={value}
                            className={cn('segmented-item', level === value && 'active')}
                            onClick={() => setLevel(value)}
                        >
                            {t(`integrity.level.${value}`)}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {summaryCards.map((item) => (
                    <div key={item.key} className="card">
                        <div className="flex items-center justify-between">
                            <p className="text-label-small text-[var(--color-on-surface-variant)]">{item.label}</p>
                            <item.icon size={16} style={{ color: item.tone }} />
                        </div>
                        <div className="mt-3 flex items-end gap-2">
                            <p className="text-display-medium">{item.value}</p>
                            <span className="text-label-small text-[var(--color-on-surface-variant)] pb-1">{item.hint}</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div className="card">
                    <h3 className="text-headline-medium mb-4">{t('integrity.section.topSignals')}</h3>
                    {data.topSignals.length === 0 ? (
                        <EmptyState title={t('integrity.signal.none')} subtitle={t('integrity.subtitle')} />
                    ) : (
                        <div className="space-y-3">
                            {data.topSignals.map((signal) => {
                                const tone = riskTone(signal.severity);
                                const SignalIcon = tone.icon;
                                const percent = Math.max(8, Math.min(100, (signal.count / Math.max(data.summary.totalEvents, 1)) * 100));
                                return (
                                    <div key={signal.type} className="space-y-1">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <SignalIcon size={14} className="text-[var(--color-on-surface-variant)]" />
                                                <span className="text-body-medium truncate">{signal.type}</span>
                                            </div>
                                            <span className="text-label-small text-[var(--color-on-surface-variant)]">{signal.count}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-[var(--color-surface-container-high)] overflow-hidden">
                                            <div className="h-full rounded-full bg-[var(--color-primary)]" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="card">
                    <h3 className="text-headline-medium mb-4">{t('integrity.section.recommendations')}</h3>
                    <div className="space-y-2">
                        {data.recommendations.map((item) => (
                            <div key={item} className="flex gap-2 text-body-medium">
                                <span className="text-[var(--color-primary)]">•</span>
                                <span>{item}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--color-outline)] flex items-center justify-between">
                    <h3 className="text-title-medium">{t('integrity.section.interviewRiskTable')}</h3>
                    <span className="text-label-small text-[var(--color-on-surface-variant)]">
                        {new Date(data.generatedAt).toLocaleString()}
                    </span>
                </div>

                {data.interviews.length === 0 ? (
                    <div className="p-6">
                        <EmptyState title={t('integrity.empty.title')} subtitle={t('integrity.empty.subtitle')} />
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>{t('integrity.columns.candidate')}</th>
                                    <th>{t('integrity.columns.job')}</th>
                                    <th>{t('integrity.columns.start')}</th>
                                    <th>{t('integrity.columns.score')}</th>
                                    <th>{t('integrity.columns.risk')}</th>
                                    <th>{t('integrity.columns.signals')}</th>
                                    <th className="text-right">{t('integrity.columns.actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.interviews.map((item) => {
                                    const tone = riskTone(item.level);
                                    return (
                                        <tr key={item.interviewId} className="group hover:bg-[var(--color-surface-hover)]">
                                            <td>
                                                <div className="font-medium">{item.candidateName}</div>
                                            </td>
                                            <td className="text-body-medium text-[var(--color-on-surface-variant)]">{item.jobTitle}</td>
                                            <td className="text-body-medium text-[var(--color-on-surface-variant)]">{dateFormatter.format(new Date(item.startTime))}</td>
                                            <td>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium tabular-nums">{item.score}</span>
                                                    <div className="w-20 h-1.5 rounded-full bg-[var(--color-surface-container-high)] overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full"
                                                            style={{
                                                                width: `${item.score}%`,
                                                                backgroundColor:
                                                                    item.level === 'high'
                                                                        ? 'var(--color-error)'
                                                                        : item.level === 'medium'
                                                                            ? 'var(--color-warning)'
                                                                            : 'var(--color-success)',
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className={cn('chip', tone.className)}>{t(`integrity.level.${item.level}`)}</span>
                                            </td>
                                            <td className="text-body-medium text-[var(--color-on-surface-variant)]">
                                                {item.eventCount} · {item.topSignals[0]?.type || t('integrity.signal.none')}
                                            </td>
                                            <td>
                                                <div className="flex items-center justify-end table-action-reveal">
                                                    <button
                                                        className="btn btn-outlined h-[30px] text-xs"
                                                        onClick={() => window.open(`/interviews/${item.interviewId}/monitor`, '_blank')}
                                                    >
                                                        {t('integrity.action.monitor')} <ArrowUpRight size={12} />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IntegrityCenterPage;
