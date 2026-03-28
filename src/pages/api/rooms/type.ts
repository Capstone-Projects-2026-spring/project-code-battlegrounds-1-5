import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth'

/**
 * Gets game type for a given game room ID
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

        if (!gameId || typeof gameId !== 'string') {
            return res.status(400).json({ message: 'Missing or invalid gameId' });
        }

        const gameRoom = await prisma.gameRoom.findUnique({
            where: { id: gameId as string },
            select: { gameType: true }
        });

        if (!gameRoom) {
            return res.status(404).json({ message: 'Game room not found' });
        }

        return res.status(200).json({
            gameType: gameRoom.gameType
        });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch game type' });
    }
}