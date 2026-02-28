import jwt from 'jsonwebtoken';
import { env } from '../config/env';

const JWT_SECRET = env.JWT_SECRET;

type AccessTokenPayload = {
    userId: string;
    email: string;
    role: string;
    companyId: string;
};

type RefreshTokenPayload = AccessTokenPayload & {
    tokenVersion: number;
};

export type VerifiedTokenPayload = AccessTokenPayload & {
    tokenVersion?: number;
    iat?: number;
    exp?: number;
};

export const signAccessToken = (payload: AccessTokenPayload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
};

export const signRefreshToken = (payload: RefreshTokenPayload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const verifyToken = (token: string): VerifiedTokenPayload | null => {
    try {
        return jwt.verify(token, JWT_SECRET) as VerifiedTokenPayload;
    } catch (err) {
        return null;
    }
};
