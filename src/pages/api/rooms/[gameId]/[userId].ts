import type { NextApiRequest, NextApiResponse } from "next";
import { Role, GameType, ProblemDifficulty } from "@prisma/client";
import { TeamCount } from "@/components/TeamSelect";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
/**
 * Room details API endpoint.
 *
 * Purpose:
 * Returns all important details about a game room that the game page needs to render the problem and related information. 
 */
interface RoomDetailsResponse {
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty: ProblemDifficulty;
    topics: string[];
  };
  teams: TeamCount[];
  gameType: GameType;
  teamId: string | null; // Allows user to choose team if not already assigned
  role: Role | null; // Allows user to choose role if not already assigned
}

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RoomDetailsResponse | ErrorResponse>
) {
  // This endpoint is read-only and only supports GET.
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Only authenticated users should be able to retrieve active room problem details.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Validate the dynamic route parameter before querying the database.
  const { gameId, userId } = req.query;
  if (!gameId || typeof gameId !== "string") {
    return res.status(400).json({ message: "Invalid room ID" });
  }

  if (!userId || typeof userId !== "string") {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
    // Fetch the room and only the fields needed for the game page
    const room = await prisma.gameRoom.findUnique({
      where: { 
        id: gameId,
      },
      select: {
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            topics: true,
          },
        },
        gameType: true,
        teams: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            players: {
              select: {
                userId: true,
                role: true,
            },
          },
        },
      }
    }});

    // Either the room does not exist or it has no linked problem or no gameType or no teams.
    if (!room || !room.problem || !room.gameType || !room.teams) {
      return res.status(404).json({ message: "Room not found" });
    }

    const teams = room.teams.map(t => ({
      teamId: t.id,
      playerCount: t.players.filter(p => p.role !== Role.SPECTATOR).length
    }))


    // Find which team this user is on
    const userTeam = room.teams.find(t => t.players.some(p => p.userId === userId));
    const teamId = userTeam?.id ?? null;
    const role = userTeam?.players.find(p => p.userId === userId)?.role ?? null;

    // Return a stable shape that the game page can pass directly to the UI.
    return res.status(200).json({
      problem: {
        id: room.problem.id,
        title: room.problem.title,
        description: room.problem.description,
        difficulty: room.problem.difficulty,
        topics: room.problem.topics,
      },
      gameType: room.gameType,
      teams,
      teamId,
      role
    });
  } catch (error: unknown) {
    // Surface a useful message while preserving a fallback for unknown errors.
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message || "Failed to fetch room details" });
    }

    return res.status(500).json({ message: "Failed to fetch room details" });
  }
}
