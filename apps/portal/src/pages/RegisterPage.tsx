import React, { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import AuthShell from '@/components/auth/AuthShell';
import PasswordStrengthMeter from '@/components/auth/PasswordStrengthMeter';

function extractAuthError(error: any, fallback: string): string {
    const payload = error?.response?.data?.error;
    if (typeof payload === 'string' && payload.trim().length > 0) {
        return payload;
    }
    if (payload?.formErrors?.length) {
        return payload.formErrors[0];
    }
    if (payload?.fieldErrors) {
        const firstField = Object.values(payload.fieldErrors).find((items) => Array.isArray(items) && items.length > 0) as string[] | undefined;
        if (firstField?.[0]) return firstField[0];
    }
    return fallback;
}

export default function RegisterPage() {
    const { t } = useI18n();
    const [formData, setFormData] = useState({
        name: '',
        companyName: '',
        companySize: '1-20',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);

    const normalizedEmail = useMemo(() => formData.email.trim().toLowerCase(), [formData.email]);
    const passwordsMatched = formData.password === formData.confirmPassword;
    const canSubmit =
        !isLoading &&
        formData.name.trim().length >= 2 &&
        formData.companyName.trim().length >= 2 &&
        normalizedEmail.length > 0 &&
        formData.password.length >= 6 &&
        passwordsMatched;

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!passwordsMatched) {
            setError(t('auth.validation.passwordMismatch'));
            return;
        }

        setIsLoading(true);
        try {
            const response = await api.post('/auth/register', {
                name: formData.name.trim(),
                companyName: formData.companyName.trim(),
                companySize: formData.companySize,
                email: normalizedEmail,
                password: formData.password,
            });

            const payload = response.data?.data;
            if (!payload?.accessToken || !payload?.user) {
                throw new Error('Invalid register payload');
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

    const handleChange = (
        event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    return (
        <AuthShell mode="register" title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
            {error && (
                <div className="mb-4 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] p-3 text-[13px] text-[var(--color-error)]">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.fullName')}</label>
                    <input
                        name="name"
                        type="text"
                        className="input w-full"
                        placeholder={t('candidate.placeholder.name')}
                        value={formData.name}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.companyName')}</label>
                    <div className="relative">
                        <input
                            name="companyName"
                            type="text"
                            className="input w-full pl-10"
                            placeholder="Acme Inc."
                            value={formData.companyName}
                            onChange={handleChange}
                            required
                        />
                        <Building2 size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.field.companySize')}</label>
                    <select
                        name="companySize"
                        value={formData.companySize}
                        onChange={handleChange}
                        className="input w-full"
                    >
                        <option value="1-20">{t('auth.companySize.1_20')}</option>
                        <option value="21-100">{t('auth.companySize.21_100')}</option>
                        <option value="101-500">{t('auth.companySize.101_500')}</option>
                        <option value="500+">{t('auth.companySize.500_plus')}</option>
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.email')}</label>
                    <input
                        name="email"
                        type="email"
                        className="input w-full"
                        placeholder={t('auth.placeholder.email')}
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.password')}</label>
                    <div className="relative">
                        <input
                            name="password"
                            type={showPassword ? 'text' : 'password'}
                            className="input w-full pr-10"
                            placeholder={t('auth.password')}
                            value={formData.password}
                            onChange={handleChange}
                            required
                            minLength={6}
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            onClick={() => setShowPassword((v) => !v)}
                        >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    <PasswordStrengthMeter password={formData.password} />
                </div>

                <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-[var(--color-text-secondary)]">{t('auth.confirmPassword')}</label>
                    <div className="relative">
                        <input
                            name="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            className="input w-full pr-10"
                            placeholder={t('auth.confirmPassword')}
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            required
                        />
                        <button
                            type="button"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                            onClick={() => setShowConfirmPassword((v) => !v)}
                        >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                    </div>
                    {!passwordsMatched && formData.confirmPassword.length > 0 && (
                        <p className="text-[12px] text-[var(--color-error)]">{t('auth.validation.passwordMismatch')}</p>
                    )}
                </div>

                <button type="submit" className="btn btn-filled h-[42px] w-full text-[14px]" disabled={!canSubmit}>
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : t('auth.register')}
                </button>
            </form>

            <div className="mt-6 border-t border-[var(--color-outline)] pt-5 text-center">
                <p className="text-[13px] text-[var(--color-text-secondary)]">
                    {t('auth.hasAccount')}{' '}
                    <Link to="/login" className="font-medium text-[var(--color-primary)] hover:underline">
                        {t('auth.login')}
                    </Link>
                </p>
            </div>
        </AuthShell>
    );
}
