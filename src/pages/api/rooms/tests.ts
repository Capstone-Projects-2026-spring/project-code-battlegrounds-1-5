import type { NextApiRequest, NextApiResponse } from "next";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface TestCase {
  id: string;
  input: unknown;
  expected: unknown;
}

interface TestsResponse {
  tests: TestCase[];
}

interface ErrorResponse {
  message: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<TestsResponse | ErrorResponse>
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
    // Get the game room and its problem
    const gameRoom = await prisma.gameRoom.findUnique({
      where: { id: gameId },
      include: {
        problem: {
          select: { slug: true },
        },
      },
    });

    if (!gameRoom || !gameRoom.problem) {
      return res.status(404).json({ message: "Game room not found" });
    }

    // Fetch test cases for the problem using slug
    const tests = await prisma.problemTest.findMany({
      where: { problemId: gameRoom.problem.slug },
      select: {
        id: true,
        functionInput: true,
        expectedOutput: true,
      },
    });

    return res.status(200).json({
      tests: tests.map((test) => ({
        id: test.id,
        input: test.functionInput,
        expected: test.expectedOutput,
      })),
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      return res
        .status(500)
        .json({ message: error.message || "Failed to fetch tests" });
    }

    return res.status(500).json({ message: "Failed to fetch tests" });
  }
}
