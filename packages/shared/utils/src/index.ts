// ================================================
// HireFlow AI — 共享工具函数
// ================================================

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** 合并 TailwindCSS 类名（处理冲突） */
export function cn(...inputs: ClassValue[]): string {
    return twMerge(clsx(inputs));
}

/** 生成首字母缩写（用于头像） */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/** 格式化日期 */
export function formatDate(date: string | Date, locale: string = 'zh-CN'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString(locale, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/** 格式化时间 */
export function formatTime(date: string | Date, locale: string = 'zh-CN'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString(locale, {
        hour: '2-digit',
        minute: '2-digit',
    });
}

/** 格式化时长（秒→可读） */
export function formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

/** 相对时间（如 "3分钟前"） */
export function relativeTime(date: string | Date, locale: string = 'zh-CN'): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const diff = Date.now() - d.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    const isZh = locale.startsWith('zh');

    if (seconds < 60) return isZh ? '刚刚' : 'Just now';
    if (minutes < 60) return isZh ? `${minutes} 分钟前` : `${minutes}m ago`;
    if (hours < 24) return isZh ? `${hours} 小时前` : `${hours}h ago`;
    if (days < 7) return isZh ? `${days} 天前` : `${days}d ago`;
    return formatDate(d, locale);
}

/** 格式化货币 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
}

/** 格式化大数字（如 1.2K、3.4M） */
export function formatNumber(num: number): string {
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
}

/** 获取问候语（根据时间） */
export function getGreeting(locale: string = 'zh-CN'): string {
    const hour = new Date().getHours();
    const isZh = locale.startsWith('zh');
    if (hour < 12) return isZh ? '早上好' : 'Good morning';
    if (hour < 18) return isZh ? '下午好' : 'Good afternoon';
    return isZh ? '晚上好' : 'Good evening';
}

/** 百分比变化的颜色和符号 */
export function getChangeInfo(change: number): { color: string; symbol: string; text: string } {
    if (change > 0) return { color: 'text-green-600', symbol: '↑', text: `+${change.toFixed(1)}%` };
    if (change < 0) return { color: 'text-red-600', symbol: '↓', text: `${change.toFixed(1)}%` };
    return { color: 'text-gray-500', symbol: '→', text: '0%' };
}

/** 分数→颜色映射（用于 AI 评分显示） */
export function getScoreColor(score: number): string {
    if (score >= 90) return 'text-green-600 bg-green-50';
    if (score >= 75) return 'text-blue-600 bg-blue-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
}

/** 阶段→颜色映射 */
export function getStageColor(stage: string): string {
    const colors: Record<string, string> = {
        applied: 'bg-gray-100 text-gray-700',
        screening: 'bg-blue-100 text-blue-700',
        interview_1: 'bg-purple-100 text-purple-700',
        interview_2: 'bg-indigo-100 text-indigo-700',
        hr_interview: 'bg-teal-100 text-teal-700',
        offer: 'bg-green-100 text-green-700',
        hired: 'bg-emerald-100 text-emerald-700',
        rejected: 'bg-red-100 text-red-700',
    };
    return colors[stage] || 'bg-gray-100 text-gray-700';
}

/** 防抖函数 */
export function debounce<T extends (...args: unknown[]) => unknown>(
    fn: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timer: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/** 截断文本 */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
}
