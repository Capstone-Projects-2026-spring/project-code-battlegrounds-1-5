import { beforeEach, describe, test, expect, jest } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import { Role } from "@prisma/client";
import handler from "@/pages/api/team/join";
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
        teamPlayer: {
            findFirst: jest.fn(),
            count: jest.fn(),
        },
        team: {
            update: jest.fn(),
        },
    },
}));

// --- Mock shortcuts ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFindFirst = prisma.teamPlayer.findFirst as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCount = prisma.teamPlayer.count as unknown as jest.MockedFunction<(...args: any[]) => any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = prisma.team.update as unknown as jest.MockedFunction<(...args: any[]) => any>;

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
describe("POST /api/team/join unit tests", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("returns 405 for non-POST", async () => {
        const req = { method: "GET", body: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.body).toEqual({ message: "Method not allowed" });
    });

    test("returns 401 when unauthenticated", async () => {
        mockGetSession.mockResolvedValue(null);

        const req = {
            method: "POST",
            body: { userId: "user1", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ ok: false, error: "Unauthorized" });
    });

    test("returns 200 with existing role if player already in game", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockResolvedValue({ teamId: "team1", role: Role.CODER });

        const req = {
            method: "POST",
            body: { userId: "user1", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.body).toEqual({ teamId: "team1", role: Role.CODER });
    });

    test("returns 201 and assigns CODER to first player", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockResolvedValue(null);
        mockCount.mockResolvedValue(0);
        mockUpdate.mockResolvedValue({ id: "team1" });

        const req = {
            method: "POST",
            body: { userId: "user1", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(prisma.teamPlayer.count).toHaveBeenCalledWith({ where: { teamId: "team1" } });
        expect(prisma.team.update).toHaveBeenCalledWith({
            where: { id: "team1" },
            data: {
                players: {
                    create: { userId: "user1", role: Role.CODER}
                }
            }
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.body).toEqual({ role: Role.CODER, playerCount: 1  });
    });

    test("returns 201 and assigns TESTER to second player", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user2" } });
        mockFindFirst.mockResolvedValue(null);
        mockCount.mockResolvedValue(1);
        mockUpdate.mockResolvedValue({ id: "team1" });

        const req = {
            method: "POST",
            body: { userId: "user2", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(prisma.teamPlayer.count).toHaveBeenCalledWith({ where: { teamId: "team1" } });
        expect(prisma.team.update).toHaveBeenCalledWith({
            where: { id: "team1" },
            data: {
                players: {
                    create: { userId: "user2", role: Role.TESTER}
                }
            }
        });
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.body).toEqual({ role: Role.TESTER, playerCount: 2  });
    });

    test("returns 201 and assigns SPECTATOR when team is full", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user3" } });
        mockFindFirst.mockResolvedValue(null);
        mockCount.mockResolvedValue(2);

        const req = {
            method: "POST",
            body: { userId: "user3", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        // spectator path should not call team.update
        expect(prisma.team.update).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.body).toEqual({ role: Role.SPECTATOR });
    });

    test("returns 500 on database error", async () => {
        mockGetSession.mockResolvedValue({ user: { id: "user1" } });
        mockFindFirst.mockRejectedValue(new Error("Database error"));

        const req = {
            method: "POST",
            body: { userId: "user1", teamId: "team1", gameRoomId: "room1" },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.body).toEqual({ message: "Database error" });
    });
});