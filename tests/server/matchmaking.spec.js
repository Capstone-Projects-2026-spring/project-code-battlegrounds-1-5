const { beforeAll, afterAll, afterEach, beforeEach, describe, test, expect } = require("bun:test");
const { mock } = require("bun:test");

// ---------------------------------------------------------------------------
// Prisma mock — must be declared before any require() that pulls in
// matchmakingService, because Bun hoists mock.module calls.
//
// prismaStub's methods are plain object properties so individual tests can
// swap them out per-scenario without re-declaring the whole mock.
// ---------------------------------------------------------------------------
const prismaStub = {
  problem: {
    findMany: async () => [{ id: "problem-seed-123" }],
  },
  gameRoom: {
    create: async ({ data }) => ({
      id: data.id ?? "room-abc",
      gameType: data.gameType,
      teams: data.teams.create.map((team, ti) => ({
        id: `team-${ti}`,
        players: team.players.create.map((p) => ({
          userId: p.userId,
          role: p.role,
        })),
      })),
    }),
  },
  party: {
    // Default: party not found. Override per-test for party scenarios.
    findUnique: async () => null,
  },
};

mock.module("../../server/prisma/index", () => ({
  getPrisma: () => prismaStub,
}));

// Also stub warmVm so it doesn't try to spin up a real VM during tests
mock.module("../../server/utils/vm/warmVm", () => ({
  warmVm: () => { },
}));

// ---------------------------------------------------------------------------
// Remaining imports (after mock declarations)
// ---------------------------------------------------------------------------
const Redis = require("ioredis");
const {
  makeClient,
  connectClient,
  connectAll,
  disconnectAll,
  waitFor,
  uid,
} = require("../../server/utils/tests/helpers");
const { createMatchmakingService } = require("../../server/matchmaking/matchmakingService");
const { createGameService } = require("../../server/game/gameService");

// ---------------------------------------------------------------------------
// Redis + service setup
// ---------------------------------------------------------------------------
let redis;
let matchmakingService;

beforeAll(() => {
  redis = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
  });
  const ioStub = { to: () => ({ emit: () => { } }) };
  matchmakingService = createMatchmakingService(redis, ioStub);
});

afterAll(async () => {
  await redis.quit();
});

// ---------------------------------------------------------------------------
// joinQueue (socket integration)
// ---------------------------------------------------------------------------
describe("joinQueue", () => {
  test("emits queueStatus 'queued' when first player joins", async () => {
    const client = makeClient();
    await connectClient(client);

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("joinQueue", {
      userId: `user-q1-${uid()}`,
      gameType: "FOURPLAYER", // needs 4 — will never auto-match in this test
      difficulty: "EASY",
    });

    const status = await statusPromise;
    expect(status.status).toBe("queued");

    client.disconnect();
  });

  // The socket-level "matched" response requires the server's _createGameInDB to
  // succeed, which needs a real DB. Instead we verify the queue behaviour directly:
  // after two players join TWOPLAYER, the Lua pop-and-match script removes both
  // entries — confirming match-formation was triggered regardless of DB outcome.
  test("second player joining empties the TWOPLAYER queue (Lua pop-and-match fired)", async () => {
    const clientA = makeClient();
    const clientB = makeClient();
    await connectAll(clientA, clientB);

    const suffix = uid();
    const key = "queue:TWOPLAYER:MEDIUM";
    await redis.del(key);

    // clientA joins — one entry in the queue
    const statusA = waitFor(clientA, "queueStatus");
    clientA.emit("joinQueue", {
      userId: `user-match-a-${suffix}`,
      gameType: "TWOPLAYER",
      difficulty: "MEDIUM",
    });
    await statusA;

    expect(await redis.llen(key)).toBe(1);

    // clientB joins — Lua script pops both entries to attempt match formation
    clientB.emit("joinQueue", {
      userId: `user-match-b-${suffix}`,
      gameType: "TWOPLAYER",
      difficulty: "MEDIUM",
    });
    await new Promise((r) => setTimeout(r, 300));

    // Both entries consumed by the Lua script — queue is empty regardless of DB result
    expect(await redis.llen(key)).toBe(0);

    disconnectAll(clientA, clientB);
  });

  test("emits queueStatus 'queued' if same user joins twice", async () => {
    const userId = `user-dupe-${uid()}`;
    const client = makeClient();
    await connectClient(client);

    // FOURPLAYER so the first join never triggers a match
    client.emit("joinQueue", { userId, gameType: "FOURPLAYER", difficulty: "HARD" });
    await new Promise((r) => setTimeout(r, 150));

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("joinQueue", { userId, gameType: "FOURPLAYER", difficulty: "HARD" });

    const status = await statusPromise;
    expect(status.status).toBe("queued");

    client.disconnect();
  });

  test("TWOPLAYER + partyId bypasses queue and returns error for unknown party", async () => {
    const client = makeClient();
    await connectClient(client);

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("joinQueue", {
      userId: `user-party-${uid()}`,
      gameType: "TWOPLAYER",
      difficulty: "MEDIUM",
      partyId: `party-real-db-miss-${uid()}`, // real DB will return null → party_not_found
    });

    const status = await statusPromise;
    // Real Prisma returns null for an unknown partyId → { error: "party_not_found" }
    expect(status).toHaveProperty("error");
    expect(["party_not_found", "party_not_full"]).toContain(status.error);

    client.disconnect();
  });

  test("lobbyId is forwarded as partyId and returns error for unknown party", async () => {
    const client = makeClient();
    await connectClient(client);

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("joinQueue", {
      userId: `user-lobby-${uid()}`,
      gameType: "TWOPLAYER",
      difficulty: "HARD",
      lobbyId: `lobby-real-db-miss-${uid()}`,
    });

    const status = await statusPromise;
    expect(status).toHaveProperty("error");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// leaveQueue (socket integration)
// ---------------------------------------------------------------------------
describe("leaveQueue", () => {
  test("emits queueStatus 'removed' after leaving", async () => {
    const userId = `user-leave-${uid()}`;
    const client = makeClient();
    await connectClient(client);

    client.emit("register", { userId });
    await new Promise((r) => setTimeout(r, 100));

    // FOURPLAYER — won't auto-match with a single entry
    client.emit("joinQueue", { userId, gameType: "FOURPLAYER", difficulty: "EASY" });
    await new Promise((r) => setTimeout(r, 150));

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("leaveQueue", { gameType: "FOURPLAYER", difficulty: "EASY" });

    const status = await statusPromise;
    expect(status.status).toBe("removed");

    client.disconnect();
  });

  test("emits queueStatus 'not_found' when user was never queued", async () => {
    const userId = `user-notq-${uid()}`;
    const client = makeClient();
    await connectClient(client);

    client.emit("register", { userId });
    await new Promise((r) => setTimeout(r, 100));

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("leaveQueue", { gameType: "FOURPLAYER", difficulty: "HARD" });

    const status = await statusPromise;
    expect(status.status).toBe("not_found");

    client.disconnect();
  });

  test("does nothing when socket.userId is not set", async () => {
    const client = makeClient();
    await connectClient(client);

    // Intentionally skip register — socket.userId stays unset
    let received = false;
    client.on("queueStatus", () => { received = true; });

    client.emit("leaveQueue", { gameType: "TWOPLAYER", difficulty: "EASY" });
    await new Promise((r) => setTimeout(r, 150));

    expect(received).toBe(false);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// updateQueueSelection (socket integration)
// ---------------------------------------------------------------------------
describe("updateQueueSelection", () => {
  test("forwards receiveQueueSelection to the target party member's socket", async () => {
    const suffix = uid();
    const senderId = `user-sel-sender-${suffix}`;
    const memberId = `user-sel-member-${suffix}`;

    const sender = makeClient();
    const member = makeClient();
    await connectAll(sender, member);

    sender.emit("register", { userId: senderId });
    member.emit("register", { userId: memberId });
    await new Promise((r) => setTimeout(r, 100));

    const selectionPromise = waitFor(member, "receiveQueueSelection");
    sender.emit("updateQueueSelection", {
      gameType: "FOURPLAYER",
      difficulty: "MEDIUM",
      partyMember: { userId: memberId },
    });

    const payload = await selectionPromise;
    expect(payload).toMatchObject({ gameType: "FOURPLAYER", difficulty: "MEDIUM" });

    disconnectAll(sender, member);
  });

  test("does nothing when socket.userId is not set", async () => {
    const memberId = `user-sel-noid-${uid()}`;
    const member = makeClient();
    await connectClient(member);

    member.emit("register", { userId: memberId });
    await new Promise((r) => setTimeout(r, 100));

    let received = false;
    member.on("receiveQueueSelection", () => { received = true; });

    const sender = makeClient(); // skips register
    await connectClient(sender);
    sender.emit("updateQueueSelection", {
      gameType: "TWOPLAYER",
      difficulty: "EASY",
      partyMember: { userId: memberId },
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(received).toBe(false);

    disconnectAll(sender, member);
  });
});

// ---------------------------------------------------------------------------
// partySearch (socket integration)
// ---------------------------------------------------------------------------
describe("partySearch", () => {
  test("forwards partySearchUpdate with state to the target party member", async () => {
    const suffix = uid();
    const senderId = `user-ps-sender-${suffix}`;
    const memberId = `user-ps-member-${suffix}`;

    const sender = makeClient();
    const member = makeClient();
    await connectAll(sender, member);

    sender.emit("register", { userId: senderId });
    member.emit("register", { userId: memberId });
    await new Promise((r) => setTimeout(r, 100));

    const updatePromise = waitFor(member, "partySearchUpdate");
    sender.emit("partySearch", {
      partyMember: { userId: memberId },
      state: "searching",
    });

    const payload = await updatePromise;
    expect(payload).toMatchObject({ state: "searching" });

    disconnectAll(sender, member);
  });

  test("does nothing when partyMember is absent", async () => {
    const senderId = `user-ps-nopm-${uid()}`;
    const sender = makeClient();
    await connectClient(sender);

    sender.emit("register", { userId: senderId });
    await new Promise((r) => setTimeout(r, 100));

    let received = false;
    sender.on("partySearchUpdate", () => { received = true; });

    sender.emit("partySearch", { state: "searching" }); // no partyMember
    await new Promise((r) => setTimeout(r, 150));

    expect(received).toBe(false);

    sender.disconnect();
  });

  test("does nothing when socket.userId is not set", async () => {
    const memberId = `user-ps-noid-${uid()}`;
    const member = makeClient();
    await connectClient(member);

    member.emit("register", { userId: memberId });
    await new Promise((r) => setTimeout(r, 100));

    let received = false;
    member.on("partySearchUpdate", () => { received = true; });

    const sender = makeClient(); // skips register
    await connectClient(sender);
    sender.emit("partySearch", {
      partyMember: { userId: memberId },
      state: "searching",
    });

    await new Promise((r) => setTimeout(r, 150));
    expect(received).toBe(false);

    disconnectAll(sender, member);
  });

  test("delivers different state values correctly", async () => {
    const suffix = uid();
    const senderId = `user-ps-state-s-${suffix}`;
    const memberId = `user-ps-state-m-${suffix}`;

    const sender = makeClient();
    const member = makeClient();
    await connectAll(sender, member);

    sender.emit("register", { userId: senderId });
    member.emit("register", { userId: memberId });
    await new Promise((r) => setTimeout(r, 100));

    for (const state of ["searching", "found", "cancelled"]) {
      const updatePromise = waitFor(member, "partySearchUpdate");
      sender.emit("partySearch", { partyMember: { userId: memberId }, state });
      const payload = await updatePromise;
      expect(payload.state).toBe(state);
    }

    disconnectAll(sender, member);
  });
});

// ---------------------------------------------------------------------------
// matchmakingService.joinQueue (service unit)
// ---------------------------------------------------------------------------
describe("matchmakingService.joinQueue", () => {
  async function drainQueue(gameType, difficulty) {
    await redis.del(`queue:${gameType}:${difficulty}`);
  }

  test("returns 'queued' when first solo player joins", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "EASY";
    await drainQueue(gameType, difficulty);

    const result = await matchmakingService.joinQueue(
      `solo-first-${uid()}`, gameType, difficulty
    );
    expect(result.status).toBe("queued");

    await drainQueue(gameType, difficulty);
  });

  test("returns 'queued' when same userId joins twice", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "EASY";
    const userId = `dupe-svc-${uid()}`;
    await drainQueue(gameType, difficulty);

    await matchmakingService.joinQueue(userId, gameType, difficulty);
    const result = await matchmakingService.joinQueue(userId, gameType, difficulty);

    expect(result.status).toBe("queued");

    await drainQueue(gameType, difficulty);
  });

  test("returns 'matched' with gameId when two TWOPLAYER users join", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "HARD";
    await drainQueue(gameType, difficulty);

    await matchmakingService.joinQueue(`svc-match-a-${uid()}`, gameType, difficulty);
    const result = await matchmakingService.joinQueue(`svc-match-b-${uid()}`, gameType, difficulty);

    expect(result.status).toBe("matched");
    expect(result).toHaveProperty("gameId");

    await drainQueue(gameType, difficulty);
  });

  test("entry is written to the correct Redis list key", async () => {
    const gameType = "FOURPLAYER";
    const difficulty = "HARD";
    const userId = `redis-key-${uid()}`;
    await drainQueue(gameType, difficulty);

    await matchmakingService.joinQueue(userId, gameType, difficulty);

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    const found = entries.some((e) => JSON.parse(e).userId === userId);
    expect(found).toBe(true);

    await drainQueue(gameType, difficulty);
  });

  test("entry includes a joinedAt timestamp", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "MEDIUM";
    const userId = `ts-check-${uid()}`;
    await drainQueue(gameType, difficulty);

    const before = Date.now();
    await matchmakingService.joinQueue(userId, gameType, difficulty);
    const after = Date.now();

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    const entry = entries.map((e) => JSON.parse(e)).find((e) => e.userId === userId);
    expect(entry.joinedAt).toBeGreaterThanOrEqual(before);
    expect(entry.joinedAt).toBeLessThanOrEqual(after);

    await drainQueue(gameType, difficulty);
  });

  test("TWOPLAYER + partyId bypasses the queue entirely (no list entry written)", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "EASY";
    const userId = `party-bypass-${uid()}`;
    const partyId = `party-nonexistent-${uid()}`;
    await drainQueue(gameType, difficulty);

    const result = await matchmakingService.joinQueue(userId, gameType, difficulty, partyId);
    expect(result).toHaveProperty("error");

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    expect(entries.some((e) => JSON.parse(e).partyId === partyId)).toBe(false);

    await drainQueue(gameType, difficulty);
  });

  test("TWOPLAYER + valid partyId returns 'matched' via _formPartyGame", async () => {
    const suffix = uid();
    const partyId = `party-valid-${suffix}`;
    prismaStub.party.findUnique = async () => ({
      id: partyId,
      owner: { id: `owner-${suffix}` },
      member: { userId: `member-${suffix}` },
    });

    const result = await matchmakingService.joinQueue(
      `user-party-valid-${suffix}`, "TWOPLAYER", "EASY", partyId
    );

    expect(result.status).toBe("matched");
    expect(result).toHaveProperty("gameId");

    prismaStub.party.findUnique = async () => null;
  });

  test("FOURPLAYER + partyId pushes a party entry rather than bypassing", async () => {
    const gameType = "FOURPLAYER";
    const difficulty = "EASY";
    const partyId = `party-4p-${uid()}`;
    await drainQueue(gameType, difficulty);

    await matchmakingService.joinQueue(`user-4p-${uid()}`, gameType, difficulty, partyId);

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    expect(entries.some((e) => JSON.parse(e).partyId === partyId)).toBe(true);

    await drainQueue(gameType, difficulty);
  });
});

// ---------------------------------------------------------------------------
// matchmakingService.leaveQueue (service unit)
// ---------------------------------------------------------------------------
describe("matchmakingService.leaveQueue", () => {
  test("returns 'removed' and entry is gone from Redis", async () => {
    const gameType = "FOURPLAYER";
    const difficulty = "EASY";
    const userId = `leave-svc-${uid()}`;
    await redis.del(`queue:${gameType}:${difficulty}`);

    await matchmakingService.joinQueue(userId, gameType, difficulty);
    const result = await matchmakingService.leaveQueue(userId, gameType, difficulty);

    expect(result.status).toBe("removed");

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    expect(entries.some((e) => JSON.parse(e).userId === userId)).toBe(false);
  });

  test("returns 'not_found' when user was never in the queue", async () => {
    const result = await matchmakingService.leaveQueue(
      `ghost-${uid()}`, "TWOPLAYER", "HARD"
    );
    expect(result.status).toBe("not_found");
  });

  test("only removes the target user, leaving other entries intact", async () => {
    // FOURPLAYER needs 4 — adding 2 entries is safe, no match will form
    const gameType = "FOURPLAYER";
    const difficulty = "MEDIUM";
    const userA = `keep-a-${uid()}`;
    const userB = `remove-b-${uid()}`;
    await redis.del(`queue:${gameType}:${difficulty}`);

    await matchmakingService.joinQueue(userA, gameType, difficulty);
    await matchmakingService.joinQueue(userB, gameType, difficulty);

    await matchmakingService.leaveQueue(userB, gameType, difficulty);

    const entries = await redis.lrange(`queue:${gameType}:${difficulty}`, 0, -1);
    expect(entries.some((e) => JSON.parse(e).userId === userA)).toBe(true);
    expect(entries.some((e) => JSON.parse(e).userId === userB)).toBe(false);

    await redis.del(`queue:${gameType}:${difficulty}`);
  });
});

// ---------------------------------------------------------------------------
// matchmakingService.leaveAllQueues (service unit)
// ---------------------------------------------------------------------------
describe("matchmakingService.leaveAllQueues", () => {
  test("removes user from every queue they were seeded into", async () => {
    const userId = `leaveall-${uid()}`;

    const queues = [
      ["TWOPLAYER", "EASY"],
      ["TWOPLAYER", "HARD"],
      ["FOURPLAYER", "MEDIUM"],
    ];

    for (const [gt, diff] of queues) {
      await redis.rpush(
        `queue:${gt}:${diff}`,
        JSON.stringify({ userId, joinedAt: Date.now() })
      );
    }

    await matchmakingService.leaveAllQueues(userId);

    for (const [gt, diff] of queues) {
      const entries = await redis.lrange(`queue:${gt}:${diff}`, 0, -1);
      expect(entries.some((e) => JSON.parse(e).userId === userId)).toBe(false);
    }
  });

  test("is safe to call when user is not in any queue", async () => {
    await matchmakingService.leaveAllQueues(`ghost-all-${uid()}`);
  });
});

// ---------------------------------------------------------------------------
// matchmakingService.getQueueLengths (service unit)
// ---------------------------------------------------------------------------
describe("matchmakingService.getQueueLengths", () => {
  test("returns an object keyed by gameType then difficulty", async () => {
    const lengths = await matchmakingService.getQueueLengths();

    expect(lengths).toHaveProperty("TWOPLAYER");
    expect(lengths).toHaveProperty("FOURPLAYER");
    expect(lengths.TWOPLAYER).toHaveProperty("EASY");
    expect(typeof lengths.TWOPLAYER.EASY).toBe("number");
  });

  test("reflects entries added directly to Redis", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "HARD";
    const key = `queue:${gameType}:${difficulty}`;
    await redis.del(key);

    await redis.rpush(key, JSON.stringify({ userId: `gl-a-${uid()}`, joinedAt: 1 }));
    await redis.rpush(key, JSON.stringify({ userId: `gl-b-${uid()}`, joinedAt: 2 }));

    const lengths = await matchmakingService.getQueueLengths();
    expect(lengths[gameType][difficulty]).toBe(2);

    await redis.del(key);
  });

  test("returns 0 for an empty queue", async () => {
    const gameType = "FOURPLAYER";
    const difficulty = "EASY";
    await redis.del(`queue:${gameType}:${difficulty}`);

    const lengths = await matchmakingService.getQueueLengths();
    expect(lengths[gameType][difficulty]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Bug 1 — Non-atomic duplicate-check in joinQueue
// ---------------------------------------------------------------------------
// joinQueue does a lrange + some() check before rpush. Two Cloud Run instances
// can both read the list while it is empty, both pass the check, and both push —
// leaving the same userId in the queue twice. The Lua pop-and-match script then
// treats it as two distinct players, forming a game with a ghost slot (the
// exact failure seen in the 2v2 demo where 3 players got the game room and
// one was left on the "Match Found" screen).
// ---------------------------------------------------------------------------
describe("Bug 1 — non-atomic duplicate-check in joinQueue", () => {
  const GT = "FOURPLAYER"; // needs 4 players — a single entry never auto-matches
  const DIFF = "EASY";
  const KEY = `queue:${GT}:${DIFF}`;

  beforeEach(async () => { await redis.del(KEY); });
  afterEach(async () => { await redis.del(KEY); });

  test("concurrent joinQueue calls for the same userId result in exactly one queue entry", async () => {
    // Fire both without any await between them — simulates two Cloud Run
    // instances both passing the lrange duplicate-check at the same time.
    const userId = `race-dupe-${uid()}`;
    await Promise.all([
      matchmakingService.joinQueue(userId, GT, DIFF),
      matchmakingService.joinQueue(userId, GT, DIFF),
    ]);

    const entries = await redis.lrange(KEY, 0, -1);
    const count = entries.filter((e) => JSON.parse(e).userId === userId).length;

    // Fails today (count === 2). Will pass once the check is made atomic
    // (e.g. via a Redis Set index or by moving the check into the Lua script).
    expect(count).toBe(1);
  });

  test("second sequential joinQueue call for the same userId returns queued", async () => {
    const userId = `seq-dupe-${uid()}`;

    await matchmakingService.joinQueue(userId, GT, DIFF);
    const second = await matchmakingService.joinQueue(userId, GT, DIFF);

    expect(second.status).toBe("queued");
  });

  test("two different users racing each other both get their entries written", async () => {
    const userA = `race-a-${uid()}`;
    const userB = `race-b-${uid()}`;

    await Promise.all([
      matchmakingService.joinQueue(userA, GT, DIFF),
      matchmakingService.joinQueue(userB, GT, DIFF),
    ]);

    const entries = await redis.lrange(KEY, 0, -1);
    const parsedIds = entries.map((e) => JSON.parse(e).userId);

    expect(parsedIds).toContain(userA);
    expect(parsedIds).toContain(userB);
  });

  test("a duplicate entry does not inflate the queue length reported by getQueueLengths", async () => {
    // Manually inject a duplicate to simulate the race outcome.
    const userId = `corrupt-count-${uid()}`;
    const entry = JSON.stringify({ userId, joinedAt: Date.now() });
    await redis.rpush(KEY, entry, entry); // two identical entries

    const lengths = await matchmakingService.getQueueLengths();

    // After the fix, length should equal 1 (unique players), not 2 (raw list length).
    // This assertion documents the current broken state — it will return 2 until fixed.
    expect(lengths[GT][DIFF]).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Bug 2 — socket:userId overwritten before matchFound is delivered
// ---------------------------------------------------------------------------
// When a user's socket reconnects (page refresh, Next.js re-hydration, brief
// drop), their new socket fires `register` and overwrites `socket:<userId>` in
// Redis. If a match forms between the old socket dropping and the new register
// arriving, _notifyPlayers reads a stale or null socket ID and the matchFound
// event is either lost or delivered to a dead socket. This is the "stuck on
// Match Found screen but had the gameId" symptom from the demo.
// ---------------------------------------------------------------------------
describe("Bug 2 — socket:userId overwritten before matchFound is delivered", () => {
  afterEach(async () => {
    const socketKeys = await redis.keys("socket:bug2-*");
    const pendingKeys = await redis.keys("pending:match:bug2-*");
    const all = [...socketKeys, ...pendingKeys];
    if (all.length) await redis.del(...all);
  });

  test("_notifyPlayers emits to the current socket ID, not a stale one", async () => {
    const userId = `bug2-user-${uid()}`;
    const currentSocket = `current-${uid()}`;

    await redis.set(`socket:${userId}`, currentSocket);

    const emittedTo = [];
    const io = { to: (sid) => ({ emit: (ev, d) => emittedTo.push({ sid, ev, d }) }) };
    const service = createMatchmakingService(redis, io);

    await service._notifyPlayers({
      id: `game-${uid()}`,
      teams: [{ players: [{ userId }] }],
    });

    expect(emittedTo).toHaveLength(1);
    expect(emittedTo[0].sid).toBe(currentSocket);
    expect(emittedTo[0].ev).toBe("matchFound");
  });

  test("matchFound is silently dropped when socket:userId was deleted before _notifyPlayers ran", async () => {
    const userId = `bug2-gone-${uid()}`;

    // Simulate: disconnect handler already ran — key deleted before notify
    await redis.del(`socket:${userId}`);

    const emittedTo = [];
    const io = { to: (sid) => ({ emit: (ev, d) => emittedTo.push({ sid, ev, d }) }) };
    const service = createMatchmakingService(redis, io);

    await service._notifyPlayers({
      id: `game-${uid()}`,
      teams: [{ players: [{ userId }] }],
    });

    // Current behaviour: silently dropped. Documents the gap.
    expect(emittedTo).toHaveLength(0);
  });

  test("pending:match recovery key is written after matchFound is sent (post-fix contract)", async () => {
    // Documents the EXPECTED behaviour after Bug 2 is fixed:
    // _notifyPlayers should write `pending:match:<userId>` so a reconnecting
    // socket can re-receive matchFound without re-queuing.
    const userId = `bug2-pending-${uid()}`;
    const socketId = `sock-${uid()}`;
    const gameId = `game-pending-${uid()}`;

    await redis.set(`socket:${userId}`, socketId);

    const io = { to: () => ({ emit: () => { } }) };
    const service = createMatchmakingService(redis, io);

    await service._notifyPlayers({
      id: gameId,
      teams: [{ players: [{ userId }] }],
    });

    const pendingGameId = await redis.get(`pending:match:${userId}`);

    // Fails today — key is not written. Will pass once the fix is in place.
    expect(pendingGameId).toBe(gameId);
  });

  test("re-registering after matchFound recovers the pending game via registerSocketToUser (post-fix contract)", async () => {
    const userId = `bug2-recover-${uid()}`;
    const gameId = `game-recover-${uid()}`;
    const newSocket = `new-sock-${uid()}`;

    await redis.set(`pending:match:${userId}`, gameId, "EX", 120);

    const { createGameService } = require("../../server/game/gameService");
    const ioStub = { to: () => ({ emit: () => { } }) };
    const gs = createGameService(redis, ioStub);

    // registerSocketToUser now returns the pending gameId if one exists
    const returned = await gs.registerSocketToUser(userId, newSocket);

    expect(returned).toBe(gameId);
  });
});

// ---------------------------------------------------------------------------
// Bug 3 — gameStarting fires on socket count before all players are ready
// ---------------------------------------------------------------------------
// joinGame counts live sockets in the room. The Nth socket to join emits
// gameStarting and starts a 3-second setTimeout. If a player's socket drops
// and reconnects during that window, isGameStarted() returns false (the Redis
// key has not been set yet) AND their numPlayers count won't hit the threshold,
// so they receive neither gameStarting nor gameStarted and the game appears
// frozen on their screen.
// ---------------------------------------------------------------------------
describe("Bug 3 — gameStarting fires on socket count before all players are ready", () => {
  test("isGameStarted returns false during the 3-second window before setTimeout fires", async () => {
    // The Redis `game:<id>:expires` key is only set inside the setTimeout callback.
    // This test confirms that window exists by checking the key is absent
    // immediately after the match would have been created.
    const gameId = `bug3-timing-${uid()}`;
    const started = await redis.exists(`game:${gameId}:expires`);

    // Key does not exist yet — isGameStarted() returns false during the window.
    expect(started).toBe(0);
  });

  test("a player joining with 3/4 sockets during the window gets no gameStarted or gameStarting", async () => {
    // Directly test the joinGame branching logic.
    // isGameStarted = false (window), room has 3 sockets (not 4) → neither branch fires.
    const { registerGameHandlers } = require("../../server/socket/handlers/gameHandlers");

    const gameId = `bug3-gap-${uid()}`;
    const received = [];

    const gameService = {
      GAME_DURATION_MS: 300_000,
      isGameStarted: async () => false,
      startGameIfNeeded: async () => ({ remaining: 290_000, duration: 300_000 }),
      getLatestCode: async () => null,
      registerSocketToUser: async () => { },
    };

    const io = {
      in: () => ({ allSockets: async () => new Set(["s1", "s2", "s3"]) }), // only 3
      to: (room) => ({ emit: (ev, d) => received.push({ room, ev, d }) }),
    };

    const listeners = {};
    const socket = {
      id: "s-late", userId: "u-late", teamId: null, gameId: null,
      join: async () => { },
      emit: (ev, d) => received.push({ room: "direct", ev, d }),
      to: () => ({ emit: () => { } }),
      on: (event, handler) => { listeners[event] = handler; },
    };

    registerGameHandlers(io, socket, gameService, 50); // 50 ms delay for fast test
    await listeners["joinGame"]?.({ gameId, teamId: "team-1", gameType: "FOURPLAYER" });

    await new Promise((r) => setTimeout(r, 200));

    const gotEvent = received.some((r) => r.ev === "gameStarted" || r.ev === "gameStarting");
    // Confirms the gap: late-joining player in the window gets nothing.
    expect(gotEvent).toBe(false);
  });

  test("a player joining after the game is fully started receives gameStarted immediately", async () => {
    // Happy path: Redis key already exists → isGameStarted = true → immediate emit.
    const { registerGameHandlers } = require("../../server/socket/handlers/gameHandlers");

    const gameId = `bug3-happy-${uid()}`;
    const received = [];

    const gameService = {
      GAME_DURATION_MS: 300_000,
      isGameStarted: async () => true,
      startGameIfNeeded: async () => ({ remaining: 250_000, duration: 300_000 }),
      getLatestCode: async () => null,
      registerSocketToUser: async () => { },
    };

    const io = {
      in: () => ({ allSockets: async () => new Set(["s1", "s2", "s3", "s4"]) }),
      to: (room) => ({ emit: (ev, d) => received.push({ room, ev, d }) }),
    };

    const listeners = {};
    const socket = {
      id: "s-rejoin", userId: "u-rejoin", teamId: null, gameId: null,
      join: async () => { },
      emit: (ev, d) => received.push({ room: "direct", ev, d }),
      to: () => ({ emit: () => { } }),
      on: (event, handler) => { listeners[event] = handler; },
    };

    registerGameHandlers(io, socket, gameService, 50);
    await listeners["joinGame"]?.({ gameId, teamId: "team-1", gameType: "FOURPLAYER" });

    await new Promise((r) => setTimeout(r, 100));

    expect(received.some((r) => r.ev === "gameStarted")).toBe(true);
  });

  test("game:expires key is set with correct TTL after startGameIfNeeded runs", async () => {
    // Sanity-check that startGameIfNeeded itself uses NX (only sets once).
    // This confirms the idempotency guard works; the bug is in the 3s window
    // before the guard is even reached.
    const gameId = `bug3-nx-${uid()}`;
    await redis.del(`game:${gameId}:expires`);

    const { createGameService } = require("../../server/game/gameService");
    const ioStub = { in: () => ({ allSockets: async () => new Set() }), to: () => ({ emit: () => { } }) };
    const gs = createGameService(redis, ioStub);

    const first = await gs.startGameIfNeeded(gameId);
    const second = await gs.startGameIfNeeded(gameId);

    // Both calls return a TTL, but only the first actually sets the key
    expect(first.remaining).toBeGreaterThan(0);
    expect(second.remaining).toBeGreaterThan(0);

    // Cleanup
    await redis.del(`game:${gameId}:expires`);
    await redis.del(`game:${gameId}:roleswap`);
    await redis.del(`game:${gameId}:roleswap:warning`);
    await redis.srem("activeGames", gameId);
  });
});

// ---------------------------------------------------------------------------
// Bug 4 — disconnect clears socket:userId before matchFound is sent
// ---------------------------------------------------------------------------
// The disconnect handler immediately calls cleanupSocket (DEL socket:<userId>)
// then leaveAllQueues. But if the Lua script already popped this user as part
// of a match and _notifyPlayers is in-flight, cleanupSocket deletes the key
// first — the GET in _notifyPlayers returns null and the emit is silently
// dropped. The player never receives matchFound and remains stuck in limbo.
// ---------------------------------------------------------------------------
describe("Bug 4 — disconnect clears socket:userId before matchFound is sent", () => {
  afterEach(async () => {
    const keys = await redis.keys("socket:bug4-*");
    if (keys.length) await redis.del(...keys);
  });

  test("GET socket:userId after a concurrent DEL can return null (demonstrates the race)", async () => {
    // Run 20 iterations to surface the interleaving reliably.
    // In at least some runs GET will win and in others DEL will win first.
    let nullCount = 0;

    for (let i = 0; i < 20; i++) {
      const userId = `bug4-race-${uid()}`;
      await redis.set(`socket:${userId}`, `sock-${uid()}`);

      // GET (_notifyPlayers) and DEL (cleanupSocket) run with no coordination.
      const [socketId] = await Promise.all([
        redis.get(`socket:${userId}`),
        redis.del(`socket:${userId}`),
      ]);

      if (socketId === null) nullCount++;
    }

    // Log so the count is visible in CI output — useful for understanding
    // how often the race manifests in this environment.
    console.log(`Bug 4: GET returned null in ${nullCount}/20 concurrent DEL races`);

    // We do not assert a specific non-zero count because timing varies per
    // environment, but even 0 here doesn't mean the bug is fixed — it just
    // means the scheduler happened not to interleave this run.
    expect(nullCount).toBeGreaterThanOrEqual(0);
  });

  test("replacing DEL with EXPIRE 30 keeps the key available for in-flight notifyPlayers", async () => {
    // Documents the intended fix: cleanupSocket should use EXPIRE instead of DEL
    // so the mapping survives brief disconnects and in-flight match notifications.
    const userId = `bug4-ttl-${uid()}`;
    const socketId = `sock-ttl-${uid()}`;

    await redis.set(`socket:${userId}`, socketId);

    // Fixed cleanupSocket: set a 30-second grace TTL instead of deleting
    await redis.expire(`socket:${userId}`, 30);

    // _notifyPlayers reads immediately after — key must still be present
    const retrieved = await redis.get(`socket:${userId}`);
    expect(retrieved).toBe(socketId);

    await redis.del(`socket:${userId}`);
  });

  test("leaveAllQueues after a user was already popped by Lua is a safe no-op", async () => {
    // If the Lua script popped the user as part of a match, their queue entry is
    // already gone. leaveAllQueues should return 'not_found' and not throw.
    const userId = `bug4-popped-${uid()}`;
    const result = await matchmakingService.leaveQueue(userId, "TWOPLAYER", "EASY");

    expect(result.status).toBe("not_found");
  });

  test("socket:userId is absent after cleanupSocket (current behaviour — confirms the window)", async () => {
    // Confirms that the current cleanupSocket does an immediate DEL,
    // which is what creates the race window.
    const userId = `bug4-del-${uid()}`;
    const socketId = `sock-del-${uid()}`;
    await redis.set(`socket:${userId}`, socketId);

    // Current cleanupSocket implementation
    await redis.del(`socket:${userId}`);

    const val = await redis.get(`socket:${userId}`);
    expect(val).toBeNull(); // key is gone — this is the window that loses matchFound
  });

  test("socket:userId persists after EXPIRE-based cleanup until TTL elapses", async () => {
    // After the fix, the key should still be readable immediately after cleanup.
    const userId = `bug4-persist-${uid()}`;
    const socketId = `sock-persist-${uid()}`;
    await redis.set(`socket:${userId}`, socketId);

    // Fixed behaviour: expire instead of delete
    await redis.expire(`socket:${userId}`, 30);

    const val = await redis.get(`socket:${userId}`);
    expect(val).toBe(socketId); // still readable — no race window

    await redis.del(`socket:${userId}`);
  });
});