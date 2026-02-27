import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

// Create Axios instance
const api = axios.create({
    baseURL: 'http://localhost:4000/api', // TODO: Load from env
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: true, // Send cookies (refresh token)
});

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
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach(({ resolve, reject }) => {
        if (error) {
            reject(error);
        } else {
            resolve(token);
        }
    });
    failedQueue = [];
};

// Response Interceptor: Handle 401 with Token Refresh
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // Only attempt refresh on 401 errors, and not for auth endpoints themselves
        if (
            error.response?.status === 401 &&
            !originalRequest._retry &&
            !originalRequest.url?.includes('/auth/login') &&
            !originalRequest.url?.includes('/auth/register') &&
            !originalRequest.url?.includes('/auth/refresh')
        ) {
            if (isRefreshing) {
                // Queue requests while refreshing
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`;
                    return api(originalRequest);
                });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Attempt to refresh the token using the HTTP-Only cookie
                const refreshResponse = await axios.post(
                    'http://localhost:4000/api/auth/refresh',
                    {},
                    { withCredentials: true }
                );

                const newToken = refreshResponse.data?.data?.accessToken;

                if (newToken) {
                    // Update the token in the store
                    const currentUser = useAuthStore.getState().user;
                    useAuthStore.getState().login(newToken, currentUser!);

                    // Retry all queued requests
                    processQueue(null, newToken);

                    // Retry the original request
                    originalRequest.headers.Authorization = `Bearer ${newToken}`;
                    return api(originalRequest);
                } else {
                    throw new Error('No token in refresh response');
                }
            } catch (refreshError) {
                // Refresh failed — clear auth and redirect to login
                processQueue(refreshError, null);
                useAuthStore.getState().logout();
                window.location.href = '/login';
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default api;
