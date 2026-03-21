import { beforeEach, describe, test, expect, jest } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import { Role } from "@prisma/client";
import handler from "@/pages/api/team/existing";
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
        teamPlayer: { findFirst: jest.fn() },
    },
}));

// --- Mock shortcuts ---
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockFindFirst = prisma.teamPlayer.findFirst as unknown as jest.MockedFunction<(...args: any[]) => any>;

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
describe("GET /api/team/existing unit tests", () => {
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
            query: { gameRoomId: "room1", userId: "user1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ ok: false, error: "Unauthorized" });
    });

    test("returns teamId and role if player exists", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockResolvedValue({ teamId: "team1", role: Role.CODER });

        const req = {
            method: "GET",
            query: { gameRoomId: "room1", userId: "user1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(prisma.teamPlayer.findFirst).toHaveBeenCalledWith({
            where: {
                userId: "user1",
                team: { gameRoomId: "room1" }
            },
            include: { team: true }
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body).toEqual({ teamId: "team1", role: Role.CODER });
    });

    test("returns null teamId if player does not exist", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockResolvedValue(null);

        const req = {
            method: "GET",
            query: { gameRoomId: "room1", userId: "user1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body).toEqual({ teamId: null });
    });

    test("returns 500 on database error", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockRejectedValue(new Error("Database error"));

        const req = {
            method: "GET",
            query: { gameRoomId: "room1", userId: "user1" },
            headers: {},
        } as unknown as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body).toEqual({ message: "Database error" });
    });
});