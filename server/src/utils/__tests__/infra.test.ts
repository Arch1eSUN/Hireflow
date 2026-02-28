import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env before importing the module
vi.mock('../../config/env', () => ({
    env: {
        REDIS_URL: undefined,
        S3_ACCESS_KEY: undefined,
        S3_SECRET_KEY: undefined,
        S3_BUCKET: 'test-bucket',
        S3_REGION: 'us-east-1',
        S3_ENDPOINT: undefined,
        EMAIL_PROVIDER: 'console',
        EMAIL_FROM: 'test@hireflow.ai',
        SENDGRID_API_KEY: undefined,
        SMTP_HOST: undefined,
    },
}));

describe('Redis 工具模块', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('REDIS_URL 未设置时 getRedis 返回 null', async () => {
        const { getRedis } = await import('../../utils/redis');
        const client = getRedis();
        expect(client).toBeNull();
    });

    it('cacheGet 在无 Redis 时返回 null', async () => {
        const { cacheGet } = await import('../../utils/redis');
        const result = await cacheGet('test-key');
        expect(result).toBeNull();
    });

    it('cacheSet 在无 Redis 时静默成功', async () => {
        const { cacheSet } = await import('../../utils/redis');
        // 不应抛出异常
        await expect(cacheSet('test-key', { foo: 'bar' })).resolves.toBeUndefined();
    });

    it('cacheDel 在无 Redis 时静默成功', async () => {
        const { cacheDel } = await import('../../utils/redis');
        await expect(cacheDel('test-key')).resolves.toBeUndefined();
    });
});

describe('S3 工具模块', () => {
    beforeEach(() => {
        vi.resetModules();
    });

    it('S3 凭证未设置时 getS3 返回 null', async () => {
        const { getS3 } = await import('../../utils/s3');
        const client = getS3();
        expect(client).toBeNull();
    });

    it('uploadFile 在无 S3 时返回 null', async () => {
        const { uploadFile } = await import('../../utils/s3');
        const result = await uploadFile('test.txt', 'content', 'text/plain');
        expect(result).toBeNull();
    });

    it('getPresignedUrl 在无 S3 时返回 null', async () => {
        const { getPresignedUrl } = await import('../../utils/s3');
        const result = await getPresignedUrl('test.txt');
        expect(result).toBeNull();
    });

    it('fileExists 在无 S3 时返回 false', async () => {
        const { fileExists } = await import('../../utils/s3');
        const result = await fileExists('test.txt');
        expect(result).toBe(false);
    });

    it('deleteFile 在无 S3 时返回 false', async () => {
        const { deleteFile } = await import('../../utils/s3');
        const result = await deleteFile('test.txt');
        expect(result).toBe(false);
    });
});
