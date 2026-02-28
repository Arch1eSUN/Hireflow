import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const ConsentPage = lazy(() => import('./pages/ConsentPage'));
const DeviceCheckPage = lazy(() => import('./pages/DeviceCheckPage'));
const WaitingRoomPage = lazy(() => import('./pages/WaitingRoomPage'));
const InterviewRoomPage = lazy(() => import('./pages/InterviewRoomPage'));
const CompletePage = lazy(() => import('./pages/CompletePage'));

const Loader: React.FC = () => (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
        <div className="w-8 h-8 rounded-full border-3 animate-spin" style={{ borderColor: 'var(--color-outline)', borderTopColor: 'var(--color-primary)' }} />
    </div>
);

import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => (
    <ErrorBoundary>
        <Suspense fallback={<Loader />}>
            <Routes>
                {/* 候选人面试流程: 落地页 → 设备检测 → 等候室 → 面试 → 完成 */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/:token" element={<LandingPage />} />
                <Route path="/:token/consent" element={<ConsentPage />} />
                <Route path="/:token/device-check" element={<DeviceCheckPage />} />
                <Route path="/:token/waiting" element={<WaitingRoomPage />} />
                <Route path="/:token/room" element={<InterviewRoomPage />} />
                <Route path="/:token/complete" element={<CompletePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    </ErrorBoundary>
);

export default App;
