// ================================================
// HireFlow AI — 注册页 (M3 Design System)
// ================================================

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, Eye, EyeOff, Building2 } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        companyName: '',
    });
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
            const response = await api.post('/auth/register', formData);
            const { user, accessToken } = response.data.data;
            login(accessToken, user);
            navigate('/dashboard');
        } catch (err: any) {
            setError(err.response?.data?.error || '注册失败，请重试');
        } finally {
            setLoading(false);
        }
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="auth-page">
            {/* Background decorative orbs */}
            <div className="auth-bg-orbs">
                <div className="auth-orb auth-orb--top-left" />
                <div className="auth-orb auth-orb--bottom-right" />
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
                        initial={{ scale: 0.8, rotate: 10 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', damping: 15 }}
                    >
                        <Sparkles size={28} color="white" />
                    </motion.div>
                    <h1 className="auth-title">{t('auth.registerTitle')}</h1>
                    <p className="auth-subtitle">{t('auth.registerSubtitle')}</p>
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

                    <form className="auth-form auth-form--tight" onSubmit={handleSubmit}>
                        <div className="auth-field">
                            <label className="auth-label">{t('auth.fullName')}</label>
                            <input
                                name="name"
                                type="text"
                                className={`auth-input ${focusedField === 'name' ? 'auth-input--focused' : ''}`}
                                value={formData.name}
                                onChange={handleChange}
                                required
                                placeholder="你的姓名"
                                onFocus={() => setFocusedField('name')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">
                                <span className="flex items-center gap-1"><Building2 size={14} /> {t('auth.companyName')}</span>
                            </label>
                            <input
                                name="companyName"
                                type="text"
                                className={`auth-input ${focusedField === 'company' ? 'auth-input--focused' : ''}`}
                                value={formData.companyName}
                                onChange={handleChange}
                                required
                                placeholder="你的公司"
                                onFocus={() => setFocusedField('company')}
                                onBlur={() => setFocusedField(null)}
                            />
                        </div>

                        <div className="auth-field">
                            <label className="auth-label">{t('auth.email')}</label>
                            <input
                                name="email"
                                type="email"
                                className={`auth-input ${focusedField === 'email' ? 'auth-input--focused' : ''}`}
                                value={formData.email}
                                onChange={handleChange}
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
                                    name="password"
                                    type={showPassword ? 'text' : 'password'}
                                    className={`auth-input auth-input--password ${focusedField === 'password' ? 'auth-input--focused' : ''}`}
                                    value={formData.password}
                                    onChange={handleChange}
                                    required
                                    minLength={6}
                                    placeholder="至少 6 位"
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
                            {loading ? t('common.loading') : t('auth.register')}
                        </motion.button>
                    </form>
                </div>

                <p className="auth-footer">
                    {t('auth.hasAccount')}{' '}
                    <Link to="/login" className="auth-link">
                        {t('auth.login')}
                    </Link>
                </p>
            </motion.div>
        </div>
    );
}
