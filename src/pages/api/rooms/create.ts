import type {NextApiRequest, NextApiResponse} from 'next';
import {auth} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProblemDifficulty } from "@prisma/client";
import { nanoid } from "nanoid";
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
//Defensive validation for difficulty parameter. It should be one of "EASY", "MEDIUM", "HARD" if provided.
const { difficulty } = req.body as { difficulty?: ProblemDifficulty };

if (!difficulty || !Object.values(ProblemDifficulty).includes(difficulty)) {
    return res.status(400).json({ message: "Invalid difficulty" });
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
        const roomID = nanoid(8);
        console.log("Generated room ID:", roomID);

        // Pick one random problem from the requested difficulty bucket.
        const where = { difficulty };
        const problemCount = await prisma.problem.count({ where });
        if (problemCount === 0) {
            return res.status(500).json({message: 'No problems found in the database'});
        }

        const skip = Math.floor(Math.random() * problemCount);
        const problem = await prisma.problem.findFirst({
            where,
            orderBy: { id: 'asc' },
            skip,
        });

        if (!problem) {
            return res.status(500).json({message: 'Failed to select a random problem'});
        }

        // Need to make a database call to Problem table but there are no Problems in the table right now
        const gameRoom = await prisma.gameRoom.create({
            data: {
                id: roomID,
                problemId: problem.id,
            },
        });

        // TODO: here, store in redis pubsub channel called "matchmaking" or such so that other players can find it. then, before generating a new room, try to join any existing rooms. if room is joined and becomes full, mark it as in progress in postgres. See CODEBAT-14 and CODEBAT-56

        // return generated code
        return res.status(201).json({gameId: gameRoom.id});
    } catch (error: unknown) {
        if (error instanceof Error) {
            // Return error message with status 500 (internal server error) if something goes wrong during game room creation
            return res.status(500).json({message: error?.message || 'Failed to create game room'});
        } else {
            return res.status(500).json({message: 'Failed to create game room'});
        }
    }
}  