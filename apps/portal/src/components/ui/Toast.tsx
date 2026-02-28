import { Toaster as SonnerToaster } from 'sonner';

export function AppToaster() {
    return (
        <SonnerToaster
            position="bottom-left"
            toastOptions={{
                duration: 4000,
                style: {
                    fontFamily: 'Inter, system-ui, sans-serif',
                    fontSize: '14px',
                    borderRadius: '4px',
                    padding: '12px 16px',
                    background: '#323232', // Dark Grey (Google Snack bar style)
                    color: '#FFFFFF',
                    border: 'none',
                    boxShadow: '0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)',
                },
                descriptionClassName: 'text-gray-400',
            }}
            richColors={false} // Use custom dark style
            theme="dark"
        />
    );
}
