// ================================================
// HireFlow AI — React i18n Hook & Provider
// ================================================

import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { t, detectLocale, saveLocale, getAvailableLocales, DEFAULT_LOCALE } from './index';
import type { SupportedLocale } from '@hireflow/types';

interface I18nContextType {
    locale: SupportedLocale;
    setLocale: (locale: SupportedLocale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    availableLocales: { code: SupportedLocale; label: string }[];
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

/**
 * i18n Provider — 包裹应用根组件
 */
export const I18nProvider: React.FC<{ children: ReactNode; defaultLocale?: SupportedLocale }> = ({
    children,
    defaultLocale,
}) => {
    const [locale, setLocaleState] = useState<SupportedLocale>(defaultLocale || detectLocale());

    const setLocale = useCallback((newLocale: SupportedLocale) => {
        setLocaleState(newLocale);
        saveLocale(newLocale);
        // 更新 HTML lang 属性
        document.documentElement.lang = newLocale === 'zh-CN' ? 'zh' : 'en';
    }, []);

    const translate = useCallback(
        (key: string, params?: Record<string, string | number>) => t(locale, key, params),
        [locale]
    );

    const value = useMemo(
        () => ({
            locale,
            setLocale,
            t: translate,
            availableLocales: getAvailableLocales(),
        }),
        [locale, setLocale, translate]
    );

    return React.createElement(I18nContext.Provider, { value }, children);
};

/**
 * useI18n — 在组件中使用翻译
 * @example
 * const { t, locale, setLocale } = useI18n();
 * <h1>{t('dashboard.greeting.morning')}</h1>
 */
export function useI18n(): I18nContextType {
    const context = useContext(I18nContext);
    if (!context) {
        // 降级处理：不在 Provider 中时使用默认语言
        return {
            locale: DEFAULT_LOCALE,
            setLocale: () => { },
            t: (key: string, params?: Record<string, string | number>) => t(DEFAULT_LOCALE, key, params),
            availableLocales: getAvailableLocales(),
        };
    }
    return context;
}
