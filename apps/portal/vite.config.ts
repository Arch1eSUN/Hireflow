import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
            '/api': {
                target: 'http://localhost:4000',
                changeOrigin: true,
                ws: true,
            },
            '/ws': {
                target: 'ws://localhost:4000',
                ws: true,
            },
        },
    },
    plugins: [react(), tailwindcss()],
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('/react/') || id.includes('react-dom') || id.includes('scheduler')) {
                        return 'vendor-react';
                    }
                    if (id.includes('@tanstack')) {
                        return 'vendor-query';
                    }
                    if (id.includes('recharts') || id.includes('d3-')) {
                        return 'vendor-charts';
                    }
                    if (id.includes('framer-motion')) {
                        return 'vendor-motion';
                    }
                    if (id.includes('lucide-react')) {
                        return 'vendor-icons';
                    }
                    return 'vendor-misc';
                },
            },
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            '@hireflow/i18n': path.resolve(__dirname, '../../packages/shared/i18n/src'),
            '@hireflow/types': path.resolve(__dirname, '../../packages/shared/types/src'),
        },
    },
});
