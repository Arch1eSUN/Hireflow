import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, CheckCircle2, LayoutDashboard, Search, FileBarChart, ShieldCheck } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

export default function LandingPage() {
    const navigate = useNavigate();
    const { t } = useI18n();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Helper for feature items using translation keys
    const features = [
        {
            icon: LayoutDashboard,
            title: t('landing.feature.analytics.title'),
            desc: t('landing.feature.analytics.desc')
        },
        {
            icon: Search,
            title: t('landing.feature.resume.title'),
            desc: t('landing.feature.resume.desc')
        },
        {
            icon: ShieldCheck,
            title: t('landing.feature.interview.title'),
            desc: t('landing.feature.interview.desc')
        }
    ];

    return (
        <div className="min-h-screen bg-[var(--color-surface-dim)] font-sans relative overflow-x-hidden">

            {/* Top Navigation */}
            <nav className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[var(--color-surface)] shadow-md py-3' : 'bg-transparent py-5'}`}>
                <div className="container mx-auto px-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-[var(--color-primary)] rounded-[var(--radius-md)] flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Sparkles size={16} className="text-white" />
                        </div>
                        <span className="text-[18px] font-semibold text-[var(--color-text-primary)]">{t('app.name')}</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <LanguageSwitcher />
                        <Link to="/login" className="text-[14px] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors">
                            {t('auth.login')}
                        </Link>
                        <Link to="/register" className="btn btn-filled px-5 h-[36px] text-[14px]">
                            {t('auth.register')}
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6 relative min-h-[85vh] flex flex-col justify-center">
                {/* Background Blobs (CSS only) */}
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-blue-400/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-purple-400/5 rounded-full blur-3xl -z-10 animate-pulse delay-1000"></div>

                <div className="container mx-auto relative z-10 text-center max-w-5xl">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-info-bg)] border border-blue-100 text-[var(--color-primary)] text-[12px] font-medium mb-6">
                        <Sparkles size={12} />
                        <span>{t('landing.hero.badge')}</span>
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold text-[var(--color-text-primary)] mb-6 leading-tight tracking-tight">
                        {t('landing.hero.title')}<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--color-primary)] to-purple-600">
                            {t('landing.hero.titleHighlight')}
                        </span>
                    </h1>

                    <p className="text-xl text-[var(--color-text-secondary)] mb-10 max-w-2xl mx-auto leading-relaxed">
                        {t('landing.hero.subtitle')}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link to="/register" className="btn btn-filled h-[52px] px-8 text-[16px] rounded-full shadow-lg shadow-blue-500/25 hover:shadow-xl hover:bg-blue-600 transition-all flex items-center gap-2">
                            {t('landing.cta.start')} <ArrowRight size={18} />
                        </Link>
                    </div>
                </div>
            </section>

            {/* Value Props */}
            <section className="py-24 bg-[var(--color-surface)] border-t border-[var(--color-outline)]">
                <div className="container mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                        {features.map((item, i) => (
                            <div key={i} className="flex flex-col items-center text-center">
                                <div className="w-14 h-14 bg-[var(--color-surface-dim)] rounded-2xl flex items-center justify-center mb-6 text-[var(--color-primary)]">
                                    <item.icon size={28} />
                                </div>
                                <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-3">{item.title}</h3>
                                <p className="text-[var(--color-text-secondary)] leading-relaxed max-w-xs">{item.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="py-12 bg-[var(--color-surface-dim)] border-t border-[var(--color-outline)] text-center">
                <p className="text-[var(--color-text-secondary)] text-sm">{t('landing.footer.rights')}</p>
            </footer>
        </div>
    );
}
