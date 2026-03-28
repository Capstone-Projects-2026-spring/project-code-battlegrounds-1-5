let prisma;

function getPrisma() {
   if (!prisma) {
    const { PrismaClient } = require('.prisma/client');
    const { PrismaPg } = require('@prisma/adapter-pg');

    const adapter = new PrismaPg({
        connectionString: process.env.DATABASE_URL,
    });

    prisma = new PrismaClient({adapter});
   } 
   return prisma;
}

module.exports = { getPrisma }