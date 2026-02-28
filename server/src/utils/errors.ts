/**
 * AppError — 业务错误基类
 * 用于在路由中抛出带有 statusCode 和 code 的结构化错误。
 * 配合 Fastify setErrorHandler 自动序列化为 JSON 响应。
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;

    constructor(statusCode: number, code: string, message: string) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
    }

    /** 常用工厂方法 */
    static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
        return new AppError(404, code, message);
    }

    static badRequest(message = 'Bad request', code = 'BAD_REQUEST') {
        return new AppError(400, code, message);
    }

    static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
        return new AppError(401, code, message);
    }

    static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
        return new AppError(403, code, message);
    }

    static conflict(message = 'Conflict', code = 'CONFLICT') {
        return new AppError(409, code, message);
    }

    static internal(message = 'Internal server error', code = 'INTERNAL_ERROR') {
        return new AppError(500, code, message);
    }
}

/**
 * 从 unknown 类型的 catch 参数中安全提取错误信息。
 * 避免使用 `(err: any).message`。
 */
export function extractErrorMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    if (typeof err === 'string') return err;
    return 'Unknown error';
}
