import { uploadFile, getPresignedUrl } from '../../utils/s3';
import { prisma } from '../../utils/prisma';

export interface RecordingChunk {
    interviewId: string;
    chunkIndex: number;
    data: Buffer;
    mimeType: string;
}

export interface RecordingMetadata {
    interviewId: string;
    totalChunks: number;
    totalDurationMs: number;
    mimeType: string;
    totalSizeBytes: number;
}

/**
 * 面试录制服务 — 管理面试视频的存储、拼接和回放。
 *
 * 录制流程：
 * 1. 候选人端 MediaRecorder 将视频分片为 chunks
 * 2. 每个 chunk 通过 presigned URL 直接上传到 S3
 * 3. 面试结束后，服务端可合并（或保持分片索引）
 * 4. 回放时通过 presigned URL 提供视频流
 */
export class InterviewRecordingService {
    /**
     * 上传一个录制分片到 S3。
     */
    async uploadChunk(chunk: RecordingChunk): Promise<{ key: string } | null> {
        const key = `recordings/${chunk.interviewId}/chunks/${String(chunk.chunkIndex).padStart(6, '0')}.webm`;
        const result = await uploadFile(key, chunk.data, chunk.mimeType);
        return result ? { key } : null;
    }

    /**
     * 保存录制元数据到数据库（面试结束后调用）。
     */
    async saveRecordingMetadata(meta: RecordingMetadata): Promise<void> {
        const s3Key = `recordings/${meta.interviewId}/full/interview.webm`;

        await prisma.interview.update({
            where: { id: meta.interviewId },
            data: {
                recordingUrl: s3Key,
            },
        });
    }

    /**
     * 获取面试录制回放 URL。
     */
    async getPlaybackUrl(interviewId: string): Promise<string | null> {
        const interview = await prisma.interview.findUnique({
            where: { id: interviewId },
            select: { recordingUrl: true },
        });

        if (!interview?.recordingUrl) return null;

        return getPresignedUrl(interview.recordingUrl, 3600);
    }

    /**
     * 将面试的 transcript 保存为文本文件到 S3。
     */
    async saveTranscript(interviewId: string): Promise<string | null> {
        const messages = await prisma.interviewMessage.findMany({
            where: { interviewId },
            orderBy: { createdAt: 'asc' },
        });

        if (messages.length === 0) return null;

        const transcriptText = messages
            .map((msg) => {
                const role = msg.role === 'assistant' ? '小梵' : msg.role === 'user' ? '候选人' : '系统';
                const time = msg.createdAt.toISOString().substring(11, 19);
                return `[${time}] ${role}: ${msg.content}`;
            })
            .join('\n\n');

        const key = `recordings/${interviewId}/transcript.txt`;
        const result = await uploadFile(key, Buffer.from(transcriptText, 'utf-8'), 'text/plain');

        if (result) {
            await prisma.interview.update({
                where: { id: interviewId },
                data: { transcriptUrl: key },
            });
        }

        return result ? key : null;
    }
}

export const recordingService = new InterviewRecordingService();
