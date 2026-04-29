import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../src/pages/api/friends";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    friendship: { findMany: jest.fn() },
    user:       { findUnique: jest.fn(), update: jest.fn() },
  },
}));

jest.mock("@/lib/nanoid", () => ({
  nanoid: jest.fn(() => "abc123"),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession    = auth.api.getSession          as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindMany      = prisma.friendship.findMany   as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUserFindUnique = prisma.user.findUnique      as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUserUpdate    = prisma.user.update           as unknown as jest.MockedFunction<(...args: any[]) => any>;

type MockRes = NextApiResponse & { statusCode: number; body: unknown };

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

describe("GET /api/friends unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  test("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  test("returns 405 for unsupported method", async () => {
    const req = { method: "POST", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
    expect(res.body).toEqual({ error: "Method not allowed" });
  });

  test("returns 200 with empty friends and requests when user has none", async () => {
    mockFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue({ friendCode: "code-1" });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      friends: [],
      friendRequests: [],
      friendCode: "code-1",
    });
  });

  test("returns accepted friends mapped correctly", async () => {
    // First findMany call → accepted, second → pending
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "friendship-1",
          requesterId: "user-2",
          addresseeId: "user-1",
          requester: { id: "user-2", name: "Bob",   image: null },
          addressee: { id: "user-1", name: "Alice", image: null },
        },
      ])
      .mockResolvedValueOnce([]);
    mockUserFindUnique.mockResolvedValue({ friendCode: "code-1" });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.friends).toHaveLength(1);
    expect(body.friends[0]).toMatchObject({
      id:          "user-2",
      friendId:    "friendship-1",
      username:    "Bob",
      displayName: "Bob",
      avatarUrl:   undefined,
      status:      "online",
    });
  });

  test("returns the current user as the friend when they are the requester", async () => {
    mockFindMany
      .mockResolvedValueOnce([
        {
          id: "friendship-2",
          requesterId: "user-1", // current user sent the request
          addresseeId: "user-3",
          requester: { id: "user-1", name: "Alice", image: null },
          addressee: { id: "user-3", name: "Charlie", image: "img.png" },
        },
      ])
      .mockResolvedValueOnce([]);
    mockUserFindUnique.mockResolvedValue({ friendCode: "code-1" });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.friends[0]).toMatchObject({
      id:       "user-3",
      username: "Charlie",
      avatarUrl: "img.png",
    });
  });

  test("returns pending friend requests with correct direction", async () => {
    const createdAt = new Date("2024-01-01T00:00:00.000Z");

    mockFindMany
      .mockResolvedValueOnce([]) // accepted
      .mockResolvedValueOnce([
        {
          id:          "req-1",
          requesterId: "user-2",
          addresseeId: "user-1",
          createdAt,
          requester: { id: "user-2", name: "Bob",   image: null },
          addressee: { id: "user-1", name: "Alice", image: null },
        },
        {
          id:          "req-2",
          requesterId: "user-1",
          addresseeId: "user-3",
          createdAt,
          requester: { id: "user-1", name: "Alice",   image: null },
          addressee: { id: "user-3", name: "Charlie", image: null },
        },
      ]);
    mockUserFindUnique.mockResolvedValue({ friendCode: "code-1" });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.friendRequests).toHaveLength(2);

    const incoming = body.friendRequests.find((r: any) => r.id === "req-1");
    expect(incoming).toMatchObject({
      userId:    "user-2",
      direction: "incoming",
      createdAt: createdAt.toISOString(),
    });

    const outgoing = body.friendRequests.find((r: any) => r.id === "req-2");
    expect(outgoing).toMatchObject({
      userId:    "user-3",
      direction: "outgoing",
    });
  });

  test("returns null friendCode when user has no friendCode", async () => {
    mockFindMany.mockResolvedValue([]);
    mockUserFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.friendCode).toBeNull();
  });
});

describe("PUT /api/friends unit tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  test("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const req = { method: "PUT", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
  });

  test("returns 200 with new friend code on success", async () => {
    mockUserUpdate.mockResolvedValue({});

    const req = { method: "PUT", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data:  { friendCode: "abc123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ newFriendCode: "abc123" });
  });

  test("returns 405 when prisma update throws", async () => {
    mockUserUpdate.mockRejectedValue(new Error("db error"));

    const req = { method: "PUT", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });
});