/**
 * Email service with provider abstraction + template helpers.
 *
 * Providers: sendgrid │ smtp │ console (dev default)
 * Templates: invite │ complete │ alert │ welcome │ remind │ stageChange │ passwordReset │ teamInvite
 */
import { extractErrorMessage } from '../../utils/errors';
import { logger } from '../../utils/logger';
import { env } from '../../config/env';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmailMessage {
    to: string | string[];
    subject: string;
    text?: string;
    html?: string;
    from?: string;
}

export interface EmailResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

// ─── Core send ──────────────────────────────────────────────────────────────

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
    const provider = env.EMAIL_PROVIDER || 'console';
    const from = message.from || env.EMAIL_FROM || 'noreply@hireflow.ai';
    const recipients = Array.isArray(message.to) ? message.to : [message.to];

    switch (provider) {
        case 'sendgrid':
            return sendViaSendGrid({ ...message, to: recipients, from });
        case 'smtp':
            return sendViaSmtp({ ...message, to: recipients, from });
        case 'console':
        default:
            return sendViaConsole({ ...message, to: recipients, from });
    }
}

// ─── SendGrid provider ──────────────────────────────────────────────────────

async function sendViaSendGrid(msg: EmailMessage & { to: string[]; from: string }): Promise<EmailResult> {
    const apiKey = env.SENDGRID_API_KEY;
    if (!apiKey) {
        logger.error('SendGrid selected but SENDGRID_API_KEY not set');
        return { success: false, error: 'SENDGRID_API_KEY not configured' };
    }

    try {
        const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                personalizations: [{ to: msg.to.map((email) => ({ email })) }],
                from: { email: msg.from },
                subject: msg.subject,
                content: [
                    ...(msg.text ? [{ type: 'text/plain', value: msg.text }] : []),
                    ...(msg.html ? [{ type: 'text/html', value: msg.html }] : []),
                ],
            }),
        });

        if (response.status >= 200 && response.status < 300) {
            const messageId = response.headers.get('x-message-id') || undefined;
            logger.info({ to: msg.to, messageId }, 'Email sent via SendGrid');
            return { success: true, messageId };
        }

        const errorBody = await response.text();
        logger.error({ status: response.status, body: errorBody }, 'SendGrid error');
        return { success: false, error: `SendGrid ${response.status}: ${errorBody}` };
    } catch (err: unknown) {
        logger.error({ err }, 'SendGrid send failed');
        return { success: false, error: extractErrorMessage(err) };
    }
}

// ─── SMTP provider (placeholder) ────────────────────────────────────────────

async function sendViaSmtp(msg: EmailMessage & { to: string[]; from: string }): Promise<EmailResult> {
    // TODO: integrate nodemailer when needed
    logger.warn('SMTP provider not yet implemented, falling back to console');
    return sendViaConsole(msg);
}

// ─── Console provider (development) ─────────────────────────────────────────

async function sendViaConsole(msg: EmailMessage & { to: string[]; from: string }): Promise<EmailResult> {
    logger.info({
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        bodyPreview: (msg.text || msg.html || '').substring(0, 120),
    }, '📧 Email (console provider — NOT sent)');
    return { success: true, messageId: `console-${Date.now()}` };
}

// ─── Shared HTML layout ─────────────────────────────────────────────────────

function emailLayout(content: string): string {
    return `
        <div style="font-family: system-ui, -apple-system, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
            ${content}
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
            <p style="color: #9ca3af; font-size: 12px;">Powered by HireFlow AI</p>
        </div>
    `;
}

function primaryButton(text: string, url: string): string {
    return `
        <p style="text-align: center; padding: 20px 0;">
            <a href="${url}"
               style="background: #4f46e5; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; display: inline-block; font-weight: 600;">
                ${text}
            </a>
        </p>
    `;
}

// ─── Template: Interview Invite ─────────────────────────────────────────────

export function interviewInviteEmail(candidateName: string, jobTitle: string, interviewUrl: string): EmailMessage {
    return {
        to: '',
        subject: `面试邀请：${jobTitle}`,
        html: emailLayout(`
            <h2>你好 ${candidateName}，</h2>
            <p>你已被邀请参加 <strong>${jobTitle}</strong> 的 AI 面试。</p>
            <p>准备好后请点击下方按钮开始：</p>
            ${primaryButton('开始面试', interviewUrl)}
            <p style="color: #6b7280; font-size: 14px;">
                此链接仅供您本人使用，请勿分享。<br>
                请确保摄像头、麦克风正常工作，网络连接稳定。
            </p>
        `),
        text: `你好 ${candidateName}，你已被邀请参加 ${jobTitle} 的面试。访问: ${interviewUrl}`,
    };
}

// ─── Template: Interview Complete ───────────────────────────────────────────

export function interviewCompleteEmail(candidateName: string, jobTitle: string): EmailMessage {
    return {
        to: '',
        subject: `面试已完成：${candidateName} — ${jobTitle}`,
        html: emailLayout(`
            <h2>面试已完成</h2>
            <p><strong>${candidateName}</strong> 已完成 <strong>${jobTitle}</strong> 的面试。</p>
            <p>您可以在 HireFlow 仪表盘中查看结果和证据。</p>
        `),
        text: `${candidateName} 已完成 ${jobTitle} 的面试。请在仪表盘中查看。`,
    };
}

// ─── Template: High Risk Alert ──────────────────────────────────────────────

export function highRiskAlertEmail(interviewId: string, alertType: string, message: string): EmailMessage {
    return {
        to: '',
        subject: `⚠️ 高风险预警：面试 ${interviewId.substring(0, 8)}`,
        html: emailLayout(`
            <h2 style="color: #dc2626;">⚠️ 高风险预警</h2>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 8px; font-weight: 600;">面试 ID</td><td style="padding: 8px;">${interviewId}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600;">类型</td><td style="padding: 8px;">${alertType}</td></tr>
                <tr><td style="padding: 8px; font-weight: 600;">详情</td><td style="padding: 8px;">${message}</td></tr>
            </table>
            <p>请立即在 HireFlow 监控仪表盘中查看。</p>
        `),
        text: `高风险预警 - 面试 ${interviewId}: ${alertType} - ${message}`,
    };
}

// ─── Template: Candidate Welcome ────────────────────────────────────────────

export function candidateWelcomeEmail(candidateName: string, jobTitle: string, companyName: string): EmailMessage {
    return {
        to: '',
        subject: `申请确认：${jobTitle} — ${companyName}`,
        html: emailLayout(`
            <h2>你好 ${candidateName}，</h2>
            <p>感谢您申请 <strong>${companyName}</strong> 的 <strong>${jobTitle}</strong> 职位。</p>
            <p>我们已收到您的申请，招聘团队将尽快审核并与您联系。</p>
            <p style="color: #6b7280; font-size: 14px;">
                如有任何问题，请回复此邮件。
            </p>
        `),
        text: `你好 ${candidateName}，感谢您申请 ${companyName} 的 ${jobTitle}。我们已收到您的申请。`,
    };
}

// ─── Template: Interview Reminder ───────────────────────────────────────────

export function interviewReminderEmail(
    candidateName: string,
    jobTitle: string,
    interviewUrl: string,
    scheduledTime: string,
): EmailMessage {
    return {
        to: '',
        subject: `面试提醒：${jobTitle}（${scheduledTime}）`,
        html: emailLayout(`
            <h2>你好 ${candidateName}，</h2>
            <p>温馨提醒您的 <strong>${jobTitle}</strong> 面试即将开始：</p>
            <p style="font-size: 18px; font-weight: 600; color: #4f46e5; text-align: center; padding: 12px 0;">
                ${scheduledTime}
            </p>
            ${primaryButton('进入面试', interviewUrl)}
            <p style="color: #6b7280; font-size: 14px;">
                请提前准备好安静环境、摄像头和麦克风。
            </p>
        `),
        text: `你好 ${candidateName}，提醒您 ${jobTitle} 面试将在 ${scheduledTime} 开始。链接: ${interviewUrl}`,
    };
}

// ─── Template: Stage Change Notification ────────────────────────────────────

export function stageChangeEmail(
    candidateName: string,
    jobTitle: string,
    previousStage: string,
    newStage: string,
): EmailMessage {
    return {
        to: '',
        subject: `候选人状态变更：${candidateName} — ${jobTitle}`,
        html: emailLayout(`
            <h2>候选人状态变更</h2>
            <p>候选人 <strong>${candidateName}</strong>（${jobTitle}）的状态已更新：</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                <tr>
                    <td style="padding: 8px; font-weight: 600;">原状态</td>
                    <td style="padding: 8px;"><span style="background: #f3f4f6; padding: 4px 12px; border-radius: 12px;">${previousStage}</span></td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: 600;">新状态</td>
                    <td style="padding: 8px;"><span style="background: #dbeafe; padding: 4px 12px; border-radius: 12px; color: #1d4ed8;">${newStage}</span></td>
                </tr>
            </table>
            <p>请在 HireFlow 仪表盘中查看详情。</p>
        `),
        text: `${candidateName}（${jobTitle}）状态已从 ${previousStage} 变更为 ${newStage}。`,
    };
}

// ─── Template: Password Reset ───────────────────────────────────────────────

export function passwordResetEmail(userName: string, resetUrl: string): EmailMessage {
    return {
        to: '',
        subject: 'HireFlow 密码重置',
        html: emailLayout(`
            <h2>你好 ${userName}，</h2>
            <p>我们收到了您的密码重置请求。点击下方按钮设置新密码：</p>
            ${primaryButton('重置密码', resetUrl)}
            <p style="color: #6b7280; font-size: 14px;">
                此链接 30 分钟内有效。如果您没有发起此请求，请忽略此邮件。
            </p>
        `),
        text: `你好 ${userName}，请访问以下链接重置密码: ${resetUrl}（30 分钟有效）`,
    };
}

// ─── Template: Team Invite ──────────────────────────────────────────────────

export function teamInviteEmail(
    inviterName: string,
    companyName: string,
    inviteUrl: string,
    role: string,
): EmailMessage {
    return {
        to: '',
        subject: `${inviterName} 邀请您加入 ${companyName} — HireFlow`,
        html: emailLayout(`
            <h2>您被邀请加入 ${companyName}</h2>
            <p><strong>${inviterName}</strong> 邀请您以 <strong>${role}</strong> 身份加入 ${companyName} 的 HireFlow 招聘平台。</p>
            ${primaryButton('接受邀请', inviteUrl)}
            <p style="color: #6b7280; font-size: 14px;">
                此邀请 7 天内有效。
            </p>
        `),
        text: `${inviterName} 邀请您以 ${role} 身份加入 ${companyName} 的 HireFlow。访问: ${inviteUrl}`,
    };
}
