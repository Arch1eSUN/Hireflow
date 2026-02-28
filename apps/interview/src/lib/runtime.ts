const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

export const resolveApiBaseUrl = (): string => {
    const configured = import.meta.env.VITE_API_URL;
    if (typeof configured === 'string' && configured.trim().length > 0) {
        return trimTrailingSlash(configured.trim());
    }

    if (typeof window !== 'undefined') {
        return `${trimTrailingSlash(window.location.origin)}/api`;
    }

    return '/api';
};

export const resolveInterviewWsUrl = (): string => {
    const configured = import.meta.env.VITE_WS_URL;
    if (typeof configured === 'string' && configured.trim().length > 0) {
        return trimTrailingSlash(configured.trim());
    }

    if (typeof window === 'undefined') {
        return '';
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/api/ws/interview/stream`;
};
