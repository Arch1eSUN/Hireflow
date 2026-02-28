import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Monitor, Mic, Wifi, Chrome, Clock, Radio, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { resolveApiBaseUrl } from '../lib/runtime';

interface InterviewPreview {
    valid: boolean;
    id: string;
    jobTitle: string;
    companyName: string;
    companyLogo?: string | null;
    welcomeText?: string | null;
    candidateName?: string;
    type: string;
    startTime: string;
    status: string;
    interviewer?: string;
    startAvailable?: boolean;
    startBlockedReason?: string | null;
    runtimeModel?: string | null;
}

const LandingPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const [loading, setLoading] = useState(Boolean(token));
    const [resolvingToken, setResolvingToken] = useState(!token);
    const [error, setError] = useState<string | null>(null);
    const [preview, setPreview] = useState<InterviewPreview | null>(null);
    const apiBaseUrl = resolveApiBaseUrl();

    useEffect(() => {
        if (token) {
            setResolvingToken(false);
            return;
        }

        let mounted = true;
        setResolvingToken(true);
        setLoading(true);
        setError(null);

        let queryToken = '';
        if (typeof window !== 'undefined') {
            queryToken = (new URLSearchParams(window.location.search).get('token') || '').trim();
        }

        if (queryToken.length > 0) {
            navigate(`/${queryToken}`, { replace: true });
            return;
        }

        fetch(`${apiBaseUrl}/public/interview/demo/token`)
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || '当前页面缺少面试 Token，请使用邀请链接打开。');
                }
                return res.json();
            })
            .then((payload) => {
                if (!mounted) return;
                const demoToken = payload?.data?.token;
                if (typeof demoToken !== 'string' || demoToken.trim().length === 0) {
                    throw new Error('演示面试链接生成失败，请稍后重试。');
                }
                navigate(`/${demoToken.trim()}`, { replace: true });
            })
            .catch((err: Error) => {
                if (!mounted) return;
                setError(err.message || '当前页面缺少面试 Token，请使用邀请链接打开。');
            })
            .finally(() => {
                if (mounted) {
                    setLoading(false);
                    setResolvingToken(false);
                }
            });

        return () => {
            mounted = false;
        };
    }, [apiBaseUrl, navigate, token]);

    useEffect(() => {
        if (!token) {
            setPreview(null);
            return;
        }

        let mounted = true;
        setLoading(true);
        setError(null);

        fetch(`${apiBaseUrl}/public/interview/${token}`)
            .then(async (res) => {
                if (!res.ok) {
                    const body = await res.json().catch(() => ({}));
                    throw new Error(body?.error || 'Interview link invalid or expired');
                }
                return res.json();
            })
            .then((payload) => {
                if (!mounted) return;
                setPreview(payload?.data || null);
            })
            .catch((err: Error) => {
                if (!mounted) return;
                setError(err.message || 'Interview link invalid or expired');
            })
            .finally(() => {
                if (mounted) setLoading(false);
            });

        return () => {
            mounted = false;
        };
    }, [apiBaseUrl, token]);

    const checklistItems = [
        { icon: Mic, title: t('interview.deviceCheck.microphone'), desc: '请提前开启麦克风权限并确认收音正常。' },
        { icon: Monitor, title: 'Quiet Space', desc: t('interview.landing.checklist.quiet') },
        { icon: Wifi, title: t('interview.deviceCheck.network'), desc: t('interview.landing.checklist.network') },
        { icon: Chrome, title: t('interview.deviceCheck.browser'), desc: t('interview.landing.checklist.browser') },
    ];

    const startAvailable = preview?.startAvailable !== false;
    const blockedReason = String(preview?.startBlockedReason || '').trim();
    const canContinue = Boolean(token && preview && !error && !loading && !resolvingToken && startAvailable);

    const startLabel = resolvingToken
        ? '正在准备演示链接...'
        : loading
            ? '正在校验链接...'
            : (!startAvailable && blockedReason)
                ? '暂不可开始'
                : error
                    ? '链接不可用'
                    : t('interview.landing.startCheck');

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-surface-dim)] font-sans animate-in fade-in duration-500">
            {/* Main Container */}
            <div className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col md:flex-row">

                {/* Left: Info Panel */}
                <div className="p-8 md:w-3/5 flex flex-col justify-center border-b md:border-b-0 md:border-r border-[var(--color-outline)]">
                    <div className="mb-6">
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] text-xs font-medium uppercase tracking-wide mb-3">
                            {t('interview.landing.type')}
                        </div>
                        <h1 className="text-3xl font-semibold text-[var(--color-text-primary)] leading-tight mb-2">
                            {preview?.jobTitle || t('interview.landing.role')}
                        </h1>
                        <p className="text-[var(--color-text-secondary)] text-sm">
                            {preview?.companyName || t('interview.landing.department')}
                        </p>
                    </div>

                    <div className="flex items-center gap-6 mb-8 text-sm text-[var(--color-text-secondary)]">
                        <div className="flex items-center gap-2">
                            <Clock size={16} />
                            <span>{t('interview.landing.duration', { minutes: '25' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Radio size={16} />
                            <span>Voice Conversation Interview</span>
                        </div>
                    </div>

                    <button
                        className="h-12 text-base w-full rounded-full px-5 bg-[var(--color-primary)] text-white hover:brightness-95 transition-all flex items-center justify-between group shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
                        onClick={() => navigate(`/${token}/consent`)}
                        disabled={!canContinue}
                    >
                        <span className="flex items-center gap-2">
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            {startLabel}
                        </span>
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>

                    <p className="mt-4 text-xs text-[var(--color-text-secondary)] text-center">
                        {preview?.welcomeText || t('interview.landing.terms')}
                    </p>
                    {!token && resolvingToken && (
                        <div className="mt-3 rounded-xl border border-[var(--color-info)]/20 bg-[var(--color-info-bg)] px-3 py-2 text-xs text-[var(--color-info)]">
                            未检测到面试 Token，正在为你准备可直接测试的小梵演示场景。
                        </div>
                    )}
                    {error && (
                        <div className="mt-3 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-3 py-2 text-xs text-[var(--color-error)] flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {!error && !loading && preview && !startAvailable && (
                        <div className="mt-3 rounded-xl border border-[var(--color-warning)]/30 bg-[var(--color-warning-bg)] px-3 py-2 text-xs text-[var(--color-warning)] flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>{blockedReason || '后端尚未连接 AI key，暂时无法开始正式面试。'}</span>
                        </div>
                    )}
                </div>

                {/* Right: Checklist Grid */}
                <div className="p-6 md:w-2/5 bg-[var(--color-surface-dim)] flex flex-col justify-center">
                    <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-4 pl-1">
                        {t('interview.landing.requirements')}
                    </h3>
                    <div className="grid grid-cols-1 gap-3">
                        {checklistItems.map((item, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-md)]">
                                <div className="text-[var(--color-primary)] mt-0.5">
                                    <item.icon size={18} />
                                </div>
                                <div>
                                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</div>
                                    <div className="text-xs text-[var(--color-text-secondary)]">{item.desc}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center gap-2 text-[var(--color-text-disabled)] text-sm font-medium">
                <span className="min-w-8 h-5 px-2 bg-[var(--color-outline)] rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {preview?.interviewer || t('interview.brand.name')}
                </span>
                {t('interview.brand.poweredBy')}
            </div>
        </div>
    );
};

export default LandingPage;
