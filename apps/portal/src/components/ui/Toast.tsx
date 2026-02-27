// HireFlow Toast — Sonner with M3 Liquid Glass styling
import { Toaster as SonnerToaster } from 'sonner';

export function AppToaster() {
    return (
        <SonnerToaster
            position="top-right"
            toastOptions={{
                duration: 3500,
                style: {
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '14px',
                    borderRadius: '16px',
                    padding: '14px 20px',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                },
                classNames: {
                    success: 'hf-toast-success',
                    error: 'hf-toast-error',
                    info: 'hf-toast-info',
                },
            }}
            richColors
        />
    );
}
