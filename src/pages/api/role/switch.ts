import type { NextApiRequest, NextApiResponse } from 'next';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { Role } from '@prisma/client';

/**
 * Switches the roles of the teams
 * NOT DONE YET TODO: Make it so depends 
 * on gameId rather than 2 teamIds
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
        const { teamId1, teamId2 } = req.body;

        const players1 = await prisma.teamPlayer.findMany({ where: { teamId: teamId1 } })
        const players2 = await prisma.teamPlayer.findMany({ where: { teamId: teamId2 } })

        await Promise.all(players1.map(player => {
            prisma.teamPlayer.update({
                where: {
                    teamId_userId: {
                        teamId: player.teamId,
                        userId: player.userId
                    }
                },
                data: {
                    role: player.role === Role.CODER ? Role.TESTER : Role.CODER
                }

            })
        }))

        await Promise.all(players2.map(player => {
            prisma.teamPlayer.update({
                where: {
                    teamId_userId: {
                        teamId: player.teamId,
                        userId: player.userId
                    }
                },
                data: {
                    role: player.role === Role.CODER ? Role.TESTER : Role.CODER
                }

            })
        }))


        const updatePlayers1 = await prisma.teamPlayer.findMany({ where: { teamId: teamId1 } })
        const updatePlayers2 = await prisma.teamPlayer.findMany({ where: { teamId: teamId2 } })

        return res.status(201).json({ updatePlayers1, updatePlayers2 })
    } catch (error) {
        if (error instanceof Error) {
            // Return error message with status 500 (internal server error) if something goes wrong during game room creation
            return res.status(500).json({ message: error?.message || 'Failed to create game room' });
        } else {
            return res.status(500).json({ message: 'Failed to create game room' });
        }
    }
}