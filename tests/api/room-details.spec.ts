import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import { Role, GameType } from "@prisma/client";
import handler from "../../src/pages/api/rooms/[gameId]/[userId]";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: jest.fn() },
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    gameRoom: { findUnique: jest.fn() },
  },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindUnique = prisma.gameRoom.findUnique as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;

type MockRes = NextApiResponse & {
  statusCode: number;
  body: unknown;
};

function makeRes(): MockRes {
  const res: Partial<MockRes> = {};
  res.statusCode = 200;
  res.body = undefined;
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res as NextApiResponse;
  }) as MockRes["status"];
  res.json = jest.fn((payload: unknown) => {
    res.body = payload;
    return res as NextApiResponse;
  }) as MockRes["json"];
  return res as MockRes;
}

describe("GET /api/rooms/[gameId] unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  test("returns 405 for non-GET", async () => {
    const req = { method: "POST", query: { gameId: "room-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.body).toEqual({ message: "Method not allowed" });
  });

  test("returns 400 for missing gameId", async () => {
    const req = { method: "GET", query: { userId: "user-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "Invalid room ID" });
  });

  test("returns 400 for missing userId", async () => {
    const req = { method: "GET", query: { gameId: "room-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "Invalid user ID" });
  });


  test("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { method: "GET", query: { gameId: "room-1", userId: "user-1" }, headers: {} } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("returns 404 when room is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = { method: "GET", query: { gameId: "room-1", userId: "user-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "room-1" },
      select: {
        status: true,
        gameType: true,
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
        },
      },
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({ message: "Room not found" });
  });

  test("returns 200 with selected room problem", async () => {
    mockFindUnique.mockResolvedValue({
      problem: {
        id: "problem-1",
        title: "Two Sum",
        description: "Given an array...",
        difficulty: "EASY",
        topics: ["Array", "Hash Table"],
      },
      gameType: GameType.FOURPLAYER,
      teams: [
        {
          id: "team-1",
          players: [{ userId: "user-1", role: Role.CODER }, { userId: "user-3", role: Role.TESTER }],
        },
        {
          id: "team-2",
          players: [{ userId: "user-2", role: Role.CODER }, { userId: "user-4", role: Role.TESTER }],
        }
      ],
    });

    const req = { method: "GET", query: { gameId: "room-1", userId: "user-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      problem: {
        id: "problem-1",
        title: "Two Sum",
        description: "Given an array...",
        difficulty: "EASY",
        topics: ["Array", "Hash Table"],
      },
      gameType: GameType.FOURPLAYER,
      teams: [
        { teamId: "team-1", playerCount: 2 },
        { teamId: "team-2", playerCount: 2 }
      ],
      teamId: "team-1",
      role: Role.CODER,
    });
  });

  test("returns 500 when prisma throws", async () => {
    mockFindUnique.mockRejectedValue(new Error("db unavailable"));

    const req = { method: "GET", query: { gameId: "room-1", userId: "user-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ message: "db unavailable" });
  });
});
