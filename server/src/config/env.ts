import { z } from 'zod';

const RawEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().min(1).default('0.0.0.0'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
    ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY must be exactly 32 characters'),
    AUTH_COOKIE_SAMESITE: z.enum(['strict', 'lax', 'none']).optional(),
    AUTH_COOKIE_SECURE: z.enum(['true', 'false']).optional(),
    CORS_ORIGIN: z.string().optional(),
    APP_URL: z.string().url().optional(),

    // Redis
    REDIS_URL: z.string().optional(),

    // S3 / MinIO
    S3_ENDPOINT: z.string().optional(),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_BUCKET: z.string().default('hireflow-storage'),
    S3_REGION: z.string().default('us-east-1'),

    // Email (SendGrid or SMTP)
    EMAIL_PROVIDER: z.enum(['sendgrid', 'smtp', 'console']).optional(),
    SENDGRID_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    SMTP_HOST: z.string().optional(),
    SMTP_PORT: z.coerce.number().optional(),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),

    // Monitoring
    SENTRY_DSN: z.string().optional(),
    SENTRY_RELEASE: z.string().optional(),

    // ── AI Provider API Keys ──
    OPENAI_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),

    // ── XiaoFan AI Runtime ──
    XIAOFAN_API_MODE: z.string().optional(),
    XIAOFAN_OPENAI_MODEL: z.string().optional(),
    XIAOFAN_OPENAI_BASE_URL: z.string().optional(),
    XIAOFAN_SPEECH_CHARS_PER_SEC: z.coerce.number().optional(),

    // STT (Speech-to-Text)
    XIAOFAN_STT_PROVIDER: z.enum(['openai', 'google']).optional(),
    XIAOFAN_STT_MODEL: z.string().optional(),
    XIAOFAN_STT_FALLBACK_MODEL: z.string().optional(),
    XIAOFAN_STT_BASE_URL: z.string().optional(),
    XIAOFAN_STT_LANGUAGE: z.string().optional(),
    XIAOFAN_STT_MIME_TYPE: z.string().optional(),
    XIAOFAN_STT_GOOGLE_MODEL: z.string().optional(),
    XIAOFAN_GEMINI_STT_MODEL: z.string().optional(),

    // TTS (Text-to-Speech)
    XIAOFAN_TTS_MODEL: z.string().optional(),
    XIAOFAN_TTS_BASE_URL: z.string().optional(),
    XIAOFAN_TTS_VOICE: z.string().optional(),
    XIAOFAN_TTS_FORMAT: z.string().optional(),
    XIAOFAN_TTS_SPEED: z.coerce.number().optional(),

    // Feature Flags
    ENABLE_PUBLIC_DEMO_TOKEN: z.enum(['true', 'false']).optional(),
    HIREFLOW_ALLOW_MOCK_PROVIDER: z.enum(['true', 'false']).optional(),
});

const INSECURE_DEV_SECRETS = new Set([
    'dev-secret',
    'dev-secret-cookie',
    'dev-secret-key',
    'dev-jwt-secret-do-not-use-in-prod',
    '12345678901234567890123456789012',
]);

function formatEnvErrors(error: z.ZodError): string {
    return error.issues
        .map((issue) => {
            const path = issue.path.join('.') || 'env';
            return `${path}: ${issue.message}`;
        })
        .join('; ');
}

const parsed = RawEnvSchema.safeParse(process.env);
if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${formatEnvErrors(parsed.error)}`);
}

const validatedData = parsed.data;

if (validatedData.NODE_ENV === 'production') {
    if (INSECURE_DEV_SECRETS.has(validatedData.JWT_SECRET)) {
        throw new Error('JWT_SECRET is using an insecure development default in production');
    }
    if (INSECURE_DEV_SECRETS.has(validatedData.ENCRYPTION_KEY)) {
        throw new Error('ENCRYPTION_KEY is using an insecure development default in production');
    }
    if (!validatedData.CORS_ORIGIN) {
        throw new Error('CORS_ORIGIN is required in production mode');
    }
}

function deriveAppUrl(): string {
    if (validatedData.APP_URL) return validatedData.APP_URL;
    const corsOrigin = validatedData.CORS_ORIGIN || '';
    const first = corsOrigin.split(',').map(s => s.trim()).find(s => /^https?:\/\/[^/\s]+$/i.test(s));
    return first || `http://localhost:${validatedData.PORT}`;
}

export const env = {
    ...validatedData,
    APP_URL: deriveAppUrl(),
    AUTH_COOKIE_SAMESITE: validatedData.AUTH_COOKIE_SAMESITE ?? 'lax',
    AUTH_COOKIE_SECURE:
        validatedData.AUTH_COOKIE_SECURE === 'true'
            ? true
            : validatedData.AUTH_COOKIE_SECURE === 'false'
                ? false
                : validatedData.NODE_ENV === 'production',
};

export type AppEnv = typeof env;
