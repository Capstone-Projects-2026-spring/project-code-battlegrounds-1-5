import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // require auth for database queries
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const host = process.env.POSTGRES_HOST || "localhost";
    const port = Number(process.env.POSTGRES_PORT || 5432);
    const user = process.env.POSTGRES_USER || "postgres";
    const database = process.env.POSTGRES_DB || "postgres";

    const table = "infra_test_kv";
    const id = Date.now();
    const value = `hello-postgres-${Math.random().toString(36).slice(2)}`;

    try {
        // Ensure the table exists without requiring migrations in this simple test route
        await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS ${table} (id BIGINT PRIMARY KEY, val TEXT NOT NULL)`);

        // Upsert via Prisma model mapped to infra_test_kv
        await prisma.infraTestKv.upsert({
            where: { id: BigInt(id) },
            update: { val: value },
            create: { id: BigInt(id), val: value },
        });

        const readRow = await prisma.infraTestKv.findUnique({ where: { id: BigInt(id) }, select: { val: true } });
        const read = readRow?.val ?? null;

        res.status(200).json({
            ok: true,
            action: "postgres write/read (prisma)",
            host,
            port,
            user,
            database,
            table,
            id,
            written: value,
            read,
            matches: read === value,
        });
    } catch (err: any) {
        res.status(500).json({ ok: false, error: err?.message || String(err) });
    }
}
