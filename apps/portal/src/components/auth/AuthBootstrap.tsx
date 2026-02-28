import React, { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';

interface MeResponse {
    id: string;
    email: string;
    name: string;
    role: string;
    companyId?: string;
    company?: { id?: string };
}

const AuthBootstrap = ({ children }: { children: React.ReactNode }) => {
    const [ready, setReady] = useState(false);
    const { isAuthenticated, user, login, logout } = useAuthStore();

    useEffect(() => {
        let alive = true;

        const bootstrap = async () => {
            if (isAuthenticated && user) {
                setReady(true);
                return;
            }

            try {
                const refreshRes = await api.post('/auth/refresh');
                const accessToken = refreshRes.data?.data?.accessToken as string | undefined;

                if (!accessToken) {
                    throw new Error('No refresh token session');
                }

                const meRes = await api.get('/auth/me', {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                const me = meRes.data?.data as MeResponse | undefined;

                if (!me?.id) {
                    throw new Error('Failed to fetch user profile');
                }

                login(accessToken, {
                    id: me.id,
                    email: me.email,
                    name: me.name,
                    role: me.role,
                    companyId: me.companyId || me.company?.id || '',
                });
            } catch {
                logout();
            } finally {
                if (alive) setReady(true);
            }
        };

        void bootstrap();

        return () => {
            alive = false;
        };
    }, [isAuthenticated, login, logout, user]);

    if (!ready) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-dim)]">
                <div className="h-10 w-10 rounded-full border-4 border-[var(--color-outline)] border-t-[var(--color-primary)] animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
};

export default AuthBootstrap;
