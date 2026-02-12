// HireFlow AI — 团队管理页
import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Shield, MoreVertical } from 'lucide-react';
import { useI18n } from '@hireflow/i18n/src/react';

const MOCK_MEMBERS = [
    { id: '1', name: '张通', email: 'zhangtong@hireflow.ai', role: 'admin', lastActive: '刚刚' },
    { id: '2', name: '李晓', email: 'lixiao@hireflow.ai', role: 'hr_manager', lastActive: '2 小时前' },
    { id: '3', name: '王强', email: 'wangqiang@hireflow.ai', role: 'interviewer', lastActive: '1 天前' },
    { id: '4', name: '赵敏', email: 'zhaomin@hireflow.ai', role: 'viewer', lastActive: '3 天前' },
];

const TeamPage: React.FC = () => {
    const { t } = useI18n();

    return (
        <div className="space-y-5">
            <div className="flex items-center justify-between">
                <h1 className="text-headline-large">{t('team.title')}</h1>
                <button className="btn btn-filled">
                    <UserPlus size={18} />
                    {t('team.inviteMember')}
                </button>
            </div>

            <div className="card p-0 overflow-hidden">
                <table className="table">
                    <thead>
                        <tr>
                            <th>{t('common.name')}</th>
                            <th>{t('common.email')}</th>
                            <th>{t('common.role')}</th>
                            <th>{t('team.lastActive')}</th>
                            <th style={{ width: 48 }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {MOCK_MEMBERS.map((m, i) => (
                            <motion.tr
                                key={m.id}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: i * 0.05 }}
                            >
                                <td>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium" style={{ backgroundColor: 'var(--color-primary-container)', color: 'var(--color-primary)' }}>
                                            {m.name.charAt(0)}
                                        </div>
                                        <span className="text-label-large">{m.name}</span>
                                    </div>
                                </td>
                                <td className="text-body-medium">{m.email}</td>
                                <td>
                                    <span className={`chip ${m.role === 'admin' ? 'chip-primary' : m.role === 'hr_manager' ? 'chip-success' : 'chip-neutral'}`}>
                                        <Shield size={12} />
                                        {t(`team.role.${m.role}`)}
                                    </span>
                                </td>
                                <td className="text-label-small" style={{ color: 'var(--color-on-surface-variant)' }}>{m.lastActive}</td>
                                <td>
                                    <button className="btn-icon"><MoreVertical size={16} /></button>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TeamPage;
