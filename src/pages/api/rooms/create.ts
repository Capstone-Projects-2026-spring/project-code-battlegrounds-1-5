import type {NextApiRequest, NextApiResponse} from 'next';
import {nanoid} from 'nanoid';
import {auth} from "@/lib/auth";

/**
 * API route handler for creating a new game room.
 * This endpoint is called when the user clicks the "Create Game Room" button on the landing page.
 * It generates a unique game ID, stores it in an in-memory object (replace with Redis or DB in production),
 * and returns the game ID to the client. The client then redirects the user to the new game room page using this ID.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Only allow POST requests to create a new game room. Reject any other HTTP methods with a 405 (Method Not Allowed) status.
    if (req.method !== 'POST') {
        return res.status(405).json({message: 'Method not allowed'});
    }

    const session = await auth.api.getSession({headers: req.headers as any});
    if (!session) {
        return res.status(401).json({ok: false, error: "Unauthorized"});
    }

    // Generate a unique game ID, persist it, then return it to client and handle any errors.
    try {
        const gameId = nanoid(5); // Generate a unique n-character ID for the game room. Specify value of n.

        /// TODO: Store in Redis that this gameId exists and is waiting for players
        // Store in-memory for now, but ideally we would use Redis or a database to track active game rooms and their states
        const activeGames: Record<string, any> = {}; // In-memory store for active game rooms (replace with Redis or DB in production)
        // Store initial game room state (e.g., waiting for players) in the in-memory object. In production, this would be stored in Redis or a database.
        activeGames[gameId] = {players: [], status: 'waiting'};

        // Return generated gameId to client with status 201 (created)
        return res.status(201).json({gameId});
    } catch (error: any) {
        // Return error message with status 500 (internal server error) if something goes wrong during game room creation
        return res.status(500).json({message: error?.message || 'Failed to create game room'});
    }
}  