// HireFlow AI — 面试实时监控页
import React from 'react';
import { useParams } from 'react-router-dom';
import { useI18n } from '@hireflow/i18n/src/react';

const InterviewMonitorPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const { t } = useI18n();

    return (
        <div className="min-h-screen p-6" style={{ backgroundColor: 'var(--color-surface-dim)' }}>
            <h1 className="text-headline-large mb-4">{t('monitor.title')}</h1>
            <div className="grid grid-cols-3 gap-4">
                {/* 主视频区 */}
                <div className="col-span-2 card" style={{ minHeight: 400 }}>
                    <div
                        className="w-full h-80 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-surface-variant)' }}
                    >
                        <p style={{ color: 'var(--color-on-surface-variant)' }}>视频流区域</p>
                    </div>
                </div>
                {/* 实时分析 */}
                <div className="space-y-4">
                    <div className="card">
                        <h3 className="text-title-medium mb-3">{t('monitor.liveTranscript')}</h3>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                            <p className="text-body-medium">候选人: 我之前主要负责的是前端架构的设计...</p>
                        </div>
                    </div>
                    <div className="card">
                        <h3 className="text-title-medium mb-3">{t('monitor.aiAnalysis')}</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between"><span className="text-label-small">{t('monitor.confidence')}</span><span className="text-label-large">85%</span></div>
                            <div className="flex justify-between"><span className="text-label-small">{t('monitor.fluency')}</span><span className="text-label-large">92%</span></div>
                            <div className="flex justify-between"><span className="text-label-small">{t('monitor.technicalDepth')}</span><span className="text-label-large">78%</span></div>
                        </div>
                    </div>
                    <div className="card">
                        <h3 className="text-title-medium mb-3">{t('monitor.antiCheat')}</h3>
                        <div className="chip chip-success">未检测到异常</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InterviewMonitorPage;
