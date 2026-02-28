import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const ENC_KEY = Buffer.from(env.ENCRYPTION_KEY, 'utf8');
if (ENC_KEY.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be exactly 32 bytes when encoded as UTF-8');
}
const IV_LENGTH = 16;

/**
 * Encrypts generic text
 * Format: iv:authTag:encrypted
 */
export const encrypt = (text: string): string => {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, ENC_KEY, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

/**
 * Decrypts text
 */
export const decrypt = (text: string): string => {
    const [ivHex, authTagHex, encryptedText] = text.split(':');
    if (!ivHex || !authTagHex || !encryptedText) {
        throw new Error('Invalid encrypted format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENC_KEY, iv);

    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
