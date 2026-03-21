import { beforeEach, describe, test, expect, jest } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import handler from "@/pages/api/team/count";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// --- Mocks ---
jest.mock("@/lib/auth", () => ({
    auth: {
        api: { getSession: jest.fn() }
    },
}));

jest.mock("@/lib/prisma", () => ({
    prisma: {
        team: { findMany: jest.fn() },
    },
}));

// --- Mock shortcuts ---
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockFindMany = prisma.team.findMany as unknown as jest.MockedFunction<(...args: any[]) => any>;

// --- Fake HTTP response ---
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

// --- Tests ---
describe("GET /api/team/count unit tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns 405 for non-GET", async () => {
        const req = { method: "POST", query: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.body).toEqual({ message: "Method not allowed" });
    });

    test("returns 401 when unauthenticated", async () => {
        mockGetSession.mockResolvedValue(null);

        const req = {
            method: "GET",
            query: { gameId: "room1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ ok: false, error: "Unauthorized" });
    });

    test("returns team counts for a game room", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindMany.mockResolvedValue([
            { id: "team1", _count: { players: 1 } },
            { id: "team2", _count: { players: 2 } },
        ]);

        const req = {
            method: "GET",
            query: { gameId: "room1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(prisma.team.findMany).toHaveBeenCalledWith({
            where: { gameRoomId: "room1" },
            include: { _count: { select: { players: true } } }
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body).toEqual({
            teams: [
                { teamId: "team1", playerCount: 1 },
                { teamId: "team2", playerCount: 2 },
            ]
        });
    });

    test("returns empty array when no teams exist", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindMany.mockResolvedValue([]);

        const req = {
            method: "GET",
            query: { gameId: "room1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body).toEqual({ teams: [] });
    });

    test("returns 500 on database error", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindMany.mockRejectedValue(new Error("Database error"));

        const req = {
            method: "GET",
            query: { gameId: "room1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body).toEqual({ message: "Failed to fetch team counts" });
    });
});