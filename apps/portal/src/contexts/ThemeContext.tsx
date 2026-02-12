import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
    theme: Theme;
    resolvedTheme: ResolvedTheme;
    setTheme: (theme: Theme) => void;
    isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemTheme(): ResolvedTheme {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolveTheme(theme: Theme): ResolvedTheme {
    if (theme === 'system') return getSystemTheme();
    return theme;
}

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('hireflow-theme') as Theme) || 'light';
        }
        return 'light';
    });

    const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(resolveTheme(theme));

    // 应用主题到 DOM
    useEffect(() => {
        const resolved = resolveTheme(theme);
        setResolvedTheme(resolved);
        document.documentElement.classList.toggle('dark', resolved === 'dark');
        localStorage.setItem('hireflow-theme', theme);
    }, [theme]);

    // 监听系统主题变化
    useEffect(() => {
        if (theme !== 'system') return;
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => setResolvedTheme(getSystemTheme());
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, [theme]);

    const setTheme = useCallback((t: Theme) => setThemeState(t), []);
    const isDark = resolvedTheme === 'dark';

    const value = useMemo(() => ({ theme, resolvedTheme, setTheme, isDark }), [theme, resolvedTheme, setTheme, isDark]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export function useTheme(): ThemeContextType {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
    return ctx;
}
