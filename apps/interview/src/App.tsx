import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const DeviceCheckPage = lazy(() => import('./pages/DeviceCheckPage'));
const WaitingRoomPage = lazy(() => import('./pages/WaitingRoomPage'));
const InterviewRoomPage = lazy(() => import('./pages/InterviewRoomPage'));
const CompletePage = lazy(() => import('./pages/CompletePage'));

const Loader: React.FC = () => (
    <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
        <div className="w-8 h-8 rounded-full border-3 animate-spin" style={{ borderColor: 'var(--color-outline)', borderTopColor: 'var(--color-primary)' }} />
    </div>
);

const App: React.FC = () => (
    <Suspense fallback={<Loader />}>
        <Routes>
            {/* 候选人面试流程: 落地页 → 设备检测 → 等候室 → 面试 → 完成 */}
            <Route path="/:token" element={<LandingPage />} />
            <Route path="/:token/device-check" element={<DeviceCheckPage />} />
            <Route path="/:token/waiting" element={<WaitingRoomPage />} />
            <Route path="/:token/room" element={<InterviewRoomPage />} />
            <Route path="/:token/complete" element={<CompletePage />} />
        </Routes>
    </Suspense>
);

export default App;
