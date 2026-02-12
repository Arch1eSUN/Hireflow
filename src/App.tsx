import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import Layout from '@/components/layout/Layout';

// Lazy-loaded pages for code splitting
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CandidatesPage = lazy(() => import('@/pages/CandidatesPage'));
const InterviewRoomPage = lazy(() => import('@/pages/InterviewRoomPage'));
const RuleEditorPage = lazy(() => import('@/pages/RuleEditorPage'));
const JobsPage = lazy(() => import('@/pages/JobsPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const InterviewLinkPage = lazy(() => import('@/pages/InterviewLinkPage'));

// Loading fallback with M3 shimmer
const PageLoader: React.FC = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
            <p className="text-sm text-slate-500 font-medium">Loading...</p>
        </div>
    </div>
);

const App: React.FC = () => {
    return (
        <AnimatePresence mode="wait">
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    {/* Candidate-facing interview page (no sidebar) */}
                    <Route path="/interview/:id" element={<InterviewLinkPage />} />

                    {/* Admin/HR Dashboard routes with sidebar layout */}
                    <Route element={<Layout />}>
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/candidates" element={<CandidatesPage />} />
                        <Route path="/interview-room" element={<InterviewRoomPage />} />
                        <Route path="/screening" element={<RuleEditorPage />} />
                        <Route path="/jobs" element={<JobsPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                </Routes>
            </Suspense>
        </AnimatePresence>
    );
};

export default App;
