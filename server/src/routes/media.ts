import { FastifyInstance } from 'fastify';
import { authenticate } from '../utils/auth';
import { prisma } from '../utils/prisma';
import { success } from '../utils/response';
import { getPresignedUrl, getPresignedUploadUrl, fileExists } from '../utils/s3';

export const mediaRoutes = async (app: FastifyInstance) => {
    /**
     * GET /api/interviews/:id/media/playback
     * Generate a pre-signed S3 URL for interview video playback.
     */
    app.get('/api/interviews/:id/media/playback', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };

            const interview = await prisma.interview.findFirst({
                where: { id, job: { companyId: user.companyId } },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            // Try real S3 storage first
            const s3Key = `recordings/${id}/interview.webm`;
            const exists = await fileExists(s3Key);

            if (exists) {
                const url = await getPresignedUrl(s3Key, 3600);
                if (url) {
                    return success({
                        url,
                        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                        source: 's3',
                    });
                }
            }

            // Fallback: check for mp4 variant
            const mp4Key = `recordings/${id}/interview.mp4`;
            const mp4Exists = await fileExists(mp4Key);
            if (mp4Exists) {
                const url = await getPresignedUrl(mp4Key, 3600);
                if (url) {
                    return success({
                        url,
                        expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                        source: 's3',
                    });
                }
            }

            // Development fallback: use test video
            const fallbackUrl = `https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_1MB.mp4`;
            return success({
                url: fallbackUrl,
                expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
                source: 'fallback',
            });
        } catch (err: unknown) {
            request.log.error(err, 'Failed to generate media URL');
            return reply.status(500).send({ error: 'Failed to generate playback URL' });
        }
    });

    /**
     * POST /api/interviews/:id/media/upload-url
     * Generate a pre-signed S3 URL for client-side upload.
     */
    app.post('/api/interviews/:id/media/upload-url', async (request, reply) => {
        try {
            const user = await authenticate(request);
            const { id } = request.params as { id: string };
            const { contentType, filename } = request.body as { contentType?: string; filename?: string };

            const interview = await prisma.interview.findFirst({
                where: { id, job: { companyId: user.companyId } },
            });

            if (!interview) {
                return reply.status(404).send({ error: 'Interview not found' });
            }

            const mime = contentType || 'video/webm';
            const ext = filename?.split('.').pop() || 'webm';
            const s3Key = `recordings/${id}/interview.${ext}`;

            const url = await getPresignedUploadUrl(s3Key, mime, 1800);
            if (!url) {
                return reply.status(503).send({ error: 'Object storage not configured' });
            }

            return success({
                uploadUrl: url,
                key: s3Key,
                expiresAt: new Date(Date.now() + 1800 * 1000).toISOString(),
            });
        } catch (err: unknown) {
            request.log.error(err, 'Failed to generate upload URL');
            return reply.status(500).send({ error: 'Failed to generate upload URL' });
        }
    });
};
