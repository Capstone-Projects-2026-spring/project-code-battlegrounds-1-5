import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth'

/**
 * Gets player counts for both teams in the game room
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const session = await auth.api.getSession({ headers: req.headers as Record<string, string> });
    if (!session) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        const { gameId } = req.query;

        const teams = await prisma.team.findMany({
            where: { gameRoomId: gameId as string },
            include: { _count: { select: { players: true } } }
        });

        return res.status(200).json({
            teams: teams.map(t => ({
                teamId: t.id,
                playerCount: t._count.players
            }))
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch team counts' });
    }
}