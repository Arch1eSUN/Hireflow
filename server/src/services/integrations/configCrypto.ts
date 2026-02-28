import { decrypt, encrypt } from '../../utils/encryption';

const ENCRYPTED_SECRET_PREFIX = 'hfenc:v1:';
const SENSITIVE_CONFIG_KEY = /(key|token|secret|password|signature|credential|webhook)/i;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decryptIfEncrypted(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    if (!value.startsWith(ENCRYPTED_SECRET_PREFIX)) return value;
    const encrypted = value.slice(ENCRYPTED_SECRET_PREFIX.length);
    if (!encrypted) return '';
    try {
        return decrypt(encrypted);
    } catch {
        // Keep original value if decryption fails to preserve backward compatibility.
        return value;
    }
}

function encryptSecret(value: string): string {
    if (value.startsWith(ENCRYPTED_SECRET_PREFIX)) {
        return value;
    }
    return `${ENCRYPTED_SECRET_PREFIX}${encrypt(value)}`;
}

export function decryptIntegrationConfigSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => decryptIntegrationConfigSecrets(item));
    }
    if (!isRecord(value)) {
        return decryptIfEncrypted(value);
    }

    const output: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(value)) {
        if (Array.isArray(rawValue) || isRecord(rawValue)) {
            output[key] = decryptIntegrationConfigSecrets(rawValue);
            continue;
        }
        output[key] = decryptIfEncrypted(rawValue);
    }
    return output;
}

export function encryptIntegrationConfigSecrets(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map((item) => encryptIntegrationConfigSecrets(item));
    }
    if (!isRecord(value)) return value;

    const output: Record<string, unknown> = {};
    for (const [key, rawValue] of Object.entries(value)) {
        if (Array.isArray(rawValue) || isRecord(rawValue)) {
            output[key] = encryptIntegrationConfigSecrets(rawValue);
            continue;
        }
        if (typeof rawValue === 'string' && rawValue.length > 0 && SENSITIVE_CONFIG_KEY.test(key)) {
            output[key] = encryptSecret(rawValue);
            continue;
        }
        output[key] = rawValue;
    }
    return output;
}

