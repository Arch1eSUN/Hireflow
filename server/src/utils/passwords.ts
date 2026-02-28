import * as bcryptNamespace from 'bcrypt';

const SALT_ROUNDS = 10;

type BcryptLike = {
    hash: (password: string, rounds: number) => Promise<string>;
    compare: (password: string, hash: string) => Promise<boolean>;
};

const bcryptLib: BcryptLike = (
    (bcryptNamespace as any)?.default
    && typeof (bcryptNamespace as any).default.hash === 'function'
    && typeof (bcryptNamespace as any).default.compare === 'function'
)
    ? (bcryptNamespace as any).default
    : (bcryptNamespace as unknown as BcryptLike);

export const hashPassword = async (password: string) => {
    return bcryptLib.hash(password, SALT_ROUNDS);
};

export const comparePassword = async (password: string, hash: string) => {
    return bcryptLib.compare(password, hash);
};
