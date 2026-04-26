import type { Server } from 'socket.io';
import { z } from 'zod';
import type { GameService } from '../../game/gameService';
import type { InviteService } from '../../invite/inviteService';
import type { SocketWithState } from '../../types';
import { validate } from '../../utils/validate';

const partyInviteSchema = z.object({
    toUserId: z.string(),
});

const partyJoinByCodeSchema = z.object({
    code: z.string().min(1).max(36),
});

const friendRequestSchema = z.object({
    friendCode: z.string().min(1).max(50),
});

const friendRequestRespondSchema = z.object({
    requestId: z.string(),
});

const friendDeleteSchema = z.object({
    exFriendId: z.string(),
    friendId: z.string(),
});

export function registerInviteHandlers(
    io: Server,
    socket: SocketWithState,
    inviteService: InviteService,
    gameService: GameService
): void {
    socket.on('partyInvite', async (data) => {
        const payload = validate(partyInviteSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for partyInvite.' });
            return;
        }
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.sendPartyInvite(socket.userId, payload.toUserId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        const toSocketId = await gameService.getSocketId(payload.toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('partyInviteReceived', result.invite);
        }
    });

    socket.on('partyInviteAccept', async () => {
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.acceptPartyInvite(socket.userId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        socket.emit('partyJoined', result.partyOwner);

        const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('partyMemberJoined', result.member);
        }
    });

    socket.on('partyInviteDecline', async () => {
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.declinePartyInvite(socket.userId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
        }
    });

    socket.on('partyKick', async () => {
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.kickPartyMember(socket.userId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        const kickedSocketId = await gameService.getSocketId(result.kickedUserId);
        if (kickedSocketId) {
            io.to(kickedSocketId).emit('joinedPartyLeft');
        }
    });

    socket.on('partyJoinByCode', async (data) => {
        const payload = validate(partyJoinByCodeSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for partyJoinByCode.' });
            return;
        }
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.joinPartyByCode(socket.userId, payload.code);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        socket.emit('partyJoined', result.partyOwner);

        const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('partyMemberJoined', result.member);
        }
    });

    socket.on('partyLeave', async () => {
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.leaveParty(socket.userId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        const ownerSocketId = await gameService.getSocketId(result.ownerId);
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('partyMemberLeft');
        }
    });

    socket.on('friendRequest', async (data) => {
        const payload = validate(friendRequestSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for friendRequest.' });
            return;
        }
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.sendFriendRequest(socket.userId, payload.friendCode);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        socket.emit('friendRequestSent', result.request);

        const toSocketId = await gameService.getSocketId(result.addresseeId);
        if (toSocketId) {
            io.to(toSocketId).emit('friendRequestReceived', {
                ...result.incomingRequest,
                direction: 'incoming',
            });
        }
    });

    socket.on('friendRequestAccept', async (data) => {
        const payload = validate(friendRequestRespondSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for friendRequestAccept.' });
            return;
        }
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.acceptFriendRequest(socket.userId, payload.requestId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        socket.emit('friendRequestAccepted', result.friend);

        const requesterSocketId = await gameService.getSocketId(result.requesterId);
        if (requesterSocketId) {
            io.to(requesterSocketId).emit('friendRequestAccepted', result.requesterFriend);
        }
    });

    socket.on('friendRequestDecline', async (data) => {
        const payload = validate(friendRequestRespondSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for friendRequestDecline.' });
            return;
        }
        if (!socket.userId) {
            return;
        }

        const result = await inviteService.declineFriendRequest(socket.userId, payload.requestId);
        if ('error' in result) {
            socket.emit('error', { message: result.error });
            return;
        }

        const requesterSocketId = await gameService.getSocketId(result.requesterId);
        if (requesterSocketId) {
            io.to(requesterSocketId).emit('friendRequestDeclined', { requestId: payload.requestId });
        }
    });

    socket.on('friendDelete', async (data) => {
        const payload = validate(friendDeleteSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for friendDelete.' });
            return;
        }

        const result = await inviteService.deleteFriend(payload.friendId);
        if (result.status !== 'ok') {
            socket.emit('error', { message: 'friendNotDeleted' });
            return;
        }

        const exFriendSocket = await gameService.getSocketId(payload.exFriendId);
        if (exFriendSocket) {
            io.to(exFriendSocket).emit('friendDeleted', { friendId: payload.friendId });
        }
    });
}