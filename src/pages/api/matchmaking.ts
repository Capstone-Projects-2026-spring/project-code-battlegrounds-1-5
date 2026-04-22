import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!session?.user) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = session.user.id;

    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const user = await prisma.user.findFirst({
        where: { id: userId },
        select: { elo: true }
    });

    if (!user) return res.status(403).json({ error: "how?" });

    return res.status(200).json({
        elo: user.elo
    });
}