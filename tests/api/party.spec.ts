import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "../../src/pages/api/party";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

jest.mock("@/lib/auth", () => ({
  auth: { api: { getSession: jest.fn() } },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    party:       { findUnique: jest.fn(), update: jest.fn() },
    partyMember: { findUnique: jest.fn() },
  },
}));

jest.mock("@/lib/nanoid", () => ({
  nanoid: jest.fn(() => "newid1"),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession         = auth.api.getSession           as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPartyFindUnique    = prisma.party.findUnique       as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPartyUpdate        = prisma.party.update           as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMemberFindUnique   = prisma.partyMember.findUnique as unknown as jest.MockedFunction<(...args: any[]) => any>;

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

describe("GET /api/party unit tests", () => {
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

  test("returns 200 with nulls when user owns an empty party and is not a guest", async () => {
    mockPartyFindUnique.mockResolvedValue({
      id:     "party-1",
      member: null,
    });
    mockMemberFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      partyMember: null,
      joinedParty: null,
      partyCode:   "party-1",
    });
  });

  test("returns partyMember when owner has a guest in their party", async () => {
    const joinedAt = new Date("2024-06-01T00:00:00.000Z");

    mockPartyFindUnique.mockResolvedValue({
      id: "party-1",
      member: {
        joinedAt,
        user: { id: "user-2", name: "Bob", image: null },
      },
    });
    mockMemberFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.partyMember).toMatchObject({
      userId:      "user-2",
      username:    "Bob",
      displayName: "Bob",
      avatarUrl:   undefined,
      joinedAt:    joinedAt.toISOString(),
    });
    expect(body.joinedParty).toBeNull();
  });

  test("returns joinedParty when user is a guest in someone else's party", async () => {
    const joinedAt = new Date("2024-06-01T00:00:00.000Z");

    mockPartyFindUnique.mockResolvedValue({
      id:     "party-1",
      member: null,
    });
    mockMemberFindUnique.mockResolvedValue({
      partyId:  "party-2",
      joinedAt,
      party: {
        owner: { id: "user-3", name: "Charlie", image: "avatar.png" },
      },
    });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as any;
    expect(body.joinedParty).toMatchObject({
      userId:      "user-3",
      username:    "Charlie",
      displayName: "Charlie",
      avatarUrl:   "avatar.png",
      joinedAt:    joinedAt.toISOString(),
    });
    expect(body.partyMember).toBeNull();
    // partyCode comes from guestSlot.partyId when ownedParty has no member
    expect(body.partyCode).toBe("party-1");
  });

  test("partyCode is ownedParty.id when user owns a party", async () => {
    mockPartyFindUnique.mockResolvedValue({ id: "owned-party", member: null });
    mockMemberFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.partyCode).toBe("owned-party");
  });

  test("partyCode falls back to guestSlot.partyId when user does not own a party", async () => {
    mockPartyFindUnique.mockResolvedValue(null);
    mockMemberFindUnique.mockResolvedValue({
      partyId:  "host-party",
      joinedAt: new Date(),
      party: {
        owner: { id: "user-5", name: "Erik", image: null },
      },
    });

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.partyCode).toBe("host-party");
  });

  test("partyCode is null when user owns no party and is not a guest", async () => {
    mockPartyFindUnique.mockResolvedValue(null);
    mockMemberFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.partyCode).toBeNull();
  });

  test("returns avatar url when user image is set", async () => {
    const joinedAt = new Date();

    mockPartyFindUnique.mockResolvedValue({
      id: "party-1",
      member: {
        joinedAt,
        user: { id: "user-2", name: "Bob", image: "https://cdn.example.com/bob.png" },
      },
    });
    mockMemberFindUnique.mockResolvedValue(null);

    const req = { method: "GET", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    const body = res.body as any;
    expect(body.partyMember.avatarUrl).toBe("https://cdn.example.com/bob.png");
  });
});

describe("PUT /api/party unit tests", () => {
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

  test("returns 200 with new party id on success", async () => {
    mockPartyUpdate.mockResolvedValue({});

    const req = { method: "PUT", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(mockPartyUpdate).toHaveBeenCalledWith({
      where: { ownerId: "user-1" },
      data:  { id: "newid1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ newId: "newid1" });
  });

  test("returns 405 when prisma update throws", async () => {
    mockPartyUpdate.mockRejectedValue(new Error("db error"));

    const req = { method: "PUT", headers: {} } as NextApiRequest;
    const res = makeRes();

    await handler(req, res);

    expect(res.statusCode).toBe(405);
  });
});