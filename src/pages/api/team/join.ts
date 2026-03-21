import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';
import { getIO } from '@/lib/server-context'

/**
 * Allows user to create and join a team or join an existing team
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const session = await auth.api.getSession({ headers: req.headers as any });
    if (!session) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        const { userId, gameRoomId, teamId } = req.body;

        const alreadyInGame = await prisma.teamPlayer.findFirst({
            where: { userId, team: { gameRoomId } }
        });

        if (alreadyInGame) {
            return res.status(200).json({ teamId, role: alreadyInGame.role });
        }

        let playerCount = await prisma.teamPlayer.count({ where: { teamId } })
        let role: Role = Role.CODER;

        if (playerCount >= 2) {
            role = Role.SPECTATOR
            return res.status(201).json({ role })
        } else if (playerCount === 1) {
            role = Role.TESTER
        }

        const team = await prisma.team.update({
            where: { id: teamId },
            data: {
                players: {
                    create: {
                        userId,
                        role
                    }
                }
            }
        })
        playerCount++;

        const io = getIO(req);
        if (io) {
            io.emit('teamUpdated', { teamId, playerCount })
        }

        return res.status(201).json({ role })
    } catch (error) {
        if (error instanceof Error) {
            // Return error message with status 500 (internal server error) if something goes wrong during team join
            return res.status(500).json({ message: error?.message || 'Failed to create game room' });
        } else {
            return res.status(500).json({ message: 'Failed to create game room' });
        }
    }
}