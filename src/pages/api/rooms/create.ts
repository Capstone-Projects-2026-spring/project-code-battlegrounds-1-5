import type {NextApiRequest, NextApiResponse} from 'next';
import {nanoid} from 'nanoid';
import {auth} from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * API route handler for creating a new game room.
 * This endpoint is called when the user clicks the "Create Game Room" button on the landing page.
 * It generates a unique game ID and stores it as waiting in PostgreSQL via Prisma.
 * It then returns the game ID to the client. The is responsible for redirect to the game with this ID.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // only allow posts
    if (req.method !== 'POST') {
        return res.status(405).json({message: 'Method not allowed'});
    }

    // check auth status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const session = await auth.api.getSession({headers: req.headers as any});
    if (!session) {
        return res.status(401).json({ok: false, error: "Unauthorized"});
    }

    // try to generate an 8 character random string for the match id.
    // then persist it in postgres (to updated with game status changes such as in progress, completed, etc)
    try {
        const gameId = nanoid(8);

        // store in postgres
        const status = "waiting" as const;
        await prisma.gameRoom.upsert({
            where: { id: gameId },
            update: { status },
            create: { id: gameId, status },
        });

        // TODO: here, store in redis pubsub channel called "matchmaking" or such so that other players can find it. then, before generating a new room, try to join any existing rooms. if room is joined and becomes full, mark it as in progress in postgres. See CODEBAT-14 and CODEBAT-56

        // return generated code
        return res.status(201).json({gameId});
    } catch (error: unknown) {
        if (error instanceof Error) {
            // Return error message with status 500 (internal server error) if something goes wrong during game room creation
            return res.status(500).json({message: error?.message || 'Failed to create game room'});
        } else {
            return res.status(500).json({message: 'Failed to create game room'});
        }
    }
}  