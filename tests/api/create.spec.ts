// Unit tests for the create-room API endpoint.
// The handler is called directly (no running server needed).
import { beforeEach, describe, test, expect, jest } from "@jest/globals";
import type { NextApiRequest, NextApiResponse } from "next";
import { ProblemDifficulty } from "@prisma/client";
import handler from "../../src/pages/api/rooms/create";
import {auth} from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { nanoid } from "nanoid";
// --- Mocks ---
// Replace real dependencies with fakes so tests don't need a database or auth server.

// Fake auth: lets each test decide whether the user is logged in or not.
jest.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: jest.fn() } },
}));

// Fake database: prevents real DB calls; each test controls what the DB "returns".
jest.mock("@/lib/prisma", () => ({
  prisma: {
    problem: { findFirst: jest.fn() },
    gameRoom: { create: jest.fn() },
  },
}));

// Fake ID generator: always returns "abcd1234" so test assertions are predictable.
jest.mock("nanoid", () => ({
    nanoid: jest.fn(() => "abcd1234"),
 }));

// --- Mock shortcuts ---
// These give us easy handles to the fake functions above so we can configure
// their return values in each test (e.g. mockGetSession.mockResolvedValue(...)).
const mockGetSession = auth.api.getSession as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockFindFirst = prisma.problem.findFirst as unknown as jest.MockedFunction<(...args: any[]) => any>;
const mockCreateGameRoom = prisma.gameRoom.create as unknown as jest.MockedFunction<(...args: any[]) => any>;

// --- Fake HTTP response ---
// The handler expects a response object with .status() and .json() methods.
// MockRes adds a `body` field so tests can inspect what the handler sent back.
 type MockRes = NextApiResponse & {
    statusCode: number;
    body: unknown;
 };

 // Creates a fake response object that records what the handler does:
 //   res.status(404)       -> stores 404 in res.statusCode
 //   res.json({ error })   -> stores { error } in res.body
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
 // Each test covers one path through the handler (wrong method, missing field, etc.).
 describe("POST /api/rooms/create unit tests", () => {
     // Clear fake call history before each test so they don't affect each other.
    beforeEach(() => {
        jest.clearAllMocks();
    });
    test("returns 405 for non-POST", async () => {
        const req = { method: "GET", body: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(405);
        expect(res.body).toEqual({ message: "Method not allowed"});
    });
    test("returns 400 for missing difficulty", async () => {
        const req = { method: "POST", body: {}, headers: {} } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.body).toEqual({ message: "Invalid difficulty" });
    });
    test("returns 401 when unauthenticated", async () => {
        mockGetSession.mockResolvedValue(null);

        const req = {
            method: "POST",
            body: { difficulty: ProblemDifficulty.EASY },
            headers: {},
        } as NextApiRequest;
        const res = makeRes();

        await handler(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.body).toEqual({ ok: false, error: "Unauthorized"});
        });
        
        test("returns 500 when no problem exists for difficulty", async () => {
            mockGetSession.mockResolvedValue({ user: { id: "user1" } });
            mockFindFirst.mockResolvedValue(null);

            const req = {
                method: "POST",
                body: { difficulty: ProblemDifficulty.EASY },
                headers: {},
            } as NextApiRequest;
            const res = makeRes();

            await handler(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.body).toEqual({ message: "No problems found in the database" });
        });

        test("returns 201 and gameId on success", async () => {
            mockGetSession.mockResolvedValue({ user: { id: "user1" } });
            mockFindFirst.mockResolvedValue({ id: "problem1" });
            mockCreateGameRoom.mockResolvedValue({ id: "abcd1234", problemId: "problem1" });

            const req = {
                method: "POST",
                body: { difficulty: ProblemDifficulty.EASY },
                headers: {},
            } as NextApiRequest;
            const res = makeRes();

            await handler(req, res);

            expect(prisma.problem.findFirst).toHaveBeenCalledWith({
                 where: { difficulty: ProblemDifficulty.EASY },
                 });
            expect(prisma.gameRoom.create).toHaveBeenCalledWith({
                data: { id: "abcd1234", problemId: "problem1" },
            });
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.body).toEqual({ gameId: "abcd1234" });
        });

    });