import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LayoutDashboard, Users, Video, GitBranch, Settings, Briefcase,
    Menu, ChevronLeft, Bell, Search, Moon, Sun, LogOut, User,
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn, getInitials } from '@/lib/utils';
import { MOCK_NOTIFICATIONS } from '@/data/mockData';

interface NavItemData {
    icon: React.ElementType;
    label: string;
    path: string;
    badge?: number;
}

const navItems: NavItemData[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Briefcase, label: 'Jobs', path: '/jobs' },
    { icon: Users, label: 'Candidates', path: '/candidates' },
    { icon: Video, label: 'Interview', path: '/interview-room' },
    { icon: GitBranch, label: 'Screening', path: '/screening' },
    { icon: Settings, label: 'Settings', path: '/settings' },
];

const Layout: React.FC = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const { theme, toggleTheme, isDark } = useTheme();

    const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

    return (
        <div className={cn('flex min-h-screen transition-colors duration-300',
            isDark ? 'bg-[#141218] text-[#E6E1E5]' : 'bg-[#F8F7FC] text-[#1C1B1F]'
        )}>
            {/* =================== */}
            {/* Sidebar Navigation  */}
            {/* =================== */}
            <aside
                className={cn(
                    'fixed inset-y-0 left-0 z-30 flex flex-col transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]',
                    sidebarOpen ? 'w-[260px]' : 'w-[72px]',
                    isDark ? 'bg-[#1C1B20] border-r border-white/5' : 'bg-white border-r border-slate-200/80'
                )}
            >
                {/* Logo */}
                <div className="p-5 flex items-center gap-3">
                    <div className="relative w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-primary-500/20">
                        <GitBranch className="text-white w-5 h-5" />
                        <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-white dark:border-[#1C1B20]" />
                    </div>
                    <AnimatePresence>
                        {sidebarOpen && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                transition={{ duration: 0.2 }}
                            >
                                <h1 className="font-bold text-lg tracking-tight">HireFlow</h1>
                                <p className={cn('text-[10px] font-medium -mt-0.5', isDark ? 'text-primary-400' : 'text-primary-500')}>AI Recruiting</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 px-3 mt-2 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        return (
                            <button
                                key={item.path}
                                onClick={() => navigate(item.path)}
                                className={cn(
                                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative',
                                    sidebarOpen ? '' : 'justify-center',
                                    isActive
                                        ? isDark
                                            ? 'bg-primary-600/15 text-primary-300'
                                            : 'bg-primary-50 text-primary-700'
                                        : isDark
                                            ? 'text-slate-400 hover:bg-white/5 hover:text-white'
                                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeNav"
                                        className={cn(
                                            'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full',
                                            isDark ? 'bg-primary-400' : 'bg-primary-600'
                                        )}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                                <item.icon
                                    className={cn(
                                        'w-5 h-5 shrink-0',
                                        isActive
                                            ? isDark ? 'text-primary-400' : 'text-primary-600'
                                            : 'group-hover:text-primary-500'
                                    )}
                                />
                                <AnimatePresence>
                                    {sidebarOpen && (
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="font-medium text-sm whitespace-nowrap"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                </AnimatePresence>
                                {item.badge && sidebarOpen && (
                                    <span className="ml-auto text-[10px] font-bold bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center">
                                        {item.badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* Sidebar Footer */}
                <div className={cn('p-3 border-t', isDark ? 'border-white/5' : 'border-slate-100')}>
                    {sidebarOpen && (
                        <div className={cn('flex items-center gap-3 p-3 rounded-xl mb-2', isDark ? 'bg-white/5' : 'bg-slate-50')}>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                TZ
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold truncate">Tom Zhang</p>
                                <p className={cn('text-xs truncate', isDark ? 'text-slate-400' : 'text-slate-500')}>HR Manager</p>
                            </div>
                            <button className={cn('p-1.5 rounded-lg transition-colors', isDark ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-400')}>
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className={cn(
                            'w-full p-2.5 rounded-xl flex items-center justify-center transition-colors',
                            isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-400'
                        )}
                    >
                        {sidebarOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>
            </aside>

            {/* =================== */}
            {/* Main Content Area   */}
            {/* =================== */}
            <main className={cn('flex-1 transition-all duration-300', sidebarOpen ? 'ml-[260px]' : 'ml-[72px]')}>
                {/* Top Header Bar */}
                <header className={cn(
                    'sticky top-0 z-20 h-16 flex items-center justify-between px-8 transition-colors duration-300',
                    isDark ? 'bg-[#141218]/80 backdrop-blur-xl border-b border-white/5' : 'bg-[#F8F7FC]/80 backdrop-blur-xl border-b border-slate-200/60'
                )}>
                    {/* Search */}
                    <div className="flex items-center gap-3">
                        <div className={cn(
                            'flex items-center gap-2 px-4 py-2 rounded-xl transition-all w-80',
                            isDark ? 'bg-white/5 border border-white/5' : 'bg-white border border-slate-200',
                            searchOpen ? 'ring-2 ring-primary-500/30' : ''
                        )}>
                            <Search className="w-4 h-4 text-slate-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search candidates, jobs..."
                                className={cn(
                                    'bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400',
                                    isDark ? 'text-white' : 'text-slate-900'
                                )}
                                onFocus={() => setSearchOpen(true)}
                                onBlur={() => setSearchOpen(false)}
                            />
                            <kbd className={cn(
                                'hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono',
                                isDark ? 'bg-white/10 text-slate-400' : 'bg-slate-100 text-slate-400'
                            )}>
                                ⌘K
                            </kbd>
                        </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-2">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className={cn(
                                'p-2.5 rounded-xl transition-all',
                                isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                            )}
                            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        {/* Notifications */}
                        <div className="relative">
                            <button
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className={cn(
                                    'p-2.5 rounded-xl transition-all relative',
                                    isDark ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
                                )}
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
                                )}
                            </button>

                            {/* Notification Dropdown */}
                            <AnimatePresence>
                                {notificationsOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                                        <motion.div
                                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                            transition={{ duration: 0.15 }}
                                            className={cn(
                                                'absolute right-0 top-12 w-96 rounded-2xl shadow-xl z-50 overflow-hidden',
                                                isDark ? 'bg-[#2B2930] border border-white/10' : 'bg-white border border-slate-200'
                                            )}
                                        >
                                            <div className={cn('px-5 py-4 border-b', isDark ? 'border-white/10' : 'border-slate-100')}>
                                                <h3 className="font-semibold">Notifications</h3>
                                                <p className={cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>{unreadCount} unread</p>
                                            </div>
                                            <div className="max-h-80 overflow-y-auto">
                                                {MOCK_NOTIFICATIONS.map((notif) => (
                                                    <div
                                                        key={notif.id}
                                                        className={cn(
                                                            'px-5 py-3 flex items-start gap-3 cursor-pointer transition-colors',
                                                            !notif.read && (isDark ? 'bg-primary-500/5' : 'bg-primary-50/50'),
                                                            isDark ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                                                        )}
                                                    >
                                                        <div className={cn(
                                                            'w-2 h-2 rounded-full mt-2 shrink-0',
                                                            notif.read ? 'bg-transparent' : 'bg-primary-500'
                                                        )} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium">{notif.title}</p>
                                                            <p className={cn('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>{notif.message}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </motion.div>
                                    </>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <motion.div
                    key={location.pathname}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                >
                    <Outlet />
                </motion.div>
            </main>
        </div>
    );
};

export default Layout;
