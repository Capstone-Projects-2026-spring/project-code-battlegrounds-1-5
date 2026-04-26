import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mockDeleteVm = jest.fn();
const mockValidate = jest.fn((_, payload) => payload);

const mockPrisma = {
  gameResult: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  gameRoom: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  problemTest: {
    findMany: jest.fn(),
  },
  gameTest: {
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("../../server/utils/vm/deleteVm", () => ({
  deleteVm: (...args: unknown[]) => mockDeleteVm(...args),
}));

jest.mock("../../server/utils/validate", () => ({
  validate: (...args: unknown[]) => mockValidate(...args),
}));

jest.mock("../../server/prisma", () => ({
  getPrisma: () => mockPrisma,
}));

type HandlerMap = Record<string, (data: unknown) => Promise<void> | void>;

describe("executionHandlers submitCode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXECUTOR_ADDR = "http://executor";

    mockPrisma.gameTest.upsert.mockImplementation(() => Promise.resolve({}));
    mockPrisma.$transaction.mockResolvedValue([]);
  });

  test("does not finalize FOURPLAYER room when one team execution fails", async () => {
    const handlers: HandlerMap = {};

    const socket = {
      on: jest.fn((event: string, cb: (data: unknown) => Promise<void> | void) => {
        handlers[event] = cb;
      }),
      emit: jest.fn(),
    };

    const roomEmitter = { emit: jest.fn() };
    const io = {
      to: jest.fn(() => roomEmitter),
    };

    const gameService = {
      getGameData: jest.fn().mockResolvedValue({ team1: true }),
      saveGameData: jest.fn().mockResolvedValue(undefined),
      getTestCases: jest.fn().mockResolvedValue([]),
      cleanupGameTimers: jest.fn().mockResolvedValue(undefined),
      deleteGameData: jest.fn().mockResolvedValue(undefined),
    };

    mockPrisma.gameResult.findUnique
      .mockResolvedValueOnce({ id: "gr-1", team1Code: null, team2Code: null })
      .mockResolvedValueOnce({ team1Code: "team-1-code", team2Code: "team-2-code" });

    mockPrisma.gameRoom.findUnique.mockResolvedValue({
      id: "room-1",
      problem: { slug: "two-sum" },
      teams: [{ id: "team-a" }, { id: "team-b" }],
    });

    mockPrisma.problemTest.findMany.mockResolvedValue([
      { id: "hidden-1", functionInput: [{ name: "x", type: "number", value: 1 }], expectedOutput: [{ name: "r", type: "number", value: 1 }] },
    ]);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          results: [
            { actual: 1, passed: true, stderr: null, execution_time_ms: 5 },
            { actual: 1, passed: true, stderr: null, execution_time_ms: 7 },
          ],
        }),
      })
      .mockRejectedValueOnce(new Error("executor down"));

    global.fetch = fetchMock as unknown as typeof fetch;

    const { registerExecutionHandlers } = require("../../server/socket/handlers/executionHandlers.js");
    registerExecutionHandlers(io, socket, gameService);

    const submitCode = handlers.submitCode;
    expect(submitCode).toBeDefined();

    await submitCode?.({
      roomId: "room-1",
      code: "const solve = () => 1;",
      type: "FOURPLAYER",
      team: "team2",
      teamId: "team-b",
      testCases: [{ id: "game-1", functionInput: [{ name: "x", type: "number", value: 1 }], expectedOutput: [{ name: "r", type: "number", value: 1 }] }],
      runIDs: ["game-1"],
      submitTimer: "04:12",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(socket.emit).toHaveBeenCalledWith(
      "error",
      { message: "Code execution failed for one of the teams. Please try again." }
    );
    expect(mockPrisma.gameRoom.update).not.toHaveBeenCalled();
    expect(gameService.cleanupGameTimers).not.toHaveBeenCalled();
    expect(mockDeleteVm).not.toHaveBeenCalled();
    expect(roomEmitter.emit).not.toHaveBeenCalledWith("gameEnded");
  });
});
