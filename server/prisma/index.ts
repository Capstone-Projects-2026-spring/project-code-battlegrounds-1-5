import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
    if (!prisma) {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error('DATABASE_URL is not defined. Prisma cannot be initialized.');
        }

        const adapter = new PrismaPg({
            connectionString,
        });

        prisma = new PrismaClient({ adapter });
    }

    return prisma;
}