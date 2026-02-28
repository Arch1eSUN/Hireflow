import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ShieldAlert, Video, Mic, FileText, ArrowRight, Check, Loader2, AlertCircle } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/react';
import { resolveApiBaseUrl } from '../lib/runtime';

const ConsentPage: React.FC = () => {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { t } = useI18n();
    const [agreed, setAgreed] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const apiBaseUrl = resolveApiBaseUrl();

    const handleContinue = async () => {
        if (!agreed) return;

        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${apiBaseUrl}/public/interview/${token}/consent`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ gdprConsentGiven: true })
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body?.error || 'Failed to record consent agreement.');
            }

            // Move to device check
            navigate(`/${token}/device-check`);
        } catch (err: any) {
            setError(err.message || 'Network error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--color-surface-dim)] font-sans animate-in fade-in duration-500">
            <div className="w-full max-w-2xl bg-[var(--color-surface)] border border-[var(--color-outline)] rounded-[var(--radius-lg)] shadow-sm overflow-hidden flex flex-col">
                <div className="p-8 border-b border-[var(--color-outline)] bg-gradient-to-r from-[var(--color-primary-container)] to-transparent">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-[var(--color-primary)] text-xs font-semibold uppercase tracking-wide mb-4 shadow-sm">
                        <ShieldAlert size={14} /> Compliance & Privacy
                    </div>
                    <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] leading-tight mb-2">
                        Data Privacy & Monitoring Consent
                    </h1>
                    <p className="text-[var(--color-text-secondary)] text-sm">
                        To maintain a fair and secure interview environment, we require your explicit consent to monitor and record this session.
                    </p>
                </div>

                <div className="p-8 bg-[var(--color-surface)]">
                    <div className="space-y-6 mb-8">
                        <div className="flex gap-4">
                            <div className="mt-1 bg-[var(--color-primary-container)] p-2 rounded-full text-[var(--color-primary)] shrink-0">
                                <Video size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Camera & Screen Recording</h3>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                    Your webcam and screen will be recorded during the interview to verify identity and prevent academic dishonesty.
                                    This data will be securely stored for a maximum of 90 days.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="mt-1 bg-[var(--color-primary-container)] p-2 rounded-full text-[var(--color-primary)] shrink-0">
                                <Mic size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Audio Analysis</h3>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                    Your microphone audio will be recorded and analyzed to transcribe your answers and evaluate communication skills.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="mt-1 bg-[var(--color-primary-container)] p-2 rounded-full text-[var(--color-primary)] shrink-0">
                                <FileText size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm font-medium text-[var(--color-text-primary)]">AI Monitoring & Data Usage</h3>
                                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                    Our AI systems will analyze the interview to generate a structural report and flag potential violations (e.g., secondary voices, tab switching).
                                    By proceeding, you agree to these automated processing terms.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--color-surface-dim)] p-4 rounded-xl border border-[var(--color-outline)] mb-6">
                        <label className="flex items-start gap-3 cursor-pointer group">
                            <div className="relative flex items-center justify-center shrink-0 mt-0.5">
                                <input
                                    type="checkbox"
                                    className="peer w-5 h-5 appearance-none rounded border border-[var(--color-outline-strong)] bg-white checked:bg-[var(--color-primary)] checked:border-[var(--color-primary)] transition-all cursor-pointer"
                                    checked={agreed}
                                    onChange={(e) => setAgreed(e.target.checked)}
                                />
                                <Check size={14} className="absolute text-white pointer-events-none opacity-0 peer-checked:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-sm text-[var(--color-text-primary)] leading-tight select-none">
                                I have read and agree to the Data Privacy & Monitoring Consent terms.
                                I understand that my interview will be recorded for evaluation purposes.
                            </span>
                        </label>
                    </div>

                    {error && (
                        <div className="mb-6 rounded-xl border border-[var(--color-error)]/20 bg-[var(--color-error-bg)] px-4 py-3 text-sm text-[var(--color-error)] flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <button
                            className="h-11 text-sm rounded-full px-6 bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            onClick={handleContinue}
                            disabled={!agreed || loading}
                        >
                            {loading && <Loader2 size={16} className="animate-spin" />}
                            I Agree & Continue <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-[var(--color-text-disabled)] text-xs font-medium">
                {t('interview.brand.poweredBy')}
            </div>
        </div>
    );
};

export default ConsentPage;
