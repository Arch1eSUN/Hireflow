// ================================================
// HireFlow AI - Candidate-Facing Interview Link Page
// Device check → instructions → enter interview
// ================================================

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera, Mic, Wifi, CheckCircle, XCircle, AlertCircle,
    ChevronRight, Shield, Clock, Monitor, GitBranch,
    Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DeviceCheckResult } from '@/types';

type PageState = 'loading' | 'device_check' | 'instructions' | 'ready' | 'expired';

const InterviewLinkPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const [pageState, setPageState] = useState<PageState>('loading');
    const [deviceCheck, setDeviceCheck] = useState<DeviceCheckResult>({
        camera: false,
        microphone: false,
        network: 'poor',
        networkSpeed: 0,
        browser: '',
        isCompatible: false,
    });
    const [checkingDevices, setCheckingDevices] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Simulate link validation
    useEffect(() => {
        const timer = setTimeout(() => {
            // Simulate valid link
            setPageState('device_check');
        }, 1500);
        return () => clearTimeout(timer);
    }, [id]);

    // Device check
    const runDeviceCheck = async () => {
        setCheckingDevices(true);
        const result: DeviceCheckResult = {
            camera: false,
            microphone: false,
            network: 'poor',
            networkSpeed: 0,
            browser: navigator.userAgent.includes('Chrome') ? 'Chrome' : navigator.userAgent.includes('Firefox') ? 'Firefox' : 'Other',
            isCompatible: true,
        };

        // Check camera
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            result.camera = true;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
            // Don't stop - keep preview running
        } catch {
            result.camera = false;
        }

        // Check microphone
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            result.microphone = true;
            stream.getTracks().forEach((t) => t.stop());
        } catch {
            result.microphone = false;
        }

        // Simulate network check
        await new Promise((r) => setTimeout(r, 1000));
        result.network = 'good';
        result.networkSpeed = 25 + Math.random() * 75;
        result.isCompatible = result.camera && result.microphone;

        setDeviceCheck(result);
        setCheckingDevices(false);
    };

    useEffect(() => {
        if (pageState === 'device_check') {
            runDeviceCheck();
        }
    }, [pageState]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#F8F7FC] to-[#EEEAF8] flex flex-col">
            {/* Header */}
            <header className="h-16 flex items-center px-8 border-b border-slate-200/60">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary-500/20">
                        <GitBranch className="text-white w-4 h-4" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-slate-800">HireFlow AI</span>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex items-center justify-center p-8">
                <AnimatePresence mode="wait">
                    {/* Loading State */}
                    {pageState === 'loading' && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-center"
                        >
                            <Loader2 className="w-12 h-12 text-primary-500 animate-spin mx-auto mb-4" />
                            <p className="text-slate-500 font-medium">Validating interview link...</p>
                        </motion.div>
                    )}

                    {/* Device Check */}
                    {pageState === 'device_check' && (
                        <motion.div
                            key="device_check"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="max-w-2xl w-full"
                        >
                            <div className="text-center mb-8">
                                <h1 className="text-3xl font-bold text-slate-900 mb-2">Device Check</h1>
                                <p className="text-slate-500">Let's make sure your setup is ready for the interview</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Camera Preview */}
                                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                                    <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden mb-4 relative">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover transform scale-x-[-1]"
                                        />
                                        {!deviceCheck.camera && (
                                            <div className="absolute inset-0 flex items-center justify-center text-slate-500">
                                                <Camera className="w-10 h-10 opacity-40" />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-3">
                                        <CheckItem
                                            label="Camera"
                                            status={checkingDevices ? 'checking' : deviceCheck.camera ? 'pass' : 'fail'}
                                        />
                                        <CheckItem
                                            label="Microphone"
                                            status={checkingDevices ? 'checking' : deviceCheck.microphone ? 'pass' : 'fail'}
                                        />
                                        <CheckItem
                                            label="Network Quality"
                                            status={checkingDevices ? 'checking' : deviceCheck.network === 'good' ? 'pass' : deviceCheck.network === 'fair' ? 'warn' : 'fail'}
                                            detail={deviceCheck.networkSpeed > 0 ? `${deviceCheck.networkSpeed.toFixed(0)} Mbps` : undefined}
                                        />
                                        <CheckItem
                                            label="Browser"
                                            status={checkingDevices ? 'checking' : 'pass'}
                                            detail={deviceCheck.browser}
                                        />
                                    </div>
                                </div>

                                {/* Instructions */}
                                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                                    <h3 className="font-semibold text-lg mb-4 text-slate-800">Interview Guidelines</h3>
                                    <div className="space-y-4 text-sm text-slate-600">
                                        <div className="flex gap-3">
                                            <Monitor className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                                            <p>Ensure you are in a quiet, well-lit environment with a stable internet connection</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Camera className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                                            <p>Keep your camera on throughout the interview. Face detection is active.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Shield className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                                            <p>Do not switch tabs or use other devices. Anti-cheat monitoring is enabled.</p>
                                        </div>
                                        <div className="flex gap-3">
                                            <Clock className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" />
                                            <p>The interview will last approximately 30-45 minutes. You can take short pauses.</p>
                                        </div>
                                    </div>

                                    <div className="mt-8">
                                        <button
                                            onClick={() => setPageState('ready')}
                                            disabled={checkingDevices || !deviceCheck.isCompatible}
                                            className="m3-btn-filled w-full justify-center py-3 text-base disabled:opacity-40"
                                        >
                                            I'm Ready — Start Interview
                                            <ChevronRight className="w-5 h-5" />
                                        </button>
                                        {!deviceCheck.isCompatible && !checkingDevices && (
                                            <p className="text-xs text-red-500 mt-2 text-center">
                                                Please fix the issues above before continuing
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Ready State */}
                    {pageState === 'ready' && (
                        <motion.div
                            key="ready"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center max-w-md"
                        >
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                                className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-primary-500/30"
                            >
                                <CheckCircle className="w-10 h-10 text-white" />
                            </motion.div>
                            <h1 className="text-3xl font-bold text-slate-900 mb-3">You're All Set!</h1>
                            <p className="text-slate-500 mb-8">
                                The interview is loading. You will meet your AI interviewer shortly.
                            </p>
                            <div className="flex items-center justify-center gap-2 text-primary-600">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span className="text-sm font-medium">Connecting to interview room...</span>
                            </div>
                        </motion.div>
                    )}

                    {/* Expired State */}
                    {pageState === 'expired' && (
                        <motion.div
                            key="expired"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-center max-w-md"
                        >
                            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                            <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Expired</h1>
                            <p className="text-slate-500">
                                This interview link has expired. Please contact the recruiter for a new invitation.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>

            {/* Footer */}
            <footer className="h-12 flex items-center justify-center text-xs text-slate-400 border-t border-slate-200/60">
                <p>© 2026 HireFlow AI — Secure AI-Powered Recruitment</p>
            </footer>
        </div>
    );
};

// CheckItem component for device verification
const CheckItem: React.FC<{
    label: string;
    status: 'checking' | 'pass' | 'fail' | 'warn';
    detail?: string;
}> = ({ label, status, detail }) => (
    <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            {status === 'checking' && <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />}
            {status === 'pass' && <CheckCircle className="w-4 h-4 text-green-500" />}
            {status === 'fail' && <XCircle className="w-4 h-4 text-red-500" />}
            {status === 'warn' && <AlertCircle className="w-4 h-4 text-amber-500" />}
            <span className="text-sm text-slate-700">{label}</span>
        </div>
        {detail && <span className="text-xs text-slate-400">{detail}</span>}
    </div>
);

export default InterviewLinkPage;
