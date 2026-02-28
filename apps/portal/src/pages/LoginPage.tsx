import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CheckCircle2, Eye, EyeOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';

type HealthStatus = 'checking' | 'online' | 'offline';

function extractAuthError(error: any, fallback: string): string {
    const payload = error?.response?.data?.error;
    if (typeof payload === 'string' && payload.trim().length > 0) {
        return payload;
    }
    if (payload?.formErrors?.length) {
        return payload.formErrors[0];
    }
    return fallback;
}

export default function LoginPage() {
    const { t } = useI18n();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [healthStatus, setHealthStatus] = useState<HealthStatus>('checking');
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    useEffect(() => {
        let mounted = true;
        setHealthStatus('checking');

        api.get('/health')
            .then(() => {
                if (mounted) setHealthStatus('online');
            })
            .catch(() => {
                if (mounted) setHealthStatus('offline');
            });

        return () => {
            mounted = false;
        };
    }, []);

    const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
    const canSubmit = normalizedEmail.length > 0 && password.length > 0 && !isLoading;

    const handleDemoFill = () => {
        setEmail('zhangtong@hireflow.ai');
        setPassword('password123');
        setError(null);
    };

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            const response = await api.post('/auth/login', {
                email: normalizedEmail,
                password,
            });

            const payload = response.data?.data;
            if (!payload?.accessToken || !payload?.user) {
                throw new Error('Invalid login payload');
            }

            login(payload.accessToken, {
                id: payload.user.id,
                email: payload.user.email,
                name: payload.user.name,
                role: payload.user.role,
                companyId: payload.user.companyId || payload.user.company?.id || '',
            });
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            setError(extractAuthError(err, t('error.generic')));
        } finally {
            setIsLoading(false);
        }
    };

    const healthLabel =
        healthStatus === 'online'
            ? t('auth.health.online')
            : healthStatus === 'offline'
                ? t('auth.health.offline')
                : t('auth.health.checking');

    return (
        <AuthShell mode="login" title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
            <div className="mb-5 flex items-center justify-between">
                <button type="button" className="btn btn-outlined h-[34px] px-3 text-xs" onClick={handleDemoFill}>
                    {t('auth.demoFill')}
                </button>
                <div
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        healthStatus === 'online'
                            ? 'border-[var(--color-success)]/30 bg-[var(--color-success-bg)] text-[var(--color-success)]'
                            : healthStatus === 'offline'
                                ? 'border-[var(--color-error)]/30 bg-[var(--color-error-bg)] text-[var(--color-error)]'
                                : 'border-[var(--color-outline)] bg-[var(--color-surface-container)] text-[var(--color-text-secondary)]'
                    }`}
                >
                    {healthStatus === 'online' ? <Wifi size={12} /> : <WifiOff size={12} />}
                    {healthLabel}
                </div>
            </div>

            {error && (
                <div className="mb-4 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] p-3 text-[13px] text-[var(--color-error)]">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.email')}</label>
                    <input
                        type="email"
                        className="input w-full"
                        placeholder={t('auth.placeholder.email')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.password')}</label>
                        <button
                            type="button"
                            tabIndex={-1}
                            className="text-[12px] text-[var(--color-primary)] hover:underline"
                            onClick={() => setError(t('auth.forgotPasswordHint'))}
                        >
                            {t('auth.forgotPassword')}
                        </button>
                    </div>
                    <div className="relative">
                        <input
                            type={showPassword ? 'text' : 'password'}
                            className="input w-full pr-10"
                            placeholder={t('auth.password')}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            onClick={() => setShowPassword((v) => !v)}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                </div>

                <button type="submit" className="btn btn-filled h-[42px] w-full text-[14px]" disabled={!canSubmit}>
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('auth.login')}
                </button>
            </form>

            <div className="mt-6 border-t border-[var(--color-outline)] pt-5 text-center">
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.noAccount')}{' '}
                    <Link to="/register" className="font-medium text-[var(--color-primary)] hover:underline">
                        {t('auth.register')}
                    </Link>
                </p>
            </div>

            <div className="mt-6 flex items-center gap-5 text-[11px] text-[var(--color-text-disabled)]">
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> SOC2</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> ISO 27001</span>
                <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={12} /> AES-256</span>
            </div>
        </AuthShell>
    );
}
