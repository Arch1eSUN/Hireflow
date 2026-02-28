import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../config/env', () => ({
    env: {
        EMAIL_PROVIDER: 'console',
        EMAIL_FROM: 'test@hireflow.ai',
        SENDGRID_API_KEY: undefined,
        NODE_ENV: 'test',
    },
}));

vi.mock('../../utils/logger', () => ({
    logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    },
}));

describe('Email Service', () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
    });

    it('console 模式下 sendEmail 成功且不发送真实邮件', async () => {
        const { sendEmail } = await import('../../services/email/index');

        const result = await sendEmail({
            to: 'candidate@example.com',
            subject: 'Test Subject',
            text: 'Hello',
        });

        expect(result.success).toBe(true);
        expect(result.messageId).toMatch(/^console-/);
    });

    it('多个收件人的 sendEmail 成功', async () => {
        const { sendEmail } = await import('../../services/email/index');

        const result = await sendEmail({
            to: ['a@example.com', 'b@example.com'],
            subject: 'Multi recipient',
            html: '<p>Hello</p>',
        });

        expect(result.success).toBe(true);
    });

    it('interviewInviteEmail 模板生成正确', async () => {
        const { interviewInviteEmail } = await import('../../services/email/index');

        const email = interviewInviteEmail('张三', 'Frontend Developer', 'https://interview.example.com/abc');

        expect(email.subject).toContain('Frontend Developer');
        expect(email.html).toContain('张三');
        expect(email.html).toContain('https://interview.example.com/abc');
        expect(email.text).toContain('Frontend Developer');
    });

    it('interviewCompleteEmail 模板生成正确', async () => {
        const { interviewCompleteEmail } = await import('../../services/email/index');

        const email = interviewCompleteEmail('李四', 'Backend Engineer');

        expect(email.subject).toContain('李四');
        expect(email.subject).toContain('Backend Engineer');
        expect(email.html).toContain('李四');
    });

    it('highRiskAlertEmail 模板生成正确', async () => {
        const { highRiskAlertEmail } = await import('../../services/email/index');

        const email = highRiskAlertEmail('abc-123-def', 'tab_switch', '候选人切换了标签页');

        expect(email.subject).toContain('⚠️');
        expect(email.subject).toContain('abc-123');
        expect(email.html).toContain('tab_switch');
        expect(email.html).toContain('候选人切换了标签页');
    });

    it('sendgrid 模式下未配置 API key 返回失败', async () => {
        vi.resetModules();
        vi.doMock('../../config/env', () => ({
            env: {
                EMAIL_PROVIDER: 'sendgrid',
                EMAIL_FROM: 'test@hireflow.ai',
                SENDGRID_API_KEY: undefined,
                NODE_ENV: 'test',
            },
        }));
        vi.doMock('../../utils/logger', () => ({
            logger: {
                info: vi.fn(),
                warn: vi.fn(),
                error: vi.fn(),
            },
        }));

        const { sendEmail } = await import('../../services/email/index');
        const result = await sendEmail({
            to: 'x@example.com',
            subject: 'Test',
            text: 'Hello',
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain('SENDGRID_API_KEY');
    });

    // ── New template tests ─────────────────────────────────────────────────

    it('candidateWelcomeEmail 模板生成正确', async () => {
        const { candidateWelcomeEmail } = await import('../../services/email/index');

        const email = candidateWelcomeEmail('王五', 'Product Manager', '梵尚科技');

        expect(email.subject).toContain('Product Manager');
        expect(email.subject).toContain('梵尚科技');
        expect(email.html).toContain('王五');
    });

    it('interviewReminderEmail 模板生成正确', async () => {
        const { interviewReminderEmail } = await import('../../services/email/index');

        const email = interviewReminderEmail('赵六', 'Designer', 'https://interview.example.com/xyz', '2025-03-01 14:00');

        expect(email.subject).toContain('Designer');
        expect(email.subject).toContain('14:00');
        expect(email.html).toContain('赵六');
        expect(email.html).toContain('https://interview.example.com/xyz');
    });

    it('passwordResetEmail 模板生成正确', async () => {
        const { passwordResetEmail } = await import('../../services/email/index');

        const email = passwordResetEmail('管理员', 'https://app.example.com/reset/token123');

        expect(email.subject).toContain('密码重置');
        expect(email.html).toContain('管理员');
        expect(email.html).toContain('https://app.example.com/reset/token123');
    });

    it('teamInviteEmail 模板生成正确', async () => {
        const { teamInviteEmail } = await import('../../services/email/index');

        const email = teamInviteEmail('Alice', '梵尚科技', 'https://app.example.com/invite/abc', 'admin');

        expect(email.subject).toContain('Alice');
        expect(email.subject).toContain('梵尚科技');
        expect(email.html).toContain('admin');
    });

    it('stageChangeEmail 模板生成正确', async () => {
        const { stageChangeEmail } = await import('../../services/email/index');

        const email = stageChangeEmail('候选人A', '工程师', 'applied', 'interview');

        expect(email.subject).toContain('候选人A');
        expect(email.html).toContain('applied');
        expect(email.html).toContain('interview');
    });
});
