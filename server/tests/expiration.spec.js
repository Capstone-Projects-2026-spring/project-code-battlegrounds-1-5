const Redis = require("ioredis");
const { createGameService } = require("../game/gameService");
const {
    makeClient,
    connectClient,
    waitFor,
    uid,
} = require("../utils/tests/helpers");

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
let redis;
let gameService;
let prisma;

// How long to wait for a keyspace event to fire after key expiry.
// Redis fires these asynchronously so we give a generous buffer.
const EVENT_BUFFER_MS = 2000;

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

    // Keyspace notifications must be enabled — the server does this in dev mode
    // but we ensure it here so tests are self-contained.
    await redis.config("SET", "notify-keyspace-events", "Ex");
});

afterAll(async () => {
    await prisma.$disconnect();
    await redis.quit();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Connects a client and joins a game room so it receives io.to(gameId) emits
async function joinAsSpectator(gameId) {
    const client = makeClient();
    await connectClient(client);
    // joinGame puts the socket in the gameId room on the server
    client.emit("joinGame", {
        gameId,
        teamId: `team-${gameId}`,
        gameType: "TWOPLAYER",
    });
    await new Promise((r) => setTimeout(r, 150));
    return client;
}

// Replace joinAsSpectator with this version that also joins team rooms
async function joinAsSpectatorWithTeams(gameId, teamIds = []) {
    const client = makeClient();
    await connectClient(client);

    client.emit("joinGame", {
        gameId,
        teamId: teamIds[0] ?? `team-${gameId}`,
        gameType: "TWOPLAYER",
    });
    await new Promise((r) => setTimeout(r, 150));

    // Also join the second team room so io.to(teamIds[1]) reaches this client
    if (teamIds[1]) {
        client.emit("joinGame", {
            gameId,
            teamId: teamIds[1],
            gameType: "TWOPLAYER",
        });
        await new Promise((r) => setTimeout(r, 150));
    }

    return client;
}

// Seeds an active game directly in Redis (mirrors what startGameIfNeeded does)
// so the expiration listener treats it as a live game.
async function seedActiveGame(gameId, ttlMs) {
    await redis.set(`game:${gameId}:expires`, "1", "PX", ttlMs);
    await redis.sadd("activeGames", gameId);
}

// Seeds the roleswap key with a short TTL
async function seedRoleswap(gameId, ttlMs) {
    await redis.set(`game:${gameId}:roleswap`, "1", "PX", ttlMs);
}

// Seeds the roleswap warning key with a short TTL
async function seedRoleswapWarning(gameId, ttlMs) {
    await redis.set(`game:${gameId}:roleswap:warning`, "1", "PX", ttlMs);
}

// Creates a minimal game room in the DB with two teams so roleswap DB writes work
async function createGameInDb(gameId) {
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

    const [alice, bob] = await Promise.all([
        prisma.user.findUniqueOrThrow({ where: { email: "alice@test.com" } }),
        prisma.user.findUniqueOrThrow({ where: { email: "bob@test.com" } }),
    ]);

    const team1 = await prisma.team.create({
        data: {
            gameRoomId: gameRoom.id,
            players: {
                create: [
                    { userId: alice.id, role: "CODER" },
                ],
            },
        },
        include: { players: true },
    });

    const team2 = await prisma.team.create({
        data: {
            gameRoomId: gameRoom.id,
            players: {
                create: [
                    { userId: bob.id, role: "TESTER" },
                ],
            },
        },
        include: { players: true },
    });

    await prisma.gameResult.create({
        data: { gameRoomId: gameRoom.id },
    });

    return { gameRoom, team1, team2 };
}

// Cleans up DB rows created by createGameInDb
async function cleanupGame(gameId) {
    await prisma.gameResult.deleteMany({ where: { gameRoomId: gameId } }).catch(() => { });
    await prisma.teamPlayer.deleteMany({
        where: { team: { gameRoomId: gameId } },
    }).catch(() => { });
    await prisma.team.deleteMany({ where: { gameRoomId: gameId } }).catch(() => { });
    await prisma.gameRoom.delete({ where: { id: gameId } }).catch(() => { });
    // Clean Redis
    await redis.del(
        `game:${gameId}:expires`,
        `game:${gameId}:roleswap`,
        `game:${gameId}:roleswap:warning`,
        `lock:game:${gameId}:roleswap`,
        `lock:game:${gameId}:end`
    );
    await redis.srem("activeGames", gameId);
}

// ---------------------------------------------------------------------------
// roleSwapWarning
// ---------------------------------------------------------------------------
describe("roleSwapWarning", () => {
    test("emits roleSwapWarning to all clients in the game room when warning key expires", async () => {
        const gameId = `game-warn-${uid()}`;
        const client = await joinAsSpectator(gameId);

        const warningPromise = waitFor(client, "roleSwapWarning", EVENT_BUFFER_MS + 500);

        // Set a very short TTL — key expires almost immediately
        await seedRoleswapWarning(gameId, 100);

        await warningPromise; // just receiving it is the assertion

        client.disconnect();
    }, EVENT_BUFFER_MS + 3000);

    test("does not emit roleSwapWarning for non-game keys", async () => {
        const gameId = `game-nowarn-${uid()}`;
        const client = await joinAsSpectator(gameId);

        let received = false;
        client.on("roleSwapWarning", () => { received = true; });

        // Set an unrelated key that expires — should not trigger the handler
        await redis.set(`unrelated:${gameId}`, "1", "PX", 100);
        await new Promise((r) => setTimeout(r, 500));

        expect(received).toBe(false);

        client.disconnect();
    });
});

// ---------------------------------------------------------------------------
// roleSwapping / roleSwap
// ---------------------------------------------------------------------------
describe("roleSwap", () => {
    test("emits roleSwapping immediately when roleswap key expires", async () => {
        const gameId = `game-swap-${uid()}`;
        await seedActiveGame(gameId, 30000); // keep game active during test

        const client = await joinAsSpectator(gameId);

        const swappingPromise = waitFor(client, "roleSwapping", EVENT_BUFFER_MS + 500);
        await seedRoleswap(gameId, 100);

        await swappingPromise;

        await redis.srem("activeGames", gameId);
        await redis.del(`game:${gameId}:expires`, `lock:game:${gameId}:roleswap`);
        client.disconnect();
    }, EVENT_BUFFER_MS + 3000);

    test("emits roleSwap to both teams after the swap delay", async () => {
        const gameId = `game-swapdb-${uid()}`;
        const { team1, team2 } = await createGameInDb(gameId);
        await seedActiveGame(gameId, 30000);

        // Join both team rooms so io.to(team1.id) and io.to(team2.id) reach this client
        const client = await joinAsSpectatorWithTeams(gameId, [team1.id, team2.id]);

        const swapPromise = waitFor(client, "roleSwap", EVENT_BUFFER_MS + 4000);
        await seedRoleswap(gameId, 100);

        await swapPromise;

        await cleanupGame(gameId);
        client.disconnect();
    }, EVENT_BUFFER_MS + 6000);

    test("swaps CODER→TESTER and TESTER→CODER in the database", async () => {
        const gameId = `game-swapcheck-${uid()}`;
        const { team1, team2 } = await createGameInDb(gameId);
        await seedActiveGame(gameId, 30000);

        const client = await joinAsSpectatorWithTeams(gameId, [team1.id, team2.id]);

        const swapPromise = waitFor(client, "roleSwap", EVENT_BUFFER_MS + 4000);
        await seedRoleswap(gameId, 100);
        await swapPromise;

        const alicePlayer = await prisma.teamPlayer.findFirst({
            where: { teamId: team1.id },
        });
        expect(alicePlayer.role).toBe("TESTER");

        const bobPlayer = await prisma.teamPlayer.findFirst({
            where: { teamId: team2.id },
        });
        expect(bobPlayer.role).toBe("CODER");

        await cleanupGame(gameId);
        client.disconnect();
    }, EVENT_BUFFER_MS + 6000);

    test("does not emit roleSwapping when game is not in activeGames", async () => {
        const gameId = `game-swapinactive-${uid()}`;
        // Deliberately do NOT add to activeGames

        const client = await joinAsSpectator(gameId);

        let received = false;
        // roleSwapping fires before the activeGames check, so we check roleSwap instead
        client.on("roleSwap", () => { received = true; });

        await seedRoleswap(gameId, 100);
        // Wait long enough for the 2500ms delay to have passed if it was going to fire
        await new Promise((r) => setTimeout(r, 3500));

        expect(received).toBe(false);

        await redis.del(`lock:game:${gameId}:roleswap`);
        client.disconnect();
    }, 6000);
});

// ---------------------------------------------------------------------------
// gameEnded
// ---------------------------------------------------------------------------
describe("gameEnded", () => {
    test("emits gameEnded to all clients in the room when expires key expires", async () => {
        const gameId = `game-end-${uid()}`;
        await createGameInDb(gameId);
        await redis.sadd("activeGames", gameId);

        const client = await joinAsSpectator(gameId);

        const endedPromise = waitFor(client, "gameEnded", EVENT_BUFFER_MS + 500);
        // Set a very short TTL — triggers the :expires handler
        await redis.set(`game:${gameId}:expires`, "1", "PX", 100);

        await endedPromise;

        await cleanupGame(gameId);
        client.disconnect();
    }, EVENT_BUFFER_MS + 3000);

    test("sets gameRoom status to FINISHED in the database", async () => {
        const gameId = `game-enddb-${uid()}`;
        await createGameInDb(gameId);
        await redis.sadd("activeGames", gameId);

        const client = await joinAsSpectator(gameId);

        const endedPromise = waitFor(client, "gameEnded", EVENT_BUFFER_MS + 500);
        await redis.set(`game:${gameId}:expires`, "1", "PX", 100);
        await endedPromise;

        const room = await prisma.gameRoom.findUnique({ where: { id: gameId } });
        expect(room.status).toBe("FINISHED");

        await cleanupGame(gameId);
        client.disconnect();
    }, EVENT_BUFFER_MS + 3000);

    test("removes game from activeGames in Redis after expiry", async () => {
        const gameId = `game-endredis-${uid()}`;
        await createGameInDb(gameId);
        await redis.sadd("activeGames", gameId);

        const client = await joinAsSpectator(gameId);

        const endedPromise = waitFor(client, "gameEnded", EVENT_BUFFER_MS + 500);
        await redis.set(`game:${gameId}:expires`, "1", "PX", 100);
        await endedPromise;

        const isMember = await redis.sismember("activeGames", gameId);
        expect(isMember).toBe(0);

        await cleanupGame(gameId);
        client.disconnect();
    }, EVENT_BUFFER_MS + 3000);

    test("does not emit gameEnded when game is not in activeGames", async () => {
        const gameId = `game-endinactive-${uid()}`;
        // Do NOT add to activeGames — simulates a game already ended via submitCode

        const client = await joinAsSpectator(gameId);

        let received = false;
        client.on("gameEnded", () => { received = true; });

        await redis.set(`game:${gameId}:expires`, "1", "PX", 100);
        await new Promise((r) => setTimeout(r, 1000));

        expect(received).toBe(false);

        await redis.del(`lock:game:${gameId}:end`);
        client.disconnect();
    }, 4000);

    test("does not emit gameEnded twice when key expires and lock is already held", async () => {
        const gameId = `game-endlock-${uid()}`;
        await createGameInDb(gameId);
        await redis.sadd("activeGames", gameId);

        // Pre-set the distributed lock — simulates another instance already handling it
        await redis.set(`lock:game:${gameId}:end`, "1", "NX", "PX", 5000);

        const client = await joinAsSpectator(gameId);

        let count = 0;
        client.on("gameEnded", () => { count++; });

        await redis.set(`game:${gameId}:expires`, "1", "PX", 100);
        await new Promise((r) => setTimeout(r, 1000));

        expect(count).toBe(0);

        await cleanupGame(gameId);
        client.disconnect();
    }, 4000);
});