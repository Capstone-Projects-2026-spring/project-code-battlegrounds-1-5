const { getPrisma } = require('../prisma/index');

const PARTY_INVITE_KEY = (toUserId) => `party:invite:${toUserId}`;
const PARTY_INVITE_TTL = 60; // seconds

function createInviteService(stateRedis) {

    return {

        // ─── Party ────────────────────────────────────────────────────────────

        async sendPartyInvite(fromUserId, toUserId) {
            const prisma = getPrisma();

            const party = await prisma.party.findFirst({
                where: { ownerId: fromUserId },
                include: { member: true },
            });

            if (!party) return { error: 'party_not_found' };
            if (party.member) return { error: 'party_full' };

            const [fromUser, toUser] = await Promise.all([
                prisma.user.findUnique({ where: { id: fromUserId } }),
                prisma.user.findUnique({ where: { id: toUserId } }),
            ]);

            if (!toUser) return { error: 'user_not_found' };

            const invite = {
                fromUserId,
                fromDisplayName: fromUser.name,
                fromAvatarUrl: fromUser.image ?? null,
                partyOwnerId: fromUserId,
                sentAt: new Date().toISOString(),
            };

            await stateRedis.set(
                PARTY_INVITE_KEY(toUserId),
                JSON.stringify(invite),
                'EX',
                PARTY_INVITE_TTL
            );

            // Return invite so the socket handler emits partyInviteReceived
            return { status: 'sent', invite };
        },

        async acceptPartyInvite(userId) {
            const prisma = getPrisma();

            const raw = await stateRedis.get(PARTY_INVITE_KEY(userId));
            if (!raw) return { error: 'invite_not_found' };

            const invite = JSON.parse(raw);

            const party = await prisma.party.findFirst({
                where: { ownerId: invite.partyOwnerId },
                include: { member: true, owner: true },
            });

            if (!party) return { error: 'party_not_found' };
            if (party.member) return { error: 'party_full' };

            const partyMember = await prisma.partyMember.create({
                data: { partyId: party.id, userId },
                include: { user: true },
            });

            await stateRedis.del(PARTY_INVITE_KEY(userId));

            const member = {
                userId: partyMember.user.id,
                username: partyMember.user.name,
                displayName: partyMember.user.name,
                avatarUrl: partyMember.user.image ?? null,
                joinedAt: partyMember.joinedAt.toISOString(),
            };

            const owner = {
                userId: party.owner.id,
                username: party.owner.name,
                displayName: party.owner.name,
                avatarUrl: party.owner.image ?? null,
                joinedAt: party.createdAt.toISOString(),
            };

            // Return member + partyOwner so the socket handler can emit
            // partyJoined to the accepter and partyMemberJoined to the owner
            return { status: 'joined', member, partyOwner: owner };
        },

        async declinePartyInvite(userId) {
            const raw = await stateRedis.get(PARTY_INVITE_KEY(userId));
            if (!raw) return { error: 'invite_not_found' };

            const invite = JSON.parse(raw);
            await stateRedis.del(PARTY_INVITE_KEY(userId));

            return { status: 'declined', partyOwnerId: invite.partyOwnerId };
        },

        async kickPartyMember(ownerId) {
            const prisma = getPrisma();

            const party = await prisma.party.findFirst({
                where: { ownerId },
                include: { member: true },
            });

            if (!party) return { error: 'party_not_found' };
            if (!party.member) return { error: 'no_member' };

            const kickedUserId = party.member.userId;

            await prisma.partyMember.delete({ where: { partyId: party.id } });

            // Return kickedUserId so the socket handler can emit partyMemberLeft
            return { status: 'kicked', kickedUserId };
        },

        async leaveParty(userId) {
            const prisma = getPrisma();

            const partyMember = await prisma.partyMember.findUnique({
                where: { userId },
                include: { party: true },
            });

            if (!partyMember) return { error: 'not_in_party' };

            const party = partyMember.party;

            
            // If member leaves, just remove them from the party
            await prisma.partyMember.delete({ where: { userId } });
            return { status: 'left', ownerId: party.ownerId };
            
        },

        async joinPartyByCode(userId, code) {
            const prisma = getPrisma();

            const party = await prisma.party.findUnique({
                where: { id: code },
                include: { member: true, owner: true },
            });

            if (!party) return { error: 'invalid_code' };
            if (party.owner.id === userId) return { error: 'own_party' };
            if (party.member) return { error: 'party_full' };

            const partyMember = await prisma.partyMember.create({
                data: { partyId: party.id, userId },
                include: { user: true },
            });

            const member = {
                userId: partyMember.user.id,
                username: partyMember.user.name,
                displayName: partyMember.user.name,
                avatarUrl: partyMember.user.image ?? null,
                joinedAt: partyMember.joinedAt.toISOString(),
            };

            const owner = {
                userId: party.owner.id,
                username: party.owner.name,
                displayName: party.owner.name,
                avatarUrl: party.owner.image ?? null,
                joinedAt: party.createdAt.toISOString(),
            };
            

            // Return member + partyOwnerId so the socket handler can emit
            // partyJoined to the joiner and partyMemberJoined to the owner
            return { status: 'joined', member, partyOwner: owner };
        },

        // ─── Friends ──────────────────────────────────────────────────────────

        async sendFriendRequest(fromUserId, friendCode) {
            const prisma = getPrisma();

            const target = await prisma.user.findUnique({
                where: { friendCode },
            });

            if (!target) return { error: 'user_not_found' };
            if (target.id === fromUserId) return { error: 'cannot_add_self' };

            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: fromUserId, addresseeId: target.id },
                        { requesterId: target.id, addresseeId: fromUserId },
                    ],
                },
            });

            if (existing?.status === 'ACCEPTED') return { error: 'already_friends' };
            if (existing?.status === 'PENDING') return { error: 'request_already_sent' };

            const fromUser = await prisma.user.findUnique({ where: { id: fromUserId } });

            const friendship = await prisma.friendship.create({
                data: {
                    requesterId: fromUserId,
                    addresseeId: target.id,
                    status: 'PENDING',
                },
            });

            // Outgoing shape returned to sender via friendRequestSent
            const outgoingRequest = {
                id: friendship.id,
                userId: target.id,
                username: target.name,
                displayName: target.name,
                avatarUrl: target.image ?? null,
                direction: 'outgoing',
                createdAt: friendship.createdAt.toISOString(),
            };

            // Incoming shape forwarded to addressee via friendRequestReceived
            const incomingRequest = {
                id: friendship.id,
                userId: fromUserId,
                username: fromUser.name,
                displayName: fromUser.name,
                avatarUrl: fromUser.image ?? null,
                direction: 'incoming',
                createdAt: friendship.createdAt.toISOString(),
            };

            // Return addresseeId so the socket handler knows who to notify
            return {
                status: 'sent',
                request: outgoingRequest,
                incomingRequest,
                addresseeId: target.id,
            };
        },

        async acceptFriendRequest(userId, requestId) {
            const prisma = getPrisma();

            const friendship = await prisma.friendship.findUnique({
                where: { id: requestId },
                include: {
                    requester: { select: { id: true, name: true, image: true } },
                    addressee: { select: { id: true, name: true, image: true } },
                },
            });

            if (!friendship) return { error: 'request_not_found' };
            if (friendship.addresseeId !== userId) return { error: 'unauthorized' };
            if (friendship.status !== 'PENDING') return { error: 'not_pending' };

            await prisma.friendship.update({
                where: { id: requestId },
                data: { status: 'ACCEPTED' },
            });

            // Full Friend shape for the accepter (the requester is now their friend)
            const friendForAccepter = {
                id: friendship.requester.id,
                username: friendship.requester.name,
                displayName: friendship.requester.name,
                avatarUrl: friendship.requester.image ?? null,
                status: 'offline',
            };

            // Full Friend shape for the requester (the accepter is now their friend)
            const friendForRequester = {
                id: friendship.addressee.id,
                username: friendship.addressee.name,
                displayName: friendship.addressee.name,
                avatarUrl: friendship.addressee.image ?? null,
                status: 'offline',
            };

            // Return both shapes + requesterId so the socket handler can emit to both
            return {
                status: 'accepted',
                friend: friendForAccepter,
                requesterFriend: friendForRequester,
                requesterId: friendship.requesterId,
            };
        },

        async declineFriendRequest(userId, requestId) {
            const prisma = getPrisma();

            const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });

            if (!friendship) return { error: 'request_not_found' };
            if (friendship.addresseeId !== userId) return { error: 'unauthorized' };
            if (friendship.status !== 'PENDING') return { error: 'not_pending' };

            await prisma.friendship.update({
                where: { id: requestId },
                data: { status: 'DECLINED' },
            });

            // Return requesterId so the socket handler can notify them
            return { status: 'declined', requesterId: friendship.requesterId };
        },
    };
}

module.exports = { createInviteService };