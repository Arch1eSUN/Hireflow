import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { resolveApiBaseUrl } from './runtime';

type RetryConfig = InternalAxiosRequestConfig & { _retry?: boolean };

interface AuthUserPayload {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string;
    company?: { id?: string };
}

// Create Axios instance
const api = axios.create({
    baseURL: resolveApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies (refresh token)
});

function normalizeUser(user: AuthUserPayload) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId || user.company?.id || '',
    };
}

async function setSessionAfterRefresh(accessToken: string) {
    const existingUser = useAuthStore.getState().user;
    if (existingUser) {
        useAuthStore.getState().login(accessToken, existingUser);
        return;
    }

    const meResponse = await axios.get(`${api.defaults.baseURL}/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
    });
    const me = meResponse.data?.data as AuthUserPayload | undefined;

    if (!me?.id) {
        throw new Error('Unable to restore user profile from /auth/me');
    }

    useAuthStore.getState().login(accessToken, normalizeUser(me));
}

// Request Interceptor: Attach Token
api.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Flag to prevent multiple simultaneous refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value: string) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token || '');
        }
    });
    failedQueue = [];
};

// Response Interceptor: Handle 401 with Token Refresh
api.interceptors.response.use(
    (response) => response,
    async (rawError: AxiosError) => {
        const originalRequest = rawError.config as RetryConfig | undefined;

        if (!originalRequest) {
            return Promise.reject(rawError);
        }

        // Only attempt refresh on 401 errors, and not for auth endpoints themselves
        if (
            rawError.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/login') &&
            !originalRequest.url?.includes('/auth/register') &&
            !originalRequest.url?.includes('/auth/refresh')
        ) {
            if (isRefreshing) {
                // Queue requests while refreshing
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshResponse = await axios.post(
                    `${api.defaults.baseURL}/auth/refresh`,
                    {},
                    { withCredentials: true }
                );

                const newToken = refreshResponse.data?.data?.accessToken as string | undefined;

                if (!newToken) {
                    throw new Error('No access token received during refresh');
                }

                await setSessionAfterRefresh(newToken);
                processQueue(null, newToken);

                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(rawError);
    }
);

export default api;
