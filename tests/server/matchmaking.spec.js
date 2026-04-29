const { beforeAll, afterAll, describe, test, expect } = require("bun:test");
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
  warmVm: () => {},
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
  const ioStub = { to: () => ({ emit: () => {} }) };
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

  test("emits queueStatus 'already_queued' if same user joins twice", async () => {
    const userId = `user-dupe-${uid()}`;
    const client = makeClient();
    await connectClient(client);

    // FOURPLAYER so the first join never triggers a match
    client.emit("joinQueue", { userId, gameType: "FOURPLAYER", difficulty: "HARD" });
    await new Promise((r) => setTimeout(r, 150));

    const statusPromise = waitFor(client, "queueStatus");
    client.emit("joinQueue", { userId, gameType: "FOURPLAYER", difficulty: "HARD" });

    const status = await statusPromise;
    expect(status.status).toBe("already_queued");

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

  // matchFound and valid-party socket tests are covered at the service level below.
  // They require mock.module to intercept the server's Prisma instance, which is
  // not possible once the server process has already booted.
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

  test("returns 'already_queued' when same userId joins twice", async () => {
    const gameType = "TWOPLAYER";
    const difficulty = "EASY";
    const userId = `dupe-svc-${uid()}`;
    await drainQueue(gameType, difficulty);

    await matchmakingService.joinQueue(userId, gameType, difficulty);
    const result = await matchmakingService.joinQueue(userId, gameType, difficulty);

    expect(result.status).toBe("already_queued");

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
      ["TWOPLAYER",  "EASY"],
      ["TWOPLAYER",  "HARD"],
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