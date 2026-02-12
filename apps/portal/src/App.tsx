import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';

// 懒加载页面 — 代码分割
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CandidatesPage = lazy(() => import('./pages/CandidatesPage'));
const CandidateDetailPage = lazy(() => import('./pages/CandidateDetailPage'));
const JobsPage = lazy(() => import('./pages/JobsPage'));
const InterviewsPage = lazy(() => import('./pages/InterviewsPage'));
const InterviewMonitorPage = lazy(() => import('./pages/InterviewMonitorPage'));
const ScreeningPage = lazy(() => import('./pages/ScreeningPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const TeamPage = lazy(() => import('./pages/TeamPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

// 加载骨架屏
const PageLoader: React.FC = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
            <div
                className="w-10 h-10 rounded-full border-4 animate-spin"
                style={{
                    borderColor: 'var(--color-outline)',
                    borderTopColor: 'var(--color-primary)',
                }}
            />
            <p className="text-body-medium" style={{ color: 'var(--color-on-surface-variant)' }}>
                加载中...
            </p>
        </div>
    </div>
);

const App: React.FC = () => {
    return (
        <Suspense fallback={<PageLoader />}>
            <Routes>
                {/* 企业后台路由（含侧边栏布局） */}
                <Route element={<Layout />}>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/candidates" element={<CandidatesPage />} />
                    <Route path="/candidates/:id" element={<CandidateDetailPage />} />
                    <Route path="/jobs" element={<JobsPage />} />
                    <Route path="/interviews" element={<InterviewsPage />} />
                    <Route path="/screening" element={<ScreeningPage />} />
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/team" element={<TeamPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                </Route>

                {/* 面试监控（全屏，脱离侧边栏） */}
                <Route path="/interviews/:id/monitor" element={<InterviewMonitorPage />} />
            </Routes>
        </Suspense>
    );
};

export default App;
