// WILL NEED TO BE CHANGED FOR SURE ONCE PROD IS SETUP AS WE NEED TO HAVE EXECUTION
const Redis = require("ioredis");
const { createGameService } = require("../game/gameService");
const {
  makeClient,
  connectClient,
  connectAll,
  disconnectAll,
  waitFor,
  uid,
} = require("../utils/tests/helpers");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let prisma;
let redis;
let gameService;
let alice, bob, charlie, diana;

beforeAll(async () => {
  const { PrismaClient } = require(".prisma/client");
  const { PrismaPg } = require("@prisma/adapter-pg");

  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
  });

  gameService = createGameService(redis);

  [alice, bob, charlie, diana] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "alice@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "bob@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "charlie@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "diana@test.com" } }),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function createTwoPlayerGame(gameId) {
  const easyProblem = await prisma.problem.findFirstOrThrow({
    where: { difficulty: "EASY" },
  });

  const gameRoom = await prisma.gameRoom.create({
    data: {
      id: gameId,
      status: "ACTIVE",
      problemId: easyProblem.id,
      gameType: "TWOPLAYER",
    },
  });

  const team1 = await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [
          { userId: alice.id, role: "CODER" },
          { userId: bob.id,   role: "TESTER" },
        ],
      },
    },
  });

  const team2 = await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [
          { userId: charlie.id, role: "CODER" },
          { userId: diana.id,   role: "TESTER" },
        ],
      },
    },
  });

  await prisma.gameResult.create({
    data: { gameRoomId: gameRoom.id },
  });

  return { gameRoom, team1, team2 };
}

async function createFourPlayerGame(gameId) {
  const easyProblem = await prisma.problem.findFirstOrThrow({
    where: { difficulty: "EASY" },
  });

  const gameRoom = await prisma.gameRoom.create({
    data: {
      id: gameId,
      status: "ACTIVE",
      problemId: easyProblem.id,
      gameType: "FOURPLAYER",
    },
  });

  const team1 = await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [
          { userId: alice.id, role: "CODER" },
          { userId: bob.id,   role: "TESTER" },
        ],
      },
    },
  });

  const team2 = await prisma.team.create({
    data: {
      gameRoomId: gameRoom.id,
      players: {
        create: [
          { userId: charlie.id, role: "CODER" },
          { userId: diana.id,   role: "TESTER" },
        ],
      },
    },
  });

  await prisma.gameResult.create({
    data: { gameRoomId: gameRoom.id },
  });

  return { gameRoom, team1, team2 };
}

async function cleanupGame(gameId) {
  await prisma.gameResult.deleteMany({ where: { gameRoomId: gameId } }).catch(() => {});
  await prisma.teamPlayer.deleteMany({
    where: { team: { gameRoomId: gameId } },
  }).catch(() => {});
  await prisma.team.deleteMany({ where: { gameRoomId: gameId } }).catch(() => {});
  await prisma.gameRoom.delete({ where: { id: gameId } }).catch(() => {});
  await redis.del(
    `game:${gameId}:expires`,
    `game:${gameId}:roleswap`,
    `game:${gameId}:roleswap:warning`,
    `game:${gameId}:submissions`
  );
  await redis.srem("activeGames", gameId);
}

// Connects a client and joins a game room
async function joinRoom(gameId, teamId) {
  const client = makeClient();
  await connectClient(client);
  client.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });
  await new Promise((r) => setTimeout(r, 150));
  return client;
}

// Seeds Redis timers to simulate a live game
async function seedActiveGame(gameId) {
  await redis.set(`game:${gameId}:expires`, "1", "PX", 300000);
  await redis.sadd("activeGames", gameId);
}

// ---------------------------------------------------------------------------
// submitCode — TWOPLAYER
// ---------------------------------------------------------------------------
describe("submitCode TWOPLAYER", () => {
  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("submitCode", { roomId: "room1" }); // missing type

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for submitCode.");

    client.disconnect();
  });

  test("saves submitted code to gameResult in the database", async () => {
    const gameId = `game-2p-code-${uid()}`;
    await createTwoPlayerGame(gameId);
    await seedActiveGame(gameId);

    const client = await joinRoom(gameId, `team-${gameId}`);

    // gameEnded fires in the finally block — wait for it to confirm handler completed
    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code: "function solution() { return 42; }",
      type: "TWOPLAYER",
    });

    await endedPromise;

    const result = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
    });
    expect(result.team1Code).toBe("function solution() { return 42; }");

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("emits gameEnded to the room after submission (finally block always runs)", async () => {
    const gameId = `game-2p-ended-${uid()}`;
    await createTwoPlayerGame(gameId);
    await seedActiveGame(gameId);

    const client = await joinRoom(gameId, `team-${gameId}`);

    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code: "const x = 1;",
      type: "TWOPLAYER",
    });

    await endedPromise; // receiving it is the assertion

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("cleans up Redis game timers after submission", async () => {
    const gameId = `game-2p-cleanup-${uid()}`;
    await createTwoPlayerGame(gameId);
    await seedActiveGame(gameId);

    const client = await joinRoom(gameId, `team-${gameId}`);

    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code: "const x = 1;",
      type: "TWOPLAYER",
    });

    await endedPromise;

    // cleanupGameTimers deletes the expires key and removes from activeGames
    const expiresExists = await redis.exists(`game:${gameId}:expires`);
    const isActive = await redis.sismember("activeGames", gameId);
    expect(expiresExists).toBe(0);
    expect(isActive).toBe(0);

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("gameEnded is broadcast to all clients in the room", async () => {
    const gameId = `game-2p-bcast-${uid()}`;
    await createTwoPlayerGame(gameId);
    await seedActiveGame(gameId);

    const teamId = `team-bcast-${gameId}`;
    const clientA = await joinRoom(gameId, teamId);
    const clientB = await joinRoom(gameId, teamId);

    const endedA = waitFor(clientA, "gameEnded", 5000);
    const endedB = waitFor(clientB, "gameEnded", 5000);

    clientA.emit("submitCode", {
      roomId: gameId,
      code: "const x = 1;",
      type: "TWOPLAYER",
    });

    await Promise.all([endedA, endedB]);

    await cleanupGame(gameId);
    disconnectAll(clientA, clientB);
  }, 8000);
});

// ---------------------------------------------------------------------------
// submitCode — FOURPLAYER
// ---------------------------------------------------------------------------
describe("submitCode FOURPLAYER", () => {
  test("emits error when team is missing", async () => {
    const gameId = `game-4p-noteam-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    const client = await joinRoom(gameId, `team-${gameId}`);

    const errPromise = waitFor(client, "error");
    client.emit("submitCode", {
      roomId: gameId,
      code: "const x = 1;",
      type: "FOURPLAYER",
      // team is intentionally omitted
    });

    const err = await errPromise;
    expect(err.message).toBe("Missing team for four-player submitCode.");

    await cleanupGame(gameId);
    client.disconnect();
  });

  test("emits waitingForOtherTeam to teamId room when first team submits", async () => {
    const gameId  = `game-4p-wait-${uid()}`;
    const teamId  = `team-4p-wait-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    // Both clients join the team room so io.to(teamId) reaches them
    const clientA = await joinRoom(gameId, teamId);
    const clientB = await joinRoom(gameId, teamId);

    const waitingA = waitFor(clientA, "waitingForOtherTeam", 3000);
    const waitingB = waitFor(clientB, "waitingForOtherTeam", 3000);

    clientA.emit("submitCode", {
      roomId:  gameId,
      code:    "const x = 1;",
      type:    "FOURPLAYER",
      team:    "team1",
      teamId:  teamId,
    });

    await Promise.all([waitingA, waitingB]);

    await cleanupGame(gameId);
    disconnectAll(clientA, clientB);
  }, 8000);

  test("saves team1 code to gameResult when team1 submits", async () => {
    const gameId = `game-4p-t1code-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    const client = await joinRoom(gameId, `team-${gameId}`);

    const waitingPromise = waitFor(client, "waitingForOtherTeam", 3000);
    client.emit("submitCode", {
      roomId: gameId,
      code:   "const team1 = true;",
      type:   "FOURPLAYER",
      team:   "team1",
      teamId: `team-${gameId}`,
    });

    await waitingPromise;

    const result = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
    });
    expect(result.team1Code).toBe("const team1 = true;");

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("saves team2 code to gameResult when team2 submits", async () => {
    const gameId = `game-4p-t2code-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    // Seed team1 submission so team2 is the first to submit from a clean state
    const submissionKey = `game:${gameId}:submissions`;
    await gameService.saveGameData(submissionKey, JSON.stringify({ team1: true }));

    const client = await joinRoom(gameId, `team-${gameId}`);

    // When both teams have submitted the finally block runs — wait for gameEnded
    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code:   "const team2 = true;",
      type:   "FOURPLAYER",
      team:   "team2",
      teamId: `team-${gameId}`,
    });

    await endedPromise;

    const result = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
    });
    expect(result.team2Code).toBe("const team2 = true;");

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("ignores duplicate submission from same team", async () => {
    const gameId = `game-4p-dupe-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    const teamId = `team-4p-dupe-${uid()}`;
    const client = await joinRoom(gameId, teamId);

    // First submission
    const waitingPromise = waitFor(client, "waitingForOtherTeam", 3000);
    client.emit("submitCode", {
      roomId: gameId,
      code:   "const first = true;",
      type:   "FOURPLAYER",
      team:   "team1",
      teamId: teamId,
    });
    await waitingPromise;

    // Second submission from same team — should be silently ignored
    let secondWaiting = false;
    client.on("waitingForOtherTeam", () => { secondWaiting = true; });

    client.emit("submitCode", {
      roomId: gameId,
      code:   "const duplicate = true;",
      type:   "FOURPLAYER",
      team:   "team1",
      teamId: teamId,
    });
    await new Promise((r) => setTimeout(r, 300));

    // Code in DB should still be from the first submission
    const result = await prisma.gameResult.findUnique({
      where: { gameRoomId: gameId },
    });
    expect(result.team1Code).toBe("const first = true;");

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("sets gameRoom status to FINISHED when both teams submit", async () => {
    const gameId = `game-4p-finish-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    // Seed team1 already submitted
    const submissionKey = `game:${gameId}:submissions`;
    await gameService.saveGameData(submissionKey, JSON.stringify({ team1: true }));
    await prisma.gameResult.update({
      where: { gameRoomId: gameId },
      data: { team1Code: "const team1 = true;" },
    });

    const client = await joinRoom(gameId, `team-${gameId}`);

    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code:   "const team2 = true;",
      type:   "FOURPLAYER",
      team:   "team2",
      teamId: `team-${gameId}`,
    });

    await endedPromise;

    const room = await prisma.gameRoom.findUnique({ where: { id: gameId } });
    expect(room.status).toBe("FINISHED");

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);

  test("cleans up Redis timers and submission key when both teams submit", async () => {
    const gameId = `game-4p-redisclean-${uid()}`;
    await createFourPlayerGame(gameId);
    await seedActiveGame(gameId);

    const submissionKey = `game:${gameId}:submissions`;
    await gameService.saveGameData(submissionKey, JSON.stringify({ team1: true }));

    const client = await joinRoom(gameId, `team-${gameId}`);

    const endedPromise = waitFor(client, "gameEnded", 5000);
    client.emit("submitCode", {
      roomId: gameId,
      code:   "const x = 1;",
      type:   "FOURPLAYER",
      team:   "team2",
      teamId: `team-${gameId}`,
    });

    await endedPromise;

    const submissionExists = await redis.exists(submissionKey);
    const isActive         = await redis.sismember("activeGames", gameId);
    expect(submissionExists).toBe(0);
    expect(isActive).toBe(0);

    await cleanupGame(gameId);
    client.disconnect();
  }, 8000);
});

// ---------------------------------------------------------------------------
// submitTestCases
// ---------------------------------------------------------------------------
/* doesn't work right now will try once execution is a little more fleshed out

describe("submitTestCases", () => {
  // submitTestCases calls the executor and emits receiveTestCaseSync on success
  // or errorTests on failure. Since no executor runs in CI the fetch will throw,
  // so we only test the error path here.

  test("emits errorTests when executor is unreachable", async () => {
    const client = makeClient();
    await connectClient(client);

    const errorPromise = waitFor(client, "errorTests", 5000);
    client.emit("submitTestCases", {
      roomId: `room-tc-${uid()}`,
      code: "function solution() {}",
      testCases: [],
      runIDs: [],
    });

    const payload = await errorPromise;
    expect(payload.message).toBe("Sorry that didn't work try again in a few seconds");

    client.disconnect();
  }, 8000);
}); */