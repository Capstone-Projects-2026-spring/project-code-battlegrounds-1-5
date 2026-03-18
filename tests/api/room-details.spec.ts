import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../src/pages/api/rooms/[gameId]";
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

const mockFindUnique = prisma.gameRoom.findUnique as unknown as jest.MockedFunction<
  (...args: any[]) => any
>;
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
    const req = { method: "GET", query: {} } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ message: "Invalid room ID" });
  });

  test("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { method: "GET", query: { gameId: "room-1" }, headers: {} } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({ message: "Unauthorized" });
  });

  test("returns 404 when room is not found", async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = { method: "GET", query: { gameId: "room-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: "room-1" },
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
    });

    const req = { method: "GET", query: { gameId: "room-1" } } as unknown as NextApiRequest;
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
    });
  });

  test("returns 500 when prisma throws", async () => {
    mockFindUnique.mockRejectedValue(new Error("db unavailable"));

    const req = { method: "GET", query: { gameId: "room-1" } } as unknown as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ message: "db unavailable" });
  });
});
