import { logger } from "./logger";
import {
    S3Client,
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
    HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

let s3Client: S3Client | null = null;

/**
 * Returns a singleton S3Client configured for MinIO or AWS S3.
 * Returns null if S3 credentials are not configured.
 */
export function getS3(): S3Client | null {
    if (!env.S3_ACCESS_KEY || !env.S3_SECRET_KEY) return null;
    if (s3Client) return s3Client;

    s3Client = new S3Client({
        endpoint: env.S3_ENDPOINT || undefined,
        region: env.S3_REGION,
        credentials: {
            accessKeyId: env.S3_ACCESS_KEY,
            secretAccessKey: env.S3_SECRET_KEY,
        },
        forcePathStyle: true, // Required for MinIO
    });

    return s3Client;
}

const bucket = () => env.S3_BUCKET;

/**
 * Upload a file to S3/MinIO.
 */
export async function uploadFile(
    key: string,
    body: Buffer | string | ReadableStream,
    contentType: string
): Promise<{ key: string; bucket: string } | null> {
    const client = getS3();
    if (!client) {
        logger.warn({ key }, '[S3] Client not configured — upload skipped');
        return null;
    }

    await client.send(new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        Body: body as any,
        ContentType: contentType,
    }));

    return { key, bucket: bucket() };
}

/**
 * Generate a pre-signed GET URL for file download.
 * @param key S3 object key
 * @param expiresInSeconds URL validity (default 1 hour)
 */
export async function getPresignedUrl(
    key: string,
    expiresInSeconds = 3600
): Promise<string | null> {
    const client = getS3();
    if (!client) {
        logger.warn({ key }, '[S3] Client not configured — cannot generate presigned URL');
        return null;
    }

    const command = new GetObjectCommand({
        Bucket: bucket(),
        Key: key,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Generate a pre-signed PUT URL for direct upload from client.
 * @param key S3 object key
 * @param contentType MIME type
 * @param expiresInSeconds URL validity (default 30 minutes)
 */
export async function getPresignedUploadUrl(
    key: string,
    contentType: string,
    expiresInSeconds = 1800
): Promise<string | null> {
    const client = getS3();
    if (!client) return null;

    const command = new PutObjectCommand({
        Bucket: bucket(),
        Key: key,
        ContentType: contentType,
    });

    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/**
 * Delete a file from S3/MinIO.
 */
export async function deleteFile(key: string): Promise<boolean> {
    const client = getS3();
    if (!client) return false;

    try {
        await client.send(new DeleteObjectCommand({
            Bucket: bucket(),
            Key: key,
        }));
        return true;
    } catch (err) {
        logger.error({ err, key }, '[S3] Failed to delete');
        return false;
    }
}

/**
 * Check if a file exists in S3/MinIO.
 */
export async function fileExists(key: string): Promise<boolean> {
    const client = getS3();
    if (!client) return false;

    try {
        await client.send(new HeadObjectCommand({
            Bucket: bucket(),
            Key: key,
        }));
        return true;
    } catch {
        return false;
    }
}
