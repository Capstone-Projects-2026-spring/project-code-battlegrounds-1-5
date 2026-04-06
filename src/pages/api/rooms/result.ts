import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ResultCodeResponse {
  team1Code: string | null;
  team2Code: string | null;
}

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResultCodeResponse | ErrorResponse>
) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await auth.api.getSession({ headers: req.headers as any });
  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { gameId } = req.query;
  if (!gameId || typeof gameId !== "string") {
    return res.status(400).json({ message: "Invalid game ID" });
  }

  try {
    const gameResult = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
      select: {
        team1Code: true,
        team2Code: true,
      },
    });

    if (!gameResult) {
      return res.status(404).json({ message: "Game result not found" });
    }

    return res.status(200).json({
      team1Code: gameResult.team1Code,
      team2Code: gameResult.team2Code,
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res.status(500).json({ message: error.message || "Failed to fetch result code" });
      console.error("Error fetching result code:", error);
    }

    return res.status(500).json({ message: "Failed to fetch result code" });
  }
}
