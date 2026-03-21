import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getIO, getRedis } from '@/lib/server-context'

/**
 * Allows user to create and join a team or join an existing team
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        const { userId, gameRoomId } = req.query;
        const userIdT = userId as string;
        const gameRoomIdT = gameRoomId as string;


        const player = await prisma.teamPlayer.findFirst({
            where: {
                userId: userIdT,
                team: { gameRoomId: gameRoomIdT }
            },
            include: { team: true }
        });

        if (player) {
            return res.status(200).json({ teamId: player.teamId, role: player.role });
        }

        return res.status(200).json({ teamId: null });
    } catch (error) {
        if (error instanceof Error) {
            // Return error message with status 500 (internal server error) if something goes wrong during team join
            return res.status(500).json({ message: error?.message || 'Failed to create game room' });
        } else {
            return res.status(500).json({ message: 'Failed to create game room' });
        }
    }
}