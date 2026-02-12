import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { I18nProvider } from '@hireflow/i18n/src/react';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <BrowserRouter>
            <I18nProvider>
                <ThemeProvider>
                    <App />
                </ThemeProvider>
            </I18nProvider>
        </BrowserRouter>
    </React.StrictMode>
);
