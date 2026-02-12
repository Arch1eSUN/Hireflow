// ================================================
// HireFlow AI — i18n 国际化引擎
// 主语言: 中文 (zh-CN)
// ================================================

import zh from './locales/zh';
import en from './locales/en';
import type { SupportedLocale } from '@hireflow/types';

export type { SupportedLocale };

// 语言包映射
const messages: Record<SupportedLocale, Record<string, string>> = {
    'zh-CN': zh,
    'en-US': en,
};

// 默认语言
const DEFAULT_LOCALE: SupportedLocale = 'zh-CN';

/**
 * 获取当前浏览器语言或 URL 参数指定的语言
 */
export function detectLocale(): SupportedLocale {
    if (typeof window === 'undefined') return DEFAULT_LOCALE;

    // 1. 检查 URL 参数 ?lang=en
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam === 'en' || langParam === 'en-US') return 'en-US';
    if (langParam === 'zh' || langParam === 'zh-CN') return 'zh-CN';

    // 2. 检查 localStorage
    const saved = localStorage.getItem('hireflow-locale') as SupportedLocale | null;
    if (saved && messages[saved]) return saved;

    // 3. 检查浏览器语言
    const browserLang = navigator.language;
    if (browserLang.startsWith('en')) return 'en-US';

    // 默认中文
    return DEFAULT_LOCALE;
}

/**
 * 保存语言偏好到 localStorage
 */
export function saveLocale(locale: SupportedLocale): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('hireflow-locale', locale);
    }
}

/**
 * 翻译函数 — 支持模板变量插值
 * @example t('zh-CN', 'dashboard.interviewsToday', { count: 3 })
 * // → "今天有 3 场面试待进行"
 */
export function t(
    locale: SupportedLocale,
    key: string,
    params?: Record<string, string | number>
): string {
    const dict = messages[locale] || messages[DEFAULT_LOCALE];
    let text = dict[key] || messages[DEFAULT_LOCALE][key] || key;

    // 模板变量替换 {variable}
    if (params) {
        Object.entries(params).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
    }

    return text;
}

/**
 * 获取所有可用语言列表
 */
export function getAvailableLocales(): { code: SupportedLocale; label: string }[] {
    return [
        { code: 'zh-CN', label: '简体中文' },
        { code: 'en-US', label: 'English' },
    ];
}

// 导出语言包供直接引用
export { zh, en };
export { DEFAULT_LOCALE };
