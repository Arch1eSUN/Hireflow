
import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword } from './src/utils/passwords';

const prisma = new PrismaClient();

async function main() {
    const password = 'password123';
    const hash = await hashPassword(password);
    console.log('New Hash:', hash);

    const valid = await comparePassword(password, hash);
    console.log('Compare New Hash:', valid);

    // Check existing user
    const user = await prisma.user.findUnique({ where: { email: 'zhangtong@hireflow.ai' } });
    if (user && user.passwordHash) {
        const dbValid = await comparePassword(password, user.passwordHash);
        console.log('Compare DB Hash:', dbValid);
    } else {
        console.log('User not found in DB');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
