import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard, Users, Briefcase, Video, GitBranch, BarChart3,
    UsersRound, Settings, ChevronLeft, ChevronRight, Search, Moon, Sun,
    ShieldCheck,
    LogOut, User, Languages, Menu
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@hireflow/i18n/react';
import { cn, getInitials } from '@hireflow/utils/src/index';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import { NotificationPopover } from './NotificationPopover';
import { CommandPalette } from './CommandPalette';

// Nav Configuration
const getNavItems = (t: (key: string) => string) => [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Users, label: t('nav.candidates'), path: '/candidates' },
    { icon: Briefcase, label: t('nav.jobs'), path: '/jobs' },
    { icon: Video, label: t('nav.interviews'), path: '/interviews' },
    { icon: ShieldCheck, label: t('nav.integrity'), path: '/integrity' },
    { icon: GitBranch, label: t('nav.screening'), path: '/screening' },
    { icon: BarChart3, label: t('nav.analytics'), path: '/analytics' },
    { icon: UsersRound, label: t('nav.team'), path: '/team' },
];

const Layout: React.FC = () => {
    // State Persistence for Sidebar
    const [collapsed, setCollapsed] = useState(() => {
        const saved = localStorage.getItem('portal.sidebar.collapsed');
        return saved === 'true';
    });

    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { setTheme, isDark } = useTheme();
    const { t, locale, setLocale } = useI18n();
    const { user, logout } = useAuthStore();

    const navItems = getNavItems(t);
    const currentUser = user || { name: 'Admin', role: t('team.role.viewer'), email: 'admin@hireflow.ai' };
    const sidebarWidth = collapsed ? 72 : 256;

    // Toggle Sidebar
    const toggleSidebar = () => {
        const newState = !collapsed;
        setCollapsed(newState);
        localStorage.setItem('portal.sidebar.collapsed', String(newState));
    };

    const handleLogout = async () => {
        try {
            await api.post('/auth/logout');
        } catch {
            // Ignore network failures and still clear local session.
        } finally {
            logout();
            navigate('/login', { replace: true });
        }
    };

    const activeItem = navItems.find((n) => location.pathname.startsWith(n.path));
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform);
    const shortcutText = isMac ? '⌘K' : 'Ctrl K';

    const openCommandPalette = () => {
        document.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k',
            metaKey: isMac,
            ctrlKey: !isMac,
            bubbles: true,
        }));
    };

    return (
        <div className="h-screen w-screen overflow-hidden bg-[var(--color-surface-dim)] text-[var(--color-text-primary)] font-sans flex">
            {/* Sidebar (left rail, width animation) */}
            <aside
                className="sidebar h-screen flex flex-col flex-shrink-0 z-[var(--z-sidebar)] border-r border-[var(--color-outline)] bg-[var(--color-surface)] transition-[width] duration-300 ease-in-out"
                style={{ width: `${sidebarWidth}px` }}
                aria-label={t('nav.dashboard')}
            >
                {/* Brand */}
                <div className="h-[56px] flex items-center px-0 justify-center border-b border-[var(--color-outline)] transition-all">
                    <div className="w-8 h-8 rounded bg-[var(--color-primary)] flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                        H
                    </div>
                    {!collapsed && (
                        <span className="ml-3 font-medium text-[15px] text-[var(--color-text-primary)] tracking-tight whitespace-nowrap overflow-hidden animate-in fade-in duration-200">
                            {t('app.name')}
                        </span>
                    )}
                </div>

                {/* Nav Items */}
                <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname.startsWith(item.path);
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    "flex items-center h-10 px-0 mx-2 rounded-[var(--radius-sm)] transition-colors relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                                    isActive
                                        ? "bg-[var(--color-info-bg)] text-[var(--color-primary)] font-medium"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)]",
                                    collapsed ? "justify-center w-[calc(100%-16px)]" : "justify-start px-3 w-[calc(100%-16px)]"
                                )}
                                aria-label={item.label}
                                aria-current={isActive ? 'page' : undefined}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon
                                    size={20}
                                    className={cn("flex-shrink-0 transition-colors", isActive ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]")}
                                />
                                {!collapsed && (
                                    <span className="ml-3 text-[14px] truncate transition-opacity duration-200">
                                        {item.label}
                                    </span>
                                )}
                                {isActive && !collapsed && (
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-[var(--color-primary)] rounded-r opacity-100" />
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="p-2 border-t border-[var(--color-outline)] space-y-1 bg-[var(--color-surface)] sticky bottom-0">
                    <button
                        onClick={() => navigate('/settings')}
                        className={cn(
                            "flex items-center h-10 mx-0 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                            collapsed ? "justify-center w-full" : "justify-start px-3 w-full"
                        )}
                        aria-label={t('nav.settings')}
                        title={collapsed ? t('nav.settings') : undefined}
                    >
                        <Settings size={20} />
                        {!collapsed && <span className="ml-3 text-[14px] truncate">{t('nav.settings')}</span>}
                    </button>

                    <button
                        onClick={toggleSidebar}
                        className={cn(
                            "flex items-center h-10 mx-0 rounded-[var(--radius-sm)] hover:bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]",
                            collapsed ? "justify-center w-full" : "justify-start px-3 w-full"
                        )}
                        aria-label={collapsed ? t('nav.expand') : t('nav.collapse')}
                        title={collapsed ? t('nav.expand') : undefined}
                    >
                        {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
                        {!collapsed && <span className="ml-3 text-[14px] truncate">{t('nav.collapse')}</span>}
                    </button>
                </div>
            </aside>

            {/* Main Layout */}
            <div className="flex-1 h-screen flex flex-col min-w-0 bg-[var(--color-surface-dim)] relative">

                {/* Topbar */}
                <header className="topbar h-[56px] px-6 flex-shrink-0">
                    <div className="flex items-center min-w-0">
                        {/* Mobile Trigger (Hidden on Desktop) */}
                        <button className="md:hidden mr-4 p-2 -ml-2 text-[var(--color-text-secondary)]">
                            <Menu size={20} />
                        </button>
                        <h1 className="text-[18px] font-medium text-[var(--color-text-primary)] truncate">
                            {activeItem?.label || t('nav.dashboard')}
                        </h1>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Search Bar - Visual only, CommandPalette handles logic */}
                        <div
                            className="relative hidden md:flex items-center group cursor-text"
                            onClick={openCommandPalette}
                        >
                            <Search className="absolute left-3 text-[var(--color-text-secondary)] group-focus-within:text-[var(--color-primary)] transition-colors" size={16} />
                            <input
                                type="text"
                                placeholder={t('common.search')}
                                className="h-[38px] w-[240px] lg:w-[320px] bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[999px] pl-9 pr-4 text-sm focus:border-[var(--color-primary)] focus:bg-[var(--color-surface)] transition-all outline-none placeholder-[var(--color-text-disabled)]"
                                readOnly
                                onFocus={openCommandPalette}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                                <span className="text-[10px] bg-[var(--color-surface)] border border-[var(--color-outline)] px-1.5 rounded text-[var(--color-text-secondary)]">{shortcutText}</span>
                            </div>
                        </div>

                        <div className="w-[1px] h-6 bg-[var(--color-outline)] mx-1" />

                        {/* Topbar Actions */}
                        <button
                            className="h-9 min-w-[62px] px-2 rounded-[var(--radius-sm)] border border-[var(--color-outline)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)] flex items-center justify-center gap-1.5 text-[12px] font-medium text-[var(--color-text-secondary)]"
                            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
                            aria-label={t('settings.appearance.language')}
                            title={locale === 'zh-CN' ? t('common.language.switch.en') : t('common.language.switch.zh')}
                        >
                            <Languages size={15} />
                            <span>{locale === 'zh-CN' ? 'EN' : '中'}</span>
                        </button>

                        <button
                            className="btn-icon w-9 h-9"
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                            aria-label={t('settings.appearance.theme')}
                            title={isDark ? t('common.theme.switch.light') : t('common.theme.switch.dark')}
                        >
                            {isDark ? <Sun size={18} /> : <Moon size={18} />}
                        </button>

                        <NotificationPopover />

                        {/* User Menu */}
                        <div className="relative ml-2">
                            <button
                                className="w-8 h-8 rounded-full bg-[var(--color-primary)] text-white flex items-center justify-center text-xs font-medium hover:opacity-90 ring-offset-2 focus:ring-2 focus:ring-[var(--color-primary)] outline-none transition-shadow"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                                aria-label={t('common.more')}
                                aria-expanded={userMenuOpen}
                            >
                                {getInitials(currentUser.name)}
                            </button>

                            {/* Dropdown */}
                            {userMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-[var(--z-dropdown)]" onClick={() => setUserMenuOpen(false)} aria-hidden="true" />
                                    <div className="absolute right-0 top-10 w-64 bg-[var(--color-surface)] border border-[var(--color-outline)] shadow-[var(--shadow-dropdown)] rounded-[var(--radius-md)] py-2 z-[var(--z-tooltip)] animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                                        <div className="px-4 py-3 border-b border-[var(--color-outline)] mb-1">
                                            <p className="font-medium text-[var(--color-text-primary)] text-sm">{currentUser.name}</p>
                                            <p className="text-xs text-[var(--color-text-secondary)] truncate">{currentUser.email || 'user@example.com'}</p>
                                        </div>
                                        <button className="w-full text-left px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] flex items-center gap-2 transition-colors">
                                            <User size={16} className="text-[var(--color-text-secondary)]" /> {t('common.name')}
                                        </button>
                                        <button
                                            className="w-full text-left px-4 py-2 text-sm text-[var(--color-error)] hover:bg-[var(--color-error-bg)] flex items-center gap-2 transition-colors"
                                            onClick={handleLogout}
                                        >
                                            <LogOut size={16} /> {t('auth.logout')}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </header>

                <CommandPalette />

                {/* Page Content Scroll Area */}
                <main className="flex-1 overflow-auto p-6 scroll-smooth w-full relative z-[var(--z-content)]">
                    <div className="max-w-[1600px] mx-auto min-h-full flex flex-col">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
