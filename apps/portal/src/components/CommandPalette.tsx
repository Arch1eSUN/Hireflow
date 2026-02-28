import React, { useState, useEffect, useCallback } from 'react';
import { Search, Command, ChevronRight, CornerDownLeft, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { cn } from '@hireflow/utils/src/index';

interface SearchResult {
    id: string;
    type: 'candidate' | 'job' | 'interview' | 'page';
    title: string;
    subtitle?: string;
    url: string;
}

export const CommandPalette: React.FC = () => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const navigate = useNavigate();
    const navItems: SearchResult[] = [
        { id: 'dashboard', type: 'page', title: 'Dashboard', url: '/dashboard' },
        { id: 'candidates', type: 'page', title: 'Candidates', url: '/candidates' },
        { id: 'jobs', type: 'page', title: 'Jobs', url: '/jobs' },
        { id: 'interviews', type: 'page', title: 'Interviews', url: '/interviews' },
        { id: 'integrity', type: 'page', title: 'Integrity Center', url: '/integrity' },
        { id: 'analytics', type: 'page', title: 'Analytics', url: '/analytics' },
        { id: 'screening', type: 'page', title: 'Screening', url: '/screening' },
        { id: 'team', type: 'page', title: 'Team', url: '/team' },
        { id: 'settings', type: 'page', title: 'Settings', url: '/settings' },
    ];

    // Listen for ⌘K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen(prev => !prev);
            }
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Search query
    const { data: results = [], isLoading } = useQuery<SearchResult[]>({
        queryKey: ['search', query],
        queryFn: async () => {
            if (!query) return [];
            const keyword = query.trim().toLowerCase();
            const matchedPages = navItems.filter((item) => item.title.toLowerCase().includes(keyword));
            if (keyword.length < 2) return matchedPages;

            try {
                const res = await api.get('/search', { params: { q: query, limit: 4 } });
                const searchResults = Array.isArray(res.data?.data?.results) ? res.data.data.results : [];
                return [...matchedPages, ...searchResults];
            } catch (error) {
                console.error(error);
                return matchedPages;
            }
        },
        enabled: open && query.length > 0,
        staleTime: 5000
    });

    const handleSelect = (url: string) => {
        setOpen(false);
        setQuery('');
        navigate(url);
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[var(--z-modal)] flex items-start justify-center pt-[20vh] px-4">
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity" onClick={() => setOpen(false)} />

            <div className="relative w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-outline)] shadow-2xl rounded-[var(--radius-lg)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center px-4 border-b border-[var(--color-outline)] h-14">
                    <Search className="w-5 h-5 text-[var(--color-text-secondary)] mr-3" />
                    <input
                        className="flex-1 bg-transparent text-lg outline-none placeholder:text-[var(--color-text-disabled)]"
                        placeholder="Type to search..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        autoFocus
                    />
                    <div className="flex items-center gap-2">
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary)]" />}
                        <kbd className="hidden sm:inline-flex h-6 items-center gap-1 rounded border bg-[var(--color-surface-dim)] px-2 font-mono text-[10px] font-medium text-[var(--color-text-secondary)]">ESC</kbd>
                    </div>
                </div>

                <div className="max-h-[60vh] overflow-y-auto py-2">
                    {results.length === 0 && query.length > 0 && !isLoading && (
                        <div className="py-12 text-center text-[var(--color-text-secondary)] text-sm">No results found.</div>
                    )}

                    {results.length === 0 && query.length === 0 && (
                        <div className="py-8 text-center text-[var(--color-text-disabled)] text-sm">Start typing to search...</div>
                    )}

                    <ul className="px-2">
                        {results.map((item) => (
                            <li key={item.id}>
                                <button
                                    className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-[var(--color-primary-container)] rounded-[var(--radius-md)] group transition-colors focus:bg-[var(--color-primary-container)] outline-none"
                                    onClick={() => handleSelect(item.url)}
                                >
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <div className={cn(
                                            "flex items-center justify-center w-8 h-8 rounded border text-[var(--color-text-secondary)]",
                                            item.type === 'candidate' ? "bg-orange-50 border-orange-100 text-orange-600" :
                                                item.type === 'job' ? "bg-blue-50 border-blue-100 text-blue-600" :
                                                    item.type === 'interview' ? "bg-green-50 border-green-100 text-green-600" :
                                                    "bg-[var(--color-surface-dim)] border-[var(--color-outline)]"
                                        )}>
                                            {item.type === 'candidate'
                                                ? 'C'
                                                : item.type === 'job'
                                                    ? 'J'
                                                    : item.type === 'interview'
                                                        ? 'I'
                                                        : <Command size={14} />}
                                        </div>
                                        <div className="truncate">
                                            <div className="text-sm font-medium text-[var(--color-text-primary)] group-hover:text-[var(--color-primary)]">{item.title}</div>
                                            {item.subtitle && <div className="text-xs text-[var(--color-text-secondary)]">{item.subtitle}</div>}
                                        </div>
                                    </div>
                                    <CornerDownLeft className="h-4 w-4 text-[var(--color-text-disabled)] opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="bg-[var(--color-surface-dim)] px-4 py-2 border-t border-[var(--color-outline)] flex items-center justify-between text-[10px] text-[var(--color-text-secondary)]">
                    <div className="flex gap-4">
                        <span><strong>↑↓</strong> to navigate</span>
                        <span><strong>↵</strong> to select</span>
                    </div>
                    <span>Search by <strong>Candidates</strong>, <strong>Jobs</strong>, or <strong>Pages</strong></span>
                </div>
            </div>
        </div>
    );
};
