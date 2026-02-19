import type { NextApiRequest, NextApiResponse } from "next";
import Redis from "ioredis";
import { auth } from "@/lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // require auth for database queries
    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const host = process.env.REDIS_HOST;
    const port = Number(process.env.REDIS_PORT || 6379);

    if (!host) {
        throw new Error("REDIS_HOST is not set");
    }

    const client = new Redis({
        host,
        port,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 5_000,
    });

  try {
    await client.connect();
    const key = `infra:test:${Date.now()}`;
    const value = `hello-redis-${Math.random().toString(36).slice(2)}`;

    await client.set(key, value, "EX", 60);
    const got = await client.get(key);

    res.status(200).json({
      ok: true,
      action: "redis set/get",
      host,
      port,
      key,
      written: value,
      read: got,
      matches: got === value,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  } finally {
    try { await client.quit(); } catch {}
  }
}
