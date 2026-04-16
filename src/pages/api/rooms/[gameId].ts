import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
/**
 * Room details API endpoint.
 *
 * Purpose:
 * Returns complete game information for the results page including:
 * - Problem details
 * - Game type (TWOPLAYER or FOURPLAYER)
 * - Team submission codes
 * - Current user's team number
 */
interface RoomDetailsResponse {
  problem: {
    id: string;
    title: string;
    description: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    topics: string[];
  };
  gameType: string;
  team1Code: string | null;
  team2Code: string | null;
  userTeamNumber: 1 | 2;
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
  const { gameId } = req.query;
  if (!gameId || typeof gameId !== "string") {
    return res.status(400).json({ message: "Invalid room ID" });
  }

  try {
    // Fetch the room, problem, and player/team data in a single query
    const room = await prisma.gameRoom.findUnique({
      where: { id: gameId },
      include: {
        problem: {
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            topics: true,
          },
        },
        teams: {
          include: {
            players: {
              select: {
                userId: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    // Either the room does not exist or it has no linked problem.
    if (!room || !room.problem) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Determine which team the current user is on (1 or 2 based on creation order)
    let userTeamNumber: 1 | 2 = 1;
    console.log("User ID:", session.user.id);
    console.log("Teams count:", room.teams.length);
    console.log("Teams:", JSON.stringify(room.teams, null, 2));

    for (let i = 0; i < room.teams.length; i++) {
      const team = room.teams[i];
      console.log(`Team ${i}:`, team.id, "Players:", team.players.map(p => p.userId));
      const userIsOnThisTeam = team.players.some(
        (p) => p.userId === session.user.id
      );
      if (userIsOnThisTeam) {
        userTeamNumber = (i + 1) as 1 | 2;
        console.log(`User is on team ${userTeamNumber}`);
        break;
      }
    }

    // Fetch the game result codes
    const gameResult = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
      select: {
        team1Code: true,
        team2Code: true,
      },
    });

    // Return complete game data
    return res.status(200).json({
      problem: {
        id: room.problem.id,
        title: room.problem.title,
        description: room.problem.description,
        difficulty: room.problem.difficulty,
        topics: room.problem.topics,
      },
      gameType: room.gameType,
      team1Code: gameResult?.team1Code ?? null,
      team2Code: gameResult?.team2Code ?? null,
      userTeamNumber,
    });
  } catch (error: unknown) {
    // Surface a useful message while preserving a fallback for unknown errors.
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message || "Failed to fetch room details" });
    }

    return res.status(500).json({ message: "Failed to fetch room details" });
  }
}
