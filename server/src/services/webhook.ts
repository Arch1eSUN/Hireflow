import { extractErrorMessage } from '../utils/errors';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export class WebhookService {
    /**
     * Dispatches an event to all active webhook endpoints subscribed to it for a given company.
     */
    static async dispatchEvent(companyId: string, eventName: string, payload: Prisma.InputJsonValue) {
        try {
            // Find all active endpoints for this company to send this event
            const endpoints = await prisma.webhookEndpoint.findMany({
                where: {
                    companyId,
                    isActive: true,
                    events: {
                        has: eventName,
                    },
                },
            });

            if (endpoints.length === 0) {
                return; // No webhooks to trigger
            }

            await Promise.all(
                endpoints.map(async (endpoint) => {
                    const payloadString = JSON.stringify(payload);
                    const signature = crypto
                        .createHmac('sha256', endpoint.secret)
                        .update(payloadString)
                        .digest('hex');

                    let responseStatus: number | null = null;
                    let responseBody: string | null = null;

                    try {
                        const controller = new AbortController();
                        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

                        const res = await fetch(endpoint.url, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Hireflow-Event': eventName,
                                'X-Hireflow-Signature': `sha256=${signature}`,
                                'User-Agent': 'Hireflow-Webhook/1.0',
                            },
                            body: payloadString,
                            signal: controller.signal,
                        });

                        clearTimeout(timeoutId);

                        responseStatus = res.status;
                        responseBody = await res.text();

                        // Truncate response body if it's too long
                        if (responseBody && responseBody.length > 1000) {
                            responseBody = responseBody.substring(0, 1000) + '...';
                        }
                    } catch (error: unknown) {
                        responseStatus = 0; // 0 indicates network error or timeout
                        responseBody = extractErrorMessage(error) || 'Unknown network error';
                    }

                    // Record the delivery attempt
                    try {
                        await prisma.webhookDelivery.create({
                            data: {
                                endpointId: endpoint.id,
                                event: eventName,
                                payload: payload, // Store as JSON
                                responseStatus,
                                responseBody,
                            },
                        });
                    } catch (dbError) {
                        logger.error({ err: dbError }, '[WebhookService] Failed to record delivery');
                    }
                })
            );
        } catch (err) {
            logger.error({ err }, '[WebhookService] Failed to dispatch event');
        }
    }
}
