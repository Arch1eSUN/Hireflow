import React from 'react';
import { useI18n } from '@hireflow/i18n/react';
import { Globe } from 'lucide-react';

export const LanguageSwitcher: React.FC<{ variant?: 'light' | 'dark' }> = ({ variant = 'light' }) => {
    const { locale, setLocale, availableLocales } = useI18n();

    const toggleLocale = () => {
        const next = locale === 'zh-CN' ? 'en-US' : 'zh-CN';
        setLocale(next);
    };

    return (
        <button
            onClick={toggleLocale}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${variant === 'dark'
                    ? 'bg-white/10 text-white hover:bg-white/20'
                    : 'bg-white border border-[var(--color-outline)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]'
                }`}
        >
            <Globe size={14} />
            <span>{locale === 'zh-CN' ? 'English' : '简体中文'}</span>
        </button>
    );
};
