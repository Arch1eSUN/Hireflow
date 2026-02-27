// ================================================
// HireFlow AI — 登录页 (M3 Design System)
// ================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [focusedField, setFocusedField] = useState<string | null>(null);
    const navigate = useNavigate();
    const login = useAuthStore((state) => state.login);
    const { t } = useI18n();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { email, password });
            const { user, accessToken } = response.data.data;
            login(accessToken, user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || '登录失败，请检查邮箱和密码');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="auth-page">
            {/* Background decorative orbs */}
            <div className="auth-bg-orbs">
                <div className="auth-orb auth-orb--top" />
                <div className="auth-orb auth-orb--bottom" />
            </div>

            <motion.div
                className="auth-container"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
            >
                {/* Logo & Title */}
                <div className="auth-header">
                    <motion.div
                        className="auth-logo"
                        initial={{ scale: 0.8, rotate: -10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 15 }}
                    >
                        <Sparkles size={28} color="white" />
                    </motion.div>
                    <h1 className="auth-title">{t('auth.loginTitle')}</h1>
                    <p className="auth-subtitle">{t('auth.loginSubtitle')}</p>
                </div>

                {/* Glass Card */}
                <div className="auth-card">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="auth-error"
                        >
                            {error}
                        </motion.div>
                    )}

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label className="auth-label">{t('auth.email')}</label>
                            <input
                                type="email"
                                className={`auth-input ${focusedField === 'email' ? 'auth-input--focused' : ''}`}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@company.com"
                                onFocus={() => setFocusedField('email')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">{t('auth.password')}</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className={`auth-input auth-input--password ${focusedField === 'password' ? 'auth-input--focused' : ''}`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    onFocus={() => setFocusedField('password')}
                                    onBlur={() => setFocusedField(null)}
                                />
                                <button
                                    type="button"
                                    className="auth-password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <motion.button
                            type="submit"
                            disabled={loading}
                            className="auth-submit"
                            whileTap={{ scale: 0.98 }}
                        >
                            {loading && <Loader2 size={18} className="animate-spin" />}
                            {loading ? t('common.loading') : t('auth.login')}
                        </motion.button>
                    </form>
                </div>

                <p className="auth-footer">
                    {t('auth.noAccount')}{' '}
                    <Link to="/register" className="auth-link">
                        {t('auth.register')}
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
