// ================================================
// HireFlow AI — 企业端 Layout (Google M3 风格)
// 侧边栏 + 顶栏 + 内容区
// ================================================

import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, Briefcase, Video, GitBranch, BarChart3,
    UsersRound, Settings, Menu, ChevronLeft, Bell, Search, Moon, Sun,
    Monitor, LogOut, User, Globe,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useI18n } from '@hireflow/i18n/src/react';
import { cn, getGreeting, getInitials } from '@hireflow/utils/src/index';

// 导航项数据
const getNavItems = (t: (key: string) => string) => [
    { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/dashboard' },
    { icon: Users, label: t('nav.candidates'), path: '/candidates' },
    { icon: Briefcase, label: t('nav.jobs'), path: '/jobs' },
    { icon: Video, label: t('nav.interviews'), path: '/interviews' },
    { icon: GitBranch, label: t('nav.screening'), path: '/screening' },
    { icon: BarChart3, label: t('nav.analytics'), path: '/analytics' },
    { icon: UsersRound, label: t('nav.team'), path: '/team' },
];

const Layout: React.FC = () => {
    const [collapsed, setCollapsed] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, setTheme, isDark } = useTheme();
    const { t, locale, setLocale, availableLocales } = useI18n();

    const navItems = getNavItems(t);
    const sidebarWidth = collapsed ? 72 : 256;

    // 模拟当前用户
    const currentUser = { name: '张通', role: 'HR 经理', avatar: '' };

    return (
        <div className="flex min-h-screen" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            {/* ========== 侧边栏 ========== */}
            <aside
                className="sidebar"
                style={{ width: sidebarWidth }}
            >
                {/* Logo */}
                <div
                    className="flex items-center gap-3 px-4 shrink-0"
                    style={{ height: 'var(--topbar-height)' }}
                >
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'var(--color-primary)' }}
                    >
                        <span className="text-white font-bold text-sm">H</span>
                    </div>
                    <AnimatePresence>
                        {!collapsed && (
                            <motion.span
                                initial={{ opacity: 0, width: 0 }}
                                animate={{ opacity: 1, width: 'auto' }}
                                exit={{ opacity: 0, width: 0 }}
                                className="text-title-medium whitespace-nowrap overflow-hidden"
                                style={{ color: 'var(--color-on-surface)' }}
                            >
                                HireFlow
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                {/* 导航列表 */}
                <nav className="flex-1 py-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path ||
                            (item.path !== '/' && location.pathname.startsWith(item.path));
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn('nav-item w-full', isActive && 'active')}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon className="nav-icon" strokeWidth={1.5} />
                                <AnimatePresence>
                                    {!collapsed && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="overflow-hidden"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                            </button>
                        );
                    })}
                </nav>

                {/* 底部：设置 + 折叠按钮 */}
                <div className="border-t py-2" style={{ borderColor: 'var(--color-outline)' }}>
                    <button
                        onClick={() => navigate('/settings')}
                        className={cn(
                            'nav-item w-full',
                            location.pathname === '/settings' && 'active'
                        )}
                        title={collapsed ? t('nav.settings') : undefined}
                    >
                        <Settings className="nav-icon" strokeWidth={1.5} />
                        {!collapsed && <span>{t('nav.settings')}</span>}
                    </button>

                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="nav-item w-full"
                        title={collapsed ? t('nav.expand') : t('nav.collapse')}
                    >
                        {collapsed ? (
                            <Menu className="nav-icon" strokeWidth={1.5} />
                        ) : (
                            <>
                                <ChevronLeft className="nav-icon" strokeWidth={1.5} />
                                <span>{t('nav.collapse')}</span>
                            </>
                        )}
                    </button>
                </div>
            </aside>

            {/* ========== 右侧内容区 ========== */}
            <div className="flex-1 flex flex-col" style={{ marginLeft: sidebarWidth, transition: 'margin-left var(--duration-standard) var(--ease-standard)' }}>
                {/* 顶栏 */}
                <header className="topbar">
                    {/* 左侧：面包屑 */}
                    <div className="flex items-center gap-2">
                        <span className="text-title-medium" style={{ color: 'var(--color-on-surface)' }}>
                            {navItems.find((n) => location.pathname.startsWith(n.path))?.label || t('nav.dashboard')}
                        </span>
                    </div>

                    {/* 右侧：操作按钮 */}
                    <div className="flex items-center gap-1">
                        {/* 搜索 */}
                        <button className="btn-icon" title={t('common.search')}>
                            <Search size={20} />
                        </button>

                        {/* 语言切换 */}
                        <button
                            className="btn-icon"
                            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
                            title={locale === 'zh-CN' ? 'English' : '中文'}
                        >
                            <Globe size={20} />
                        </button>

                        {/* 主题切换 */}
                        <button
                            className="btn-icon"
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                            title={isDark ? t('settings.appearance.theme.light') : t('settings.appearance.theme.dark')}
                        >
                            {isDark ? <Sun size={20} /> : <Moon size={20} />}
                        </button>

                        {/* 通知 */}
                        <div className="relative">
                            <button
                                className="btn-icon"
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                            >
                                <Bell size={20} />
                                <span
                                    className="absolute top-1.5 right-1.5 badge-sm"
                                    style={{ backgroundColor: 'var(--color-error)' }}
                                />
                            </button>
                        </div>

                        {/* 用户头像 */}
                        <div className="relative ml-2">
                            <button
                                className="flex items-center gap-2 px-2 py-1 rounded-full hover:opacity-80 transition-opacity"
                                onClick={() => setUserMenuOpen(!userMenuOpen)}
                            >
                                <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                                    style={{
                                        backgroundColor: 'var(--color-primary-container)',
                                        color: 'var(--color-primary)',
                                    }}
                                >
                                    {getInitials(currentUser.name)}
                                </div>
                            </button>

                            {/* 用户下拉菜单 */}
                            <AnimatePresence>
                                {userMenuOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -8 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -8 }}
                                            transition={{ duration: 0.15 }}
                                            className="absolute right-0 top-12 w-56 z-50 card-elevated p-2"
                                            style={{ borderRadius: 'var(--radius-md)' }}
                                        >
                                            <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--color-outline)' }}>
                                                <p className="text-title-medium">{currentUser.name}</p>
                                                <p className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>
                                                    {currentUser.role}
                                                </p>
                                            </div>
                                            <button className="nav-item w-full">
                                                <User size={18} />
                                                <span>个人资料</span>
                                            </button>
                                            <button className="nav-item w-full" style={{ color: 'var(--color-error)' }}>
                                                <LogOut size={18} />
                                                <span>{t('auth.logout')}</span>
                                            </button>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* 主内容区 */}
                <main className="flex-1 p-6">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                    >
                        <Outlet />
                    </motion.div>
                </main>
            </div>
        </div>
    );
};

export default Layout;
