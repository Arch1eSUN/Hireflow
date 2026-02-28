import { prisma } from '../utils/prisma';
import pino from 'pino';

const logger = pino({
    name: 'cleanup-task',
    level: 'info',
    transport: {
        target: 'pino-pretty',
        options: { colorize: true },
    },
});

export async function cleanupOldData() {
    try {
        logger.info('Starting scheduled data cleanup task...');

        // Fetch all company settings that have data retention policies
        const settings = await prisma.companySettings.findMany({
            select: {
                companyId: true,
                dataRetentionDays: true
            }
        });

        // If a company has no specific setting, we'll use a globally safe default of 90 days
        const processedCompanies = new Set<string>();
        let totalAuditLogsDeleted = 0;

        for (const setting of settings) {
            processedCompanies.add(setting.companyId);
            const retentionDate = new Date();
            retentionDate.setDate(retentionDate.getDate() - setting.dataRetentionDays);

            const result = await prisma.auditLog.deleteMany({
                where: {
                    companyId: setting.companyId,
                    createdAt: {
                        lt: retentionDate
                    }
                }
            });

            if (result.count > 0) {
                logger.info(`Cleaned up ${result.count} AuditLog items for company ${setting.companyId} older than ${setting.dataRetentionDays} days.`);
                totalAuditLogsDeleted += result.count;
            }
        }

        // Catch-all for companies without custom CompanySettings (using default 90 days)
        const defaultRetentionDate = new Date();
        defaultRetentionDate.setDate(defaultRetentionDate.getDate() - 90);

        const defaultResult = await prisma.auditLog.deleteMany({
            where: {
                companyId: {
                    notIn: Array.from(processedCompanies)
                },
                createdAt: {
                    lt: defaultRetentionDate
                }
            }
        });

        if (defaultResult.count > 0) {
            logger.info(`Cleaned up ${defaultResult.count} AuditLog items for companies without specific retention settings (older than 90 days).`);
            totalAuditLogsDeleted += defaultResult.count;
        }

        logger.info(`Scheduled data cleanup task completed successfully. Total AuditLogs deleted: ${totalAuditLogsDeleted}.`);

        // ── 清理旧的 webhook delivery 记录（保留 30 天） ──
        const deliveryRetentionDate = new Date();
        deliveryRetentionDate.setDate(deliveryRetentionDate.getDate() - 30);
        const deliveryResult = await prisma.webhookDelivery.deleteMany({
            where: { createdAt: { lt: deliveryRetentionDate } }
        });
        if (deliveryResult.count > 0) {
            logger.info(`Cleaned up ${deliveryResult.count} old WebhookDelivery records (>30 days).`);
        }

        // ── 清理已读通知（保留 60 天） ──
        const notiRetentionDate = new Date();
        notiRetentionDate.setDate(notiRetentionDate.getDate() - 60);
        const notiResult = await prisma.notification.deleteMany({
            where: { read: true, createdAt: { lt: notiRetentionDate } }
        });
        if (notiResult.count > 0) {
            logger.info(`Cleaned up ${notiResult.count} old read notifications (>60 days).`);
        }

    } catch (error) {
        logger.error({ err: error }, 'Scheduled data cleanup task failed');
    }
}

let cleanupTimer: NodeJS.Timeout | null = null;

export function startCleanupTask() {
    // Run immediately on boot to clear out heavily bloated logs from previous runs
    void cleanupOldData();

    // Then schedule to run every 24 hours (24 * 60 * 60 * 1000 ms)
    const INTERVAL_MS = 24 * 60 * 60 * 1000;
    cleanupTimer = setInterval(() => {
        void cleanupOldData();
    }, INTERVAL_MS);

    logger.info('Data cleanup background task scheduled (runs daily).');
}

export function stopCleanupTask() {
    if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
        logger.info('Data cleanup background task stopped.');
    }
}
