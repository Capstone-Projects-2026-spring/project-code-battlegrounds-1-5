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

let prisma;
let redis;
let gameService;
let alice, bob, charlie, diana, erik;
// Each user's pre-existing party (created on signup)
let aliceParty, bobParty;

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

  [alice, bob, charlie, diana, erik] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { email: "alice@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "bob@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "charlie@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "diana@test.com" } }),
    prisma.user.findUniqueOrThrow({ where: { email: "erik@test.com" } }),
  ]);

  // Fetch the parties that were created on signup — never create new ones
  [aliceParty, bobParty] = await Promise.all([
    prisma.party.findUniqueOrThrow({ where: { ownerId: alice.id } }),
    prisma.party.findUniqueOrThrow({ where: { ownerId: bob.id } }),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function register(client, userId) {
  client.emit("register", { userId });
  await new Promise((r) => setTimeout(r, 100));
}

// Cleans up any member that was added to a party during a test
async function clearPartyMember(partyId) {
  await prisma.partyMember.deleteMany({ where: { partyId } }).catch(() => {});
}

// Cleans up any partyMember row where the user is a guest (not owner)
async function clearUserFromParty(userId) {
  await prisma.partyMember.deleteMany({ where: { userId } }).catch(() => {});
}

async function deleteFriendship(userIdA, userIdB) {
  await prisma.friendship.deleteMany({
    where: {
      OR: [
        { requesterId: userIdA, addresseeId: userIdB },
        { requesterId: userIdB, addresseeId: userIdA },
      ],
    },
  });
}

async function seedPartyInvite(toUserId, fromUserId, fromUser) {
  const invite = {
    fromUserId,
    fromDisplayName: fromUser.name,
    fromAvatarUrl: fromUser.image ?? null,
    partyOwnerId: fromUserId,
    sentAt: new Date().toISOString(),
  };
  await redis.set(
    `party:invite:${toUserId}`,
    JSON.stringify(invite),
    "EX",
    60
  );
  return invite;
}

// ---------------------------------------------------------------------------
// partyInvite
// ---------------------------------------------------------------------------
describe("partyInvite", () => {
  // alice invites bob — cleanup bob's invite key and any member added to alice's party
  afterEach(async () => {
    await clearPartyMember(aliceParty.id);
    await redis.del(`party:invite:${bob.id}`);
  });

  test("does nothing when socket.userId is not set", async () => {
    const client = makeClient();
    await connectClient(client);
    // intentionally skip register — socket.userId stays unset

    let errored = false;
    client.on("error", () => { errored = true; });

    client.emit("partyInvite", { toUserId: bob.id });
    await new Promise((r) => setTimeout(r, 150));

    expect(errored).toBe(false);

    client.disconnect();
  });

  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyInvite", {}); // missing toUserId

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for partyInvite.");

    client.disconnect();
  });

  test("delivers partyInviteReceived to the invitee's socket", async () => {
    const sender  = makeClient();
    const invitee = makeClient();
    await connectAll(sender, invitee);

    await register(sender,  alice.id);
    await register(invitee, bob.id);

    const invitePromise = waitFor(invitee, "partyInviteReceived");
    sender.emit("partyInvite", { toUserId: bob.id });

    const invite = await invitePromise;
    expect(invite.fromUserId).toBe(alice.id);
    expect(invite.partyOwnerId).toBe(alice.id);

    disconnectAll(sender, invitee);
  });

  test("stores invite in Redis with correct key and shape", async () => {
    const sender = makeClient();
    await connectClient(sender);
    await register(sender, alice.id);

    sender.emit("partyInvite", { toUserId: bob.id });
    await new Promise((r) => setTimeout(r, 150));

    const raw = await redis.get(`party:invite:${bob.id}`);
    expect(raw).not.toBeNull();
    const stored = JSON.parse(raw);
    expect(stored.fromUserId).toBe(alice.id);
    expect(stored.partyOwnerId).toBe(alice.id);

    sender.disconnect();
  });

  test("emits error when party is already full", async () => {
    // Fill alice's party with charlie before the invite
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: charlie.id },
    });

    const sender = makeClient();
    await connectClient(sender);
    await register(sender, alice.id);

    const errPromise = waitFor(sender, "error");
    sender.emit("partyInvite", { toUserId: bob.id });

    const err = await errPromise;
    expect(err.message).toBe("party_full");

    sender.disconnect();
  });
});

// ---------------------------------------------------------------------------
// partyInviteAccept
// ---------------------------------------------------------------------------
describe("partyInviteAccept", () => {
  afterEach(async () => {
    await clearPartyMember(aliceParty.id);
    await redis.del(`party:invite:${bob.id}`);
  });

  test("emits partyJoined to accepter and partyMemberJoined to owner", async () => {
    await seedPartyInvite(bob.id, alice.id, alice);

    const owner  = makeClient();
    const member = makeClient();
    await connectAll(owner, member);

    await register(owner,  alice.id);
    await register(member, bob.id);

    const joinedPromise       = waitFor(member, "partyJoined");
    const memberJoinedPromise = waitFor(owner,  "partyMemberJoined");

    member.emit("partyInviteAccept");

    const [partyOwner, newMember] = await Promise.all([joinedPromise, memberJoinedPromise]);
    expect(partyOwner.userId).toBe(alice.id);
    expect(newMember.userId).toBe(bob.id);

    disconnectAll(owner, member);
  });

  test("creates a partyMember row in the database", async () => {
    await seedPartyInvite(bob.id, alice.id, alice);

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("partyInviteAccept");
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.partyMember.findUnique({ where: { userId: bob.id } });
    expect(row).not.toBeNull();
    expect(row.partyId).toBe(aliceParty.id);

    client.disconnect();
  });

  test("deletes the Redis invite key after accepting", async () => {
    await seedPartyInvite(bob.id, alice.id, alice);

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("partyInviteAccept");
    await new Promise((r) => setTimeout(r, 200));

    const raw = await redis.get(`party:invite:${bob.id}`);
    expect(raw).toBeNull();

    client.disconnect();
  });

  test("emits error when no invite exists in Redis", async () => {
    await redis.del(`party:invite:${bob.id}`);

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyInviteAccept");

    const err = await errPromise;
    expect(err.message).toBe("invite_not_found");

    client.disconnect();
  });

  test("emits error when party is already full at accept time", async () => {
    await seedPartyInvite(bob.id, alice.id, alice);

    // Fill alice's party after the invite was sent
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: charlie.id },
    });

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyInviteAccept");

    const err = await errPromise;
    expect(err.message).toBe("party_full");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// partyInviteDecline
// ---------------------------------------------------------------------------
describe("partyInviteDecline", () => {
  afterEach(async () => {
    await redis.del(`party:invite:${bob.id}`);
  });

  test("removes the invite from Redis", async () => {
    await seedPartyInvite(bob.id, alice.id, alice);

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("partyInviteDecline");
    await new Promise((r) => setTimeout(r, 150));

    const raw = await redis.get(`party:invite:${bob.id}`);
    expect(raw).toBeNull();

    client.disconnect();
  });

  test("emits error when no invite exists", async () => {
    await redis.del(`party:invite:${bob.id}`);

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyInviteDecline");

    const err = await errPromise;
    expect(err.message).toBe("invite_not_found");

    client.disconnect();
  });

  test("does nothing when socket.userId is not set", async () => {
    const client = makeClient();
    await connectClient(client);

    let errored = false;
    client.on("error", () => { errored = true; });

    client.emit("partyInviteDecline");
    await new Promise((r) => setTimeout(r, 150));

    expect(errored).toBe(false);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// partyKick
// ---------------------------------------------------------------------------
describe("partyKick", () => {
  // Each test that needs a member adds bob — clean up after
  afterEach(async () => {
    await clearPartyMember(aliceParty.id);
  });

  test("emits joinedPartyLeft to the kicked user's socket", async () => {
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: bob.id },
    });

    const owner  = makeClient();
    const member = makeClient();
    await connectAll(owner, member);

    await register(owner,  alice.id);
    await register(member, bob.id);

    const kickedPromise = waitFor(member, "joinedPartyLeft");
    owner.emit("partyKick");

    await kickedPromise;

    disconnectAll(owner, member);
  });

  test("removes the partyMember row from the database", async () => {
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: bob.id },
    });

    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    client.emit("partyKick");
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.partyMember.findUnique({ where: { userId: bob.id } });
    expect(row).toBeNull();

    client.disconnect();
  });

  test("emits error when party has no member to kick", async () => {
    // Don't add a member — alice's party is empty
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyKick");

    const err = await errPromise;
    expect(err.message).toBe("no_member");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// partyJoinByCode
// ---------------------------------------------------------------------------
describe("partyJoinByCode", () => {
  afterEach(async () => {
    await clearPartyMember(aliceParty.id);
  });

  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyJoinByCode", {}); // missing code

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for partyJoinByCode.");

    client.disconnect();
  });

  test("emits partyJoined to joiner and partyMemberJoined to owner", async () => {
    const owner  = makeClient();
    const joiner = makeClient();
    await connectAll(owner, joiner);

    await register(owner,  alice.id);
    await register(joiner, bob.id);

    const joinedPromise       = waitFor(joiner, "partyJoined");
    const memberJoinedPromise = waitFor(owner,  "partyMemberJoined");

    joiner.emit("partyJoinByCode", { code: aliceParty.id });

    const [partyOwner, newMember] = await Promise.all([joinedPromise, memberJoinedPromise]);
    expect(partyOwner.userId).toBe(alice.id);
    expect(newMember.userId).toBe(bob.id);

    disconnectAll(owner, joiner);
  });

  test("creates a partyMember row in the database", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("partyJoinByCode", { code: aliceParty.id });
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.partyMember.findUnique({ where: { userId: bob.id } });
    expect(row).not.toBeNull();
    expect(row.partyId).toBe(aliceParty.id);

    client.disconnect();
  });

  test("emits error when code does not match any party", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyJoinByCode", { code: "invalid-code" });

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for partyJoinByCode.");

    client.disconnect();
  });

  test("emits error when user tries to join their own party", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyJoinByCode", { code: aliceParty.id });

    const err = await errPromise;
    expect(err.message).toBe("own_party");

    client.disconnect();
  });

  test("emits error when party is already full", async () => {
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: charlie.id },
    });

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyJoinByCode", { code: aliceParty.id });

    const err = await errPromise;
    expect(err.message).toBe("party_full");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// partyLeave
// ---------------------------------------------------------------------------
describe("partyLeave", () => {
  afterEach(async () => {
    await clearPartyMember(aliceParty.id);
  });

  test("emits partyMemberLeft to the owner's socket", async () => {
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: bob.id },
    });

    const owner  = makeClient();
    const member = makeClient();
    await connectAll(owner, member);

    await register(owner,  alice.id);
    await register(member, bob.id);

    const leftPromise = waitFor(owner, "partyMemberLeft");
    member.emit("partyLeave");

    await leftPromise;

    disconnectAll(owner, member);
  });

  test("removes the partyMember row from the database", async () => {
    await prisma.partyMember.create({
      data: { partyId: aliceParty.id, userId: bob.id },
    });

    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("partyLeave");
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.partyMember.findUnique({ where: { userId: bob.id } });
    expect(row).toBeNull();

    client.disconnect();
  });

  test("emits error when user is not a member of any party", async () => {
    // erik is never added as a member anywhere
    const client = makeClient();
    await connectClient(client);
    await register(client, erik.id);

    const errPromise = waitFor(client, "error");
    client.emit("partyLeave");

    const err = await errPromise;
    expect(err.message).toBe("not_in_party");

    client.disconnect();
  });

  test("does nothing when socket.userId is not set", async () => {
    const client = makeClient();
    await connectClient(client);

    let errored = false;
    client.on("error", () => { errored = true; });

    client.emit("partyLeave");
    await new Promise((r) => setTimeout(r, 150));

    expect(errored).toBe(false);

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// friendRequest
// ---------------------------------------------------------------------------
describe("friendRequest", () => {
  afterEach(async () => {
    await deleteFriendship(alice.id, charlie.id);
  });

  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequest", {}); // missing friendCode

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for friendRequest.");

    client.disconnect();
  });

  test("emits friendRequestSent to sender and friendRequestReceived to addressee", async () => {
    const sender   = makeClient();
    const receiver = makeClient();
    await connectAll(sender, receiver);

    await register(sender,   alice.id);
    await register(receiver, charlie.id);

    const sentPromise     = waitFor(sender,   "friendRequestSent");
    const receivedPromise = waitFor(receiver, "friendRequestReceived");

    sender.emit("friendRequest", { friendCode: charlie.friendCode });

    const [sent, received] = await Promise.all([sentPromise, receivedPromise]);
    expect(sent.userId).toBe(charlie.id);
    expect(sent.direction).toBe("outgoing");
    expect(received.userId).toBe(alice.id);
    expect(received.direction).toBe("incoming");

    disconnectAll(sender, receiver);
  });

  test("creates a PENDING friendship row in the database", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    client.emit("friendRequest", { friendCode: charlie.friendCode });
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.friendship.findFirst({
      where: { requesterId: alice.id, addresseeId: charlie.id },
    });
    expect(row).not.toBeNull();
    expect(row.status).toBe("PENDING");

    client.disconnect();
  });

  test("emits error when friendCode does not match any user", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    // Use a short string that passes schema validation (max 20 chars) but won't match any user
    client.emit("friendRequest", { friendCode: "no-such-user" });

    const err = await errPromise;
    expect(err.message).toBe("user_not_found");

    client.disconnect();
  });

  test("emits error when user tries to add themselves", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequest", { friendCode: alice.friendCode });

    const err = await errPromise;
    expect(err.message).toBe("cannot_add_self");

    client.disconnect();
  });

  test("emits error when a pending request already exists", async () => {
    await prisma.friendship.create({
      data: { requesterId: alice.id, addresseeId: charlie.id, status: "PENDING" },
    });

    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequest", { friendCode: charlie.friendCode });

    const err = await errPromise;
    expect(err.message).toBe("request_already_sent");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// friendRequestAccept
// ---------------------------------------------------------------------------
describe("friendRequestAccept", () => {
  let friendship;

  beforeEach(async () => {
    friendship = await prisma.friendship.create({
      data: { requesterId: alice.id, addresseeId: bob.id, status: "PENDING" },
    });
  });

  afterEach(async () => {
    await deleteFriendship(alice.id, bob.id);
  });

  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequestAccept", {}); // missing requestId

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for friendRequestAccept.");

    client.disconnect();
  });

  test("emits friendRequestAccepted to both users", async () => {
    const requester = makeClient();
    const accepter  = makeClient();
    await connectAll(requester, accepter);

    await register(requester, alice.id);
    await register(accepter,  bob.id);

    const requesterPromise = waitFor(requester, "friendRequestAccepted");
    const accepterPromise  = waitFor(accepter,  "friendRequestAccepted");

    accepter.emit("friendRequestAccept", { requestId: friendship.id });

    const [forRequester, forAccepter] = await Promise.all([requesterPromise, accepterPromise]);
    expect(forRequester.id).toBe(bob.id);
    expect(forAccepter.id).toBe(alice.id);

    disconnectAll(requester, accepter);
  });

  test("updates friendship status to ACCEPTED in the database", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("friendRequestAccept", { requestId: friendship.id });
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.friendship.findUnique({ where: { id: friendship.id } });
    expect(row.status).toBe("ACCEPTED");

    client.disconnect();
  });

  test("emits error when request does not exist", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequestAccept", { requestId: "nonexistent-id" });

    const err = await errPromise;
    expect(err.message).toBe("request_not_found");

    client.disconnect();
  });

  test("emits error when user is not the addressee", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, charlie.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequestAccept", { requestId: friendship.id });

    const err = await errPromise;
    expect(err.message).toBe("unauthorized");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// friendRequestDecline
// ---------------------------------------------------------------------------
describe("friendRequestDecline", () => {
  let friendship;

  beforeEach(async () => {
    friendship = await prisma.friendship.create({
      data: { requesterId: alice.id, addresseeId: bob.id, status: "PENDING" },
    });
  });

  afterEach(async () => {
    await deleteFriendship(alice.id, bob.id);
  });

  test("emits error on invalid payload", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequestDecline", {});

    const err = await errPromise;
    expect(err.message).toBe("Invalid payload for friendRequestDecline.");

    client.disconnect();
  });

  test("notifies the requester their request was declined", async () => {
    const requester = makeClient();
    const decliner  = makeClient();
    await connectAll(requester, decliner);

    await register(requester, alice.id);
    await register(decliner,  bob.id);

    const declinedPromise = waitFor(requester, "friendRequestDeclined");
    decliner.emit("friendRequestDecline", { requestId: friendship.id });

    const payload = await declinedPromise;
    expect(payload.requestId).toBe(friendship.id);

    disconnectAll(requester, decliner);
  });

  test("updates friendship status to DECLINED in the database", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, bob.id);

    client.emit("friendRequestDecline", { requestId: friendship.id });
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.friendship.findUnique({ where: { id: friendship.id } });
    expect(row.status).toBe("DECLINED");

    client.disconnect();
  });

  test("emits error when user is not the addressee", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, charlie.id);

    const errPromise = waitFor(client, "error");
    client.emit("friendRequestDecline", { requestId: friendship.id });

    const err = await errPromise;
    expect(err.message).toBe("unauthorized");

    client.disconnect();
  });
});

// ---------------------------------------------------------------------------
// friendDelete
// ---------------------------------------------------------------------------
describe("friendDelete", () => {
  let friendship;

  beforeEach(async () => {
    friendship = await prisma.friendship.create({
      data: { requesterId: alice.id, addresseeId: bob.id, status: "ACCEPTED" },
    });
  });

  afterEach(async () => {
    await deleteFriendship(alice.id, bob.id);
  });

  test("emits friendDeleted to the ex-friend's socket", async () => {
    const deleter  = makeClient();
    const exFriend = makeClient();
    await connectAll(deleter, exFriend);

    await register(deleter,  alice.id);
    await register(exFriend, bob.id);

    const deletedPromise = waitFor(exFriend, "friendDeleted");
    deleter.emit("friendDelete", {
      exFriendId: bob.id,
      friendId: friendship.id,
    });

    const payload = await deletedPromise;
    expect(payload.friendId).toBe(friendship.id);

    disconnectAll(deleter, exFriend);
  });

  test("removes the friendship row from the database", async () => {
    const client = makeClient();
    await connectClient(client);
    await register(client, alice.id);

    client.emit("friendDelete", {
      exFriendId: bob.id,
      friendId: friendship.id,
    });
    await new Promise((r) => setTimeout(r, 200));

    const row = await prisma.friendship.findUnique({ where: { id: friendship.id } });
    expect(row).toBeNull();

    client.disconnect();
  });
});