const Redis = require("ioredis");
const { createGameService } = require("../game/gameService");
const { makeClient, 
        connectClient, 
        connectAll, 
        disconnectAll, 
        waitFor, 
        joinGame, 
        uid 
      } = require("../utils/tests/helpers");

// ---------------------------------------------------------------------------
// Redis + service setup
// A single Redis connection is shared across all tests in this file.
// Each test uses unique keys (via Date.now()) so nothing bleeds between runs.
// ---------------------------------------------------------------------------
let redis;
let gameService;

beforeAll(() => {
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
  });
  gameService = createGameService(redis);
});

afterAll(async () => {
  await redis.quit();
});

// REGISTER
describe("register", () => {
  test("writes socket mapping to Redis", async () => {
    const userId = `user-reg-${uid()}`;
    const client = makeClient();
    await connectClient(client);

    client.emit("register", { userId });
    await new Promise((r) => setTimeout(r, 100));

    // The handler calls gameService.registerSocketToUser which sets socket:{userId}
    const stored = await redis.get(`socket:${userId}`);
    expect(stored).toBeTruthy();
    expect(typeof stored).toBe("string"); // should be the socket id

    // Cleanup
    await redis.del(`socket:${userId}`);
    client.disconnect();
  });

  test("overwrites previous socket id when user reconnects", async () => {
    const userId = `user-rereg-${uid()}`;

    // Simulate a stale socket id already in Redis
    await redis.set(`socket:${userId}`, "old-socket-id");

    const client = makeClient();
    await connectClient(client);

    client.emit("register", { userId });
    await new Promise((r) => setTimeout(r, 100));

    const stored = await redis.get(`socket:${userId}`);
    expect(stored).not.toBe("old-socket-id");

    await redis.del(`socket:${userId}`);
    client.disconnect();
  });
});

// JOIN GAME
describe("joinGame", () => {
  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("joinGame", { gameId: "room1" }); // missing teamId + gameType

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for joinGame.");

    client.disconnect();
  });

  test("emits receiveCodeUpdate with code seeded directly in Redis", async () => {
    const teamId = `team-code-${uid()}`;
    const gameId = `game-code-${uid()}`;

    // Seed code directly via the service — bypasses any socket event
    await gameService.saveLatestCode(teamId, "let seeded = true;");

    const client = makeClient();
    await connectClient(client);

    const codePromise = waitFor(client, "receiveCodeUpdate");
    client.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });

    const code = await codePromise;
    expect(code).toBe("let seeded = true;");

    await redis.del(`game:${teamId}:code`);
    client.disconnect();
  });

  test("does not emit receiveCodeUpdate when Redis has no code for team", async () => {
    const teamId = `team-nocode-${uid()}`;
    const gameId = `game-nocode-${uid()}`;

    // Confirm key really doesn't exist
    await redis.del(`game:${teamId}:code`);

    const client = makeClient();
    await connectClient(client);

    let received = false;
    client.on("receiveCodeUpdate", () => { received = true; });

    await joinGame(client, gameId, teamId);
    expect(received).toBe(false);

    client.disconnect();
  });

  test("emits gameStarted immediately when game timer already exists in Redis", async () => {
    const gameId = `game-prestarted-${uid()}`;
    const teamId = `team-prestarted-${uid()}`;

    // Seed the expiry key directly — makes isGameStarted() return true
    await redis.set(`game:${gameId}:expires`, "1", "PX", 60000);

    const client = makeClient();
    await connectClient(client);

    const startedPromise = waitFor(client, "gameStarted");
    client.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });

    const payload = await startedPromise;
    expect(payload).toHaveProperty("start");
    expect(payload).toHaveProperty("_duration");
    // remaining TTL should be close to what we set (within 5 seconds of 60000ms)
    expect(payload.start).toBeGreaterThan(55000);
    expect(payload.start).toBeLessThanOrEqual(60000);

    await gameService.cleanupGameTimers(gameId);
    client.disconnect();
  });

  test("gameStarting + gameStarted fire when 2nd TWOPLAYER client joins", async () => {
    const gameId = `game-2p-${uid()}`;
    const teamId = `team-2p-${uid()}`;

    const clientA = makeClient();
    const clientB = makeClient();
    await connectAll(clientA, clientB);

    const startingA = waitFor(clientA, "gameStarting", 8000);
    const startingB = waitFor(clientB, "gameStarting", 8000);
    const startedA  = waitFor(clientA, "gameStarted",  8000);
    const startedB  = waitFor(clientB, "gameStarted",  8000);

    clientA.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });
    await new Promise((r) => setTimeout(r, 150));
    clientB.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });

    await Promise.all([startingA, startingB]);
    const [payloadA] = await Promise.all([startedA, startedB]);

    expect(payloadA).toHaveProperty("start");
    expect(payloadA._duration).toBe(5 * 60 * 1000);

    // Confirm Redis was actually written by startGameIfNeeded
    const isStarted = await gameService.isGameStarted(gameId);
    expect(isStarted).toBe(true);

    const ttl = await redis.pttl(`game:${gameId}:expires`);
    expect(ttl).toBeGreaterThan(0);

    await gameService.cleanupGameTimers(gameId);
    disconnectAll(clientA, clientB);
  }, 15000);

  test("gameStarting + gameStarted fire when 4th FOURPLAYER client joins", async () => {
    const gameId = `game-4p-${uid()}`;
    const teamId = `team-4p-${uid()}`;

    const clients = [makeClient(), makeClient(), makeClient(), makeClient()];
    await connectAll(...clients);

    const startedPromises = clients.map((c) => waitFor(c, "gameStarted", 8000));

    for (const c of clients) {
      c.emit("joinGame", { gameId, teamId, gameType: "FOURPLAYER" });
      await new Promise((r) => setTimeout(r, 150));
    }

    const results = await Promise.all(startedPromises);
    results.forEach((p) => expect(p).toHaveProperty("start"));

    // startGameIfNeeded should only have written the key once (NX flag)
    const activeGames = await gameService.getActiveGames();
    expect(activeGames).toContain(gameId);

    await gameService.cleanupGameTimers(gameId);
    disconnectAll(...clients);
  }, 15000);
});

// CODE CHANGE
describe("codeChange", () => {
  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("codeChange", { teamId: "t1" }); // missing code

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for codeChange.");

    client.disconnect();
  });

  test("persists code to Redis and is readable via gameService", async () => {
    const gameId = `game-save-${uid()}`;
    const teamId = `team-save-${uid()}`;

    const client = makeClient();
    await connectClient(client);
    await joinGame(client, gameId, teamId);

    client.emit("codeChange", { teamId, code: "const saved = 42;" });
    await new Promise((r) => setTimeout(r, 100));

    // Read back via service — confirms the socket handler actually called saveLatestCode
    const stored = await gameService.getLatestCode(teamId);
    expect(stored).toBe("const saved = 42;");

    await redis.del(`game:${teamId}:code`);
    client.disconnect();
  });

  test("broadcasts receiveCodeUpdate to teammates but not sender", async () => {
    const gameId = `game-bcast-${uid()}`;
    const teamId = `team-bcast-${uid()}`;

    const sender   = makeClient();
    const teammate = makeClient();
    await connectAll(sender, teammate);

    await joinGame(sender,   gameId, teamId);
    await joinGame(teammate, gameId, teamId);

    let senderReceived = false;
    sender.on("receiveCodeUpdate", () => { senderReceived = true; });

    const updatePromise = waitFor(teammate, "receiveCodeUpdate");
    sender.emit("codeChange", { teamId, code: "let x = 1;" });

    const code = await updatePromise;
    expect(code).toBe("let x = 1;");

    await new Promise((r) => setTimeout(r, 100));
    expect(senderReceived).toBe(false);

    await redis.del(`game:${teamId}:code`);
    disconnectAll(sender, teammate);
  });

  test("latest code written by socket is returned to a late-joining client", async () => {
    const gameId = `game-late-${uid()}`;
    const teamId = `team-late-${uid()}`;

    const early = makeClient();
    await connectClient(early);
    await joinGame(early, gameId, teamId);

    early.emit("codeChange", { teamId, code: "let late = true;" });
    await new Promise((r) => setTimeout(r, 100));

    // Late joiner connects after the code was saved
    const late = makeClient();
    await connectClient(late);

    const codePromise = waitFor(late, "receiveCodeUpdate");
    late.emit("joinGame", { gameId, teamId, gameType: "TWOPLAYER" });

    const code = await codePromise;
    expect(code).toBe("let late = true;");

    await redis.del(`game:${teamId}:code`);
    disconnectAll(early, late);
  });
});

// CHAT SYNC
describe("sendChat and requestChatSync", () => {
  test("emits error on invalid sendChat payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("sendChat", { teamId: "t1" }); // missing message

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for sendChat.");

    client.disconnect();
  });

  test("persists message to Redis and is readable via gameService", async () => {
    const gameId = `game-chatpersist-${uid()}`;
    const teamId = `team-chatpersist-${uid()}`;

    const client = makeClient();
    await connectClient(client);
    await joinGame(client, gameId, teamId);

    const message = { id: "mp1", text: "persisted", userName: "Alice", timestamp: Date.now() };
    client.emit("sendChat", { teamId, message });
    await new Promise((r) => setTimeout(r, 100));

    // Read directly from Redis via service
    const stored = await gameService.getChatMessages(teamId);
    expect(stored).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "mp1", text: "persisted" }),
    ]));

    await redis.del(`chat:${teamId}`);
    client.disconnect();
  });

  test("broadcasts receiveChat to teammates only", async () => {
    const gameId = `game-chatbcast-${uid()}`;
    const teamId = `team-chatbcast-${uid()}`;

    const sender   = makeClient();
    const teammate = makeClient();
    await connectAll(sender, teammate);

    await joinGame(sender,   gameId, teamId);
    await joinGame(teammate, gameId, teamId);

    const message = { id: "m1", text: "hello", userName: "Alice", timestamp: Date.now() };

    const chatPromise = waitFor(teammate, "receiveChat");
    sender.emit("sendChat", { teamId, message });

    const received = await chatPromise;
    expect(received).toMatchObject({ id: "m1", text: "hello" });

    await redis.del(`chat:${teamId}`);
    disconnectAll(sender, teammate);
  });

  test("requestChatSync returns messages seeded directly via gameService", async () => {
    const teamId = `team-chatseed-${uid()}`;

    // Seed messages directly — no socket needed for the write side
    const messages = [
      { id: "s1", text: "seeded 1", userName: "Bob",   timestamp: 1000 },
      { id: "s2", text: "seeded 2", userName: "Alice", timestamp: 2000 },
    ];
    for (const m of messages) {
      await gameService.saveChatMessage(teamId, m);
    }

    const client = makeClient();
    await connectClient(client);

    const historyPromise = waitFor(client, "receiveChatHistory");
    client.emit("requestChatSync", { teamId });

    const history = await historyPromise;
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "s1" }),
      expect.objectContaining({ id: "s2" }),
    ]));

    await redis.del(`chat:${teamId}`);
    client.disconnect();
  });

  test("chat list is capped at 50 messages", async () => {
    const teamId = `team-chatcap-${uid()}`;

    // Write 55 messages directly via service
    for (let i = 0; i < 55; i++) {
      await gameService.saveChatMessage(teamId, {
        id:       `cap-${i}`,
        text:     `msg ${i}`,
        userName: "Test",
        timestamp: i,
      });
    }

    const stored = await gameService.getChatMessages(teamId);
    expect(stored.length).toBe(50);
    // ltrim keeps the latest 50 — earliest messages are dropped
    expect(stored[0].id).toBe("cap-5");
    expect(stored[49].id).toBe("cap-54");

    await redis.del(`chat:${teamId}`);
  });
});

// TEST CASE SYNC
describe("updateTestCases and requestTestCaseSync", () => {
  const validTestCase = {
    id: 1,
    functionInput: [{ name: "x", type: "number", value: "5", isOutputParameter: false }],
    expectedOutput: { name: "result", type: "number", value: "10", isOutputParameter: true },
  };

  test("emits error on invalid updateTestCases payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("updateTestCases", { teamId: "t1" }); // missing testCases

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for updateTestCases.");

    client.disconnect();
  });

  test("persists test cases to Redis and are readable via gameService", async () => {
    const gameId = `game-tc-${uid()}`;
    const teamId = `team-tc-${uid()}`;

    const client = makeClient();
    await connectClient(client);
    await joinGame(client, gameId, teamId);

    client.emit("updateTestCases", { teamId, testCases: [validTestCase] });
    await new Promise((r) => setTimeout(r, 100));

    // Read back via service — confirms socket handler called saveTestCases
    const stored = await gameService.getTestCases(teamId);
    expect(stored).toEqual([validTestCase]);

    await redis.del(`testcases:${teamId}`);
    client.disconnect();
  });

  test("requestTestCaseSync returns test cases seeded directly via gameService", async () => {
    const teamId = `team-tcseed-${uid()}`;

    // Seed directly — tests the read path in isolation
    await gameService.saveTestCases(teamId, [validTestCase]);

    const client = makeClient();
    await connectClient(client);

    const syncPromise = waitFor(client, "receiveTestCaseSync");
    client.emit("requestTestCaseSync", { teamId });

    const received = await syncPromise;
    expect(received).toEqual([validTestCase]);

    await redis.del(`testcases:${teamId}`);
    client.disconnect();
  });

  test("does not emit receiveTestCaseSync when key absent from Redis", async () => {
    const teamId = `team-tcempty-${uid()}`;
    await redis.del(`testcases:${teamId}`); // guarantee absence

    const client = makeClient();
    await connectClient(client);

    let received = false;
    client.on("receiveTestCaseSync", () => { received = true; });

    client.emit("requestTestCaseSync", { teamId });
    await new Promise((r) => setTimeout(r, 150));

    expect(received).toBe(false);

    client.disconnect();
  });

  test("overwriting test cases replaces the previous value in Redis", async () => {
    const teamId = `team-tcoverwrite-${uid()}`;

    await gameService.saveTestCases(teamId, [validTestCase]);

    const updated = [{ ...validTestCase, id: 2 }];
    await gameService.saveTestCases(teamId, updated);

    const stored = await gameService.getTestCases(teamId);
    expect(stored).toEqual(updated);
    expect(stored[0].id).toBe(2);

    await redis.del(`testcases:${teamId}`);
  });
});

// TEAM UPDATE IN LOBBY
describe("requestTeamUpdate", () => {
  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);

    const errPromise = waitFor(client, "error");
    client.emit("requestTeamUpdate", { teamId: "t1" }); // missing playerCount

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for requestTeamUpdate.");

    client.disconnect();
  });

  test("broadcasts teamUpdated to all connected clients including sender", async () => {
    const teamId = `team-upd-${uid()}`;

    const sender   = makeClient();
    const observer = makeClient();
    await connectAll(sender, observer);

    // io.emit sends to everyone — sender receives it too unlike socket.to()
    const senderPromise   = waitFor(sender,   "teamUpdated");
    const observerPromise = waitFor(observer, "teamUpdated");

    sender.emit("requestTeamUpdate", { teamId, playerCount: 2 });

    const [fromSender, fromObserver] = await Promise.all([senderPromise, observerPromise]);
    expect(fromSender).toMatchObject(  { teamId, playerCount: 2 });
    expect(fromObserver).toMatchObject({ teamId, playerCount: 2 });

    disconnectAll(sender, observer);
  });

  test("does not broadcast when playerCount is 0", async () => {
    const client = makeClient();
    await connectClient(client);

    let received = false;
    client.on("teamUpdated", () => { received = true; });

    client.emit("requestTeamUpdate", { teamId: `team-zero-${uid()}`, playerCount: 0 });
    await new Promise((r) => setTimeout(r, 150));

    expect(received).toBe(false);

    client.disconnect();
  });
});

// GAME SERVICE TESTS
describe("gameService.startGameIfNeeded", () => {
  test("creates expiry, roleswap, and warning keys in Redis on first call", async () => {
    const gameId = `game-svc-${uid()}`;

    await gameService.startGameIfNeeded(gameId);

    const expiresExists  = await redis.exists(`game:${gameId}:expires`);
    const roleswapExists = await redis.exists(`game:${gameId}:roleswap`);
    const warningExists  = await redis.exists(`game:${gameId}:roleswap:warning`);

    expect(expiresExists).toBe(1);
    expect(roleswapExists).toBe(1);
    // Warning key may already have expired if flip ratio was very low — check TTL instead
    const warningTtl = await redis.pttl(`game:${gameId}:roleswap:warning`);
    expect(warningTtl).toBeGreaterThanOrEqual(-1); // -1 = no expiry set, -2 = gone

    const activeGames = await gameService.getActiveGames();
    expect(activeGames).toContain(gameId);

    await gameService.cleanupGameTimers(gameId);
  });

  test("is idempotent — second call does not reset the timer (NX flag)", async () => {
    const gameId = `game-nx-${uid()}`;

    await gameService.startGameIfNeeded(gameId);
    const firstTtl = await redis.pttl(`game:${gameId}:expires`);

    await new Promise((r) => setTimeout(r, 200)); // let time pass

    await gameService.startGameIfNeeded(gameId);
    const secondTtl = await redis.pttl(`game:${gameId}:expires`);

    // Second call must not have reset the key — TTL should be lower, not reset to full
    expect(secondTtl).toBeLessThan(firstTtl);

    await gameService.cleanupGameTimers(gameId);
  });

  test("returns remaining TTL close to GAME_DURATION_MS on first start", async () => {
    const gameId = `game-ttl-${uid()}`;

    const result = await gameService.startGameIfNeeded(gameId);

    expect(result.duration).toBe(5 * 60 * 1000);
    // Allow 2 second window for test execution time
    expect(result.remaining).toBeGreaterThan(5 * 60 * 1000 - 2000);
    expect(result.remaining).toBeLessThanOrEqual(5 * 60 * 1000);

    await gameService.cleanupGameTimers(gameId);
  });
});

// CLEANUP GAME TIMERS
describe("gameService.cleanupGameTimers", () => {
  test("removes all three timer keys and removes game from activeGames", async () => {
    const gameId = `game-cleanup-${uid()}`;

    await gameService.startGameIfNeeded(gameId);
    await gameService.cleanupGameTimers(gameId);

    expect(await redis.exists(`game:${gameId}:expires`)).toBe(0);
    expect(await redis.exists(`game:${gameId}:roleswap`)).toBe(0);
    expect(await redis.exists(`game:${gameId}:roleswap:warning`)).toBe(0);

    const activeGames = await gameService.getActiveGames();
    expect(activeGames).not.toContain(gameId);
  });
});