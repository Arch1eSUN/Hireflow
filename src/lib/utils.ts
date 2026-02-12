// ================================================
// HireFlow AI - Utility Functions
// ================================================

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes safely - resolves conflicts */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/** Generate a UUID v4 */
export function generateId(): string {
    return crypto.randomUUID();
}

/** Generate a secure interview link token */
export function generateInterviewLink(baseUrl: string = 'https://hireflow.ai'): string {
    const uuid = crypto.randomUUID();
    return `${baseUrl}/interview/${uuid}`;
}

/** Format a date string to relative time (e.g., "2h ago") */
export function timeAgo(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
}

/** Format number with comma separators */
export function formatNumber(num: number): string {
    return num.toLocaleString('en-US');
}

/** Get initials from a full name */
export function getInitials(name: string): string {
    return name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}

/** Get a color hash based on string (for avatar backgrounds) */
export function getColorForString(str: string): string {
    const colors = [
        'bg-primary-100 text-primary-700',
        'bg-blue-100 text-blue-700',
        'bg-green-100 text-green-700',
        'bg-orange-100 text-orange-700',
        'bg-pink-100 text-pink-700',
        'bg-cyan-100 text-cyan-700',
        'bg-violet-100 text-violet-700',
        'bg-amber-100 text-amber-700',
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
}

/** Get status badge styling */
export function getStatusStyle(status: string): string {
    const styles: Record<string, string> = {
        Applied: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        Screening: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        'Interview 1': 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        'Interview 2': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
        Offer: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        Hired: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
        Rejected: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        active: 'bg-green-50 text-green-700',
        paused: 'bg-orange-50 text-orange-700',
        closed: 'bg-slate-100 text-slate-500',
        draft: 'bg-slate-100 text-slate-500',
    };
    return styles[status] || styles['Applied'];
}

/** Get score color based on value */
export function getScoreColor(score: number): string {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-amber-600 bg-amber-50';
    if (score >= 60) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
}

/** Debounce function */
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

/** Truncate text to max length */
export function truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}
