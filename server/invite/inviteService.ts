import { FriendshipStatus } from '@prisma/client';
import type { Redis } from 'ioredis';
import { getPrisma } from '../prisma';

const PARTY_INVITE_TTL_SECONDS = 60;
const PARTY_INVITE_KEY = (toUserId: string): string => `party:invite:${toUserId}`;

interface PartyInvitePayload {
    fromUserId: string;
    fromDisplayName: string;
    fromAvatarUrl: string | null;
    partyOwnerId: string;
    sentAt: string;
}

interface PartyParticipant {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    joinedAt: string;
}

interface FriendPreview {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    status: 'online';
}

interface FriendRequestPayload {
    id: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    direction: 'incoming' | 'outgoing';
    createdAt: string;
}

function parseJson<T>(value: string): T {
    return JSON.parse(value) as T;
}

function formatName(name: string): string {
    return name;
}

export function createInviteService(stateRedis: Redis) {
    const prisma = getPrisma();

    return {
        // PARTY
        async sendPartyInvite(
            fromUserId: string,
            toUserId: string
        ): Promise<
            | { error: 'party_not_found' | 'party_full' | 'user_not_found' }
            | { status: 'sent'; invite: PartyInvitePayload }
        > {
            const party = await prisma.party.findFirst({
                where: { ownerId: fromUserId },
                include: { member: true },
            });

            if (!party) {
                return { error: 'party_not_found' };
            }
            if (party.member) {
                return { error: 'party_full' };
            }

            const [fromUser, toUser] = await Promise.all([
                prisma.user.findUnique({ where: { id: fromUserId } }),
                prisma.user.findUnique({ where: { id: toUserId } }),
            ]);

            if (!fromUser || !toUser) {
                return { error: 'user_not_found' };
            }

            const invite: PartyInvitePayload = {
                fromUserId,
                fromDisplayName: formatName(fromUser.name),
                fromAvatarUrl: fromUser.image ?? null,
                partyOwnerId: fromUserId,
                sentAt: new Date().toISOString(),
            };

            await stateRedis.set(
                PARTY_INVITE_KEY(toUserId),
                JSON.stringify(invite),
                'EX',
                PARTY_INVITE_TTL_SECONDS
            );

            return { status: 'sent', invite };
        },

        async acceptPartyInvite(
            userId: string
        ): Promise<
            | { error: 'invite_not_found' | 'party_not_found' | 'party_full' }
            | { status: 'joined'; member: PartyParticipant; partyOwner: PartyParticipant }
        > {
            const raw = await stateRedis.get(PARTY_INVITE_KEY(userId));
            if (!raw) {
                return { error: 'invite_not_found' };
            }

            const invite = parseJson<PartyInvitePayload>(raw);

            const party = await prisma.party.findFirst({
                where: { ownerId: invite.partyOwnerId },
                include: { member: true, owner: true },
            });

            if (!party) {
                return { error: 'party_not_found' };
            }
            if (party.member) {
                return { error: 'party_full' };
            }

            const partyMember = await prisma.partyMember.create({
                data: { partyId: party.id, userId },
                include: { user: true },
            });

            await stateRedis.del(PARTY_INVITE_KEY(userId));

            const member: PartyParticipant = {
                userId: partyMember.user.id,
                username: formatName(partyMember.user.name),
                displayName: formatName(partyMember.user.name),
                avatarUrl: partyMember.user.image ?? null,
                joinedAt: partyMember.joinedAt.toISOString(),
            };

            const owner: PartyParticipant = {
                userId: party.owner.id,
                username: formatName(party.owner.name),
                displayName: formatName(party.owner.name),
                avatarUrl: party.owner.image ?? null,
                joinedAt: party.createdAt.toISOString(),
            };

            return { status: 'joined', member, partyOwner: owner };
        },

        async declinePartyInvite(
            userId: string
        ): Promise<{ error: 'invite_not_found' } | { status: 'declined'; partyOwnerId: string }> {
            const raw = await stateRedis.get(PARTY_INVITE_KEY(userId));
            if (!raw) {
                return { error: 'invite_not_found' };
            }

            const invite = parseJson<PartyInvitePayload>(raw);
            await stateRedis.del(PARTY_INVITE_KEY(userId));

            return { status: 'declined', partyOwnerId: invite.partyOwnerId };
        },

        async kickPartyMember(
            ownerId: string
        ): Promise<{ error: 'party_not_found' | 'no_member' } | { status: 'kicked'; kickedUserId: string }> {
            const party = await prisma.party.findFirst({
                where: { ownerId },
                include: { member: true },
            });

            if (!party) {
                return { error: 'party_not_found' };
            }
            if (!party.member) {
                return { error: 'no_member' };
            }

            const kickedUserId = party.member.userId;
            await prisma.partyMember.delete({ where: { partyId: party.id } });

            return { status: 'kicked', kickedUserId };
        },

        async leaveParty(userId: string): Promise<{ error: 'not_in_party' } | { status: 'left'; ownerId: string }> {
            const partyMember = await prisma.partyMember.findUnique({
                where: { userId },
                include: { party: true },
            });

            if (!partyMember) {
                return { error: 'not_in_party' };
            }

            await prisma.partyMember.delete({ where: { userId } });
            return { status: 'left', ownerId: partyMember.party.ownerId };
        },

        async joinPartyByCode(
            userId: string,
            code: string
        ): Promise<
            | { error: 'invalid_code' | 'own_party' | 'party_full' }
            | { status: 'joined'; member: PartyParticipant; partyOwner: PartyParticipant }
        > {
            const party = await prisma.party.findUnique({
                where: { id: code },
                include: { member: true, owner: true },
            });

            if (!party) {
                return { error: 'invalid_code' };
            }
            if (party.owner.id === userId) {
                return { error: 'own_party' };
            }
            if (party.member) {
                return { error: 'party_full' };
            }

            const partyMember = await prisma.partyMember.create({
                data: { partyId: party.id, userId },
                include: { user: true },
            });

            const member: PartyParticipant = {
                userId: partyMember.user.id,
                username: formatName(partyMember.user.name),
                displayName: formatName(partyMember.user.name),
                avatarUrl: partyMember.user.image ?? null,
                joinedAt: partyMember.joinedAt.toISOString(),
            };

            const owner: PartyParticipant = {
                userId: party.owner.id,
                username: formatName(party.owner.name),
                displayName: formatName(party.owner.name),
                avatarUrl: party.owner.image ?? null,
                joinedAt: party.createdAt.toISOString(),
            };

            return { status: 'joined', member, partyOwner: owner };
        },

        // FRIENDS
        async sendFriendRequest(
            fromUserId: string,
            friendCode: string
        ): Promise<
            | { error: 'user_not_found' | 'cannot_add_self' | 'already_friends' | 'request_already_sent' }
            | {
                    status: 'sent';
                    request: FriendRequestPayload;
                    incomingRequest: FriendRequestPayload;
                    addresseeId: string;
                }
        > {
            const target = await prisma.user.findUnique({
                where: { friendCode },
            });

            if (!target) {
                return { error: 'user_not_found' };
            }
            if (target.id === fromUserId) {
                return { error: 'cannot_add_self' };
            }

            const existing = await prisma.friendship.findFirst({
                where: {
                    OR: [
                        { requesterId: fromUserId, addresseeId: target.id },
                        { requesterId: target.id, addresseeId: fromUserId },
                    ],
                },
            });

            if (existing?.status === FriendshipStatus.ACCEPTED) {
                return { error: 'already_friends' };
            }
            if (existing?.status === FriendshipStatus.PENDING) {
                return { error: 'request_already_sent' };
            }
            if (existing?.status === FriendshipStatus.DECLINED) {
                await prisma.friendship.delete({ where: { id: existing.id } });
            }

            const fromUser = await prisma.user.findUnique({ where: { id: fromUserId } });
            if (!fromUser) {
                return { error: 'user_not_found' };
            }

            const friendship = await prisma.friendship.create({
                data: {
                    requesterId: fromUserId,
                    addresseeId: target.id,
                    status: FriendshipStatus.PENDING,
                },
            });

            const outgoingRequest: FriendRequestPayload = {
                id: friendship.id,
                userId: target.id,
                username: formatName(target.name),
                displayName: formatName(target.name),
                avatarUrl: target.image ?? null,
                direction: 'outgoing',
                createdAt: friendship.createdAt.toISOString(),
            };

            const incomingRequest: FriendRequestPayload = {
                id: friendship.id,
                userId: fromUserId,
                username: formatName(fromUser.name),
                displayName: formatName(fromUser.name),
                avatarUrl: fromUser.image ?? null,
                direction: 'incoming',
                createdAt: friendship.createdAt.toISOString(),
            };

            return {
                status: 'sent',
                request: outgoingRequest,
                incomingRequest,
                addresseeId: target.id,
            };
        },

        async acceptFriendRequest(
            userId: string,
            requestId: string
        ): Promise<
            | { error: 'request_not_found' | 'unauthorized' | 'not_pending' }
            | { status: 'accepted'; friend: FriendPreview; requesterFriend: FriendPreview; requesterId: string }
        > {
            const friendship = await prisma.friendship.findUnique({
                where: { id: requestId },
                include: {
                    requester: { select: { id: true, name: true, image: true } },
                    addressee: { select: { id: true, name: true, image: true } },
                },
            });

            if (!friendship) {
                return { error: 'request_not_found' };
            }
            if (friendship.addresseeId !== userId) {
                return { error: 'unauthorized' };
            }
            if (friendship.status !== FriendshipStatus.PENDING) {
                return { error: 'not_pending' };
            }

            await prisma.friendship.update({
                where: { id: requestId },
                data: { status: FriendshipStatus.ACCEPTED },
            });

            const friendForAccepter: FriendPreview = {
                id: friendship.requester.id,
                username: formatName(friendship.requester.name),
                displayName: formatName(friendship.requester.name),
                avatarUrl: friendship.requester.image ?? null,
                status: 'online',
            };

            const friendForRequester: FriendPreview = {
                id: friendship.addressee.id,
                username: formatName(friendship.addressee.name),
                displayName: formatName(friendship.addressee.name),
                avatarUrl: friendship.addressee.image ?? null,
                status: 'online',
            };

            return {
                status: 'accepted',
                friend: friendForAccepter,
                requesterFriend: friendForRequester,
                requesterId: friendship.requesterId,
            };
        },

        async declineFriendRequest(
            userId: string,
            requestId: string
        ): Promise<
            | { error: 'request_not_found' | 'unauthorized' | 'not_pending' }
            | { status: 'declined'; requesterId: string }
        > {
            const friendship = await prisma.friendship.findUnique({ where: { id: requestId } });

            if (!friendship) {
                return { error: 'request_not_found' };
            }
            if (friendship.addresseeId !== userId) {
                return { error: 'unauthorized' };
            }
            if (friendship.status !== FriendshipStatus.PENDING) {
                return { error: 'not_pending' };
            }

            await prisma.friendship.update({
                where: { id: requestId },
                data: { status: FriendshipStatus.DECLINED },
            });

            return { status: 'declined', requesterId: friendship.requesterId };
        },

        async deleteFriend(friendId: string): Promise<{ status: 'ok' }> {
            await prisma.friendship.delete({
                where: { id: friendId },
            });
            return { status: 'ok' };
        },
    };
}

export type InviteService = ReturnType<typeof createInviteService>;