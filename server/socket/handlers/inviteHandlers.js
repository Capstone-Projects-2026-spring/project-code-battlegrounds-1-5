const { z } = require("zod");
const { validate } = require("./utils");

const partyInviteSchema = z.object({
    toUserId: z.string(),
});

const partyJoinByCodeSchema = z.object({
    code: z.string().min(1).max(10),
});

const friendRequestSchema = z.object({
    friendCode: z.string().min(1).max(20),
});

const friendRequestRespondSchema = z.object({
    requestId: z.string(),
});


function registerInviteHandlers(io, socket, inviteService, gameService) {

    socket.on('partyInvite', async (data) => {
        const payload = validate(partyInviteSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for partyInvite.' });
            return;
        }
        if (!socket.userId) return;

        const result = await inviteService.sendPartyInvite(socket.userId, payload.toUserId);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Notify the invitee so their pendingInvite state updates immediately
        const toSocketId = await gameService.getSocketId(payload.toUserId);
        if (toSocketId) {
            io.to(toSocketId).emit('partyInviteReceived', result.invite);
        }
    });

    socket.on('partyInviteAccept', async () => {
        if (!socket.userId) return;

        const result = await inviteService.acceptPartyInvite(socket.userId);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Tell the accepter their partyJoined so InvitesTab can clear pendingInvite
        socket.emit('partyJoined', result.partyOwner);

        // Tell the owner their guest slot is now filled
        const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('partyMemberJoined', result.member);
        }
    });

    socket.on('partyInviteDecline', async () => {
        if (!socket.userId) return;

        const result = await inviteService.declinePartyInvite(socket.userId);
        if (result.error) {
            socket.emit('error', { message: result.error });
        }
    });

    socket.on('partyKick', async () => {
        if (!socket.userId) return;

        const result = await inviteService.kickPartyMember(socket.userId);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Tell the kicked user their slot is cleared so their partyCode view resets
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
        if (!socket.userId) return;

        const result = await inviteService.joinPartyByCode(socket.userId, payload.code);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Tell the joiner they're in so PartySlots can update their own view
        socket.emit('partyJoined', result.partyOwner);

        // Tell the owner their guest slot is filled with the joiner's details
        const ownerSocketId = await gameService.getSocketId(result.partyOwner.userId);
        if (ownerSocketId) {
            io.to(ownerSocketId).emit('partyMemberJoined', result.member);
        }
    });

    socket.on('partyLeave', async () => {
        if (!socket.userId) return;

        const result = await inviteService.leaveParty(socket.userId);
        if (result.error) {
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
        if (!socket.userId) return;

        const result = await inviteService.sendFriendRequest(socket.userId, payload.friendCode);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Confirm to sender so their outgoing requests list updates
        socket.emit('friendRequestSent', result.request);

        // Notify the addressee so their InvitesTab updates immediately
        const toSocketId = await gameService.getSocketId(result.addresseeId);
        if (toSocketId) {
            io.to(toSocketId).emit('friendRequestReceived', { ...result.incomingRequest, direction: 'incoming' });
        }
    });

    socket.on('friendRequestAccept', async (data) => {
        const payload = validate(friendRequestRespondSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for friendRequestAccept.' });
            return;
        }
        if (!socket.userId) return;

        const result = await inviteService.acceptFriendRequest(socket.userId, payload.requestId);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Update the accepter's friends list
        socket.emit('friendRequestAccepted', result.friend);

        // Update the original requester's friends list
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
        if (!socket.userId) return;

        const result = await inviteService.declineFriendRequest(socket.userId, payload.requestId);
        if (result.error) {
            socket.emit('error', { message: result.error });
            return;
        }

        // Notify the requester their outgoing request was declined
        const requesterSocketId = await gameService.getSocketId(result.requesterId);
        if (requesterSocketId) {
            io.to(requesterSocketId).emit('friendRequestDeclined', { requestId: payload.requestId });
        }
    });

    socket.on("friendDelete", async (data) => {
        const { exFriendId, friendId } = data;
        const result = await inviteService.deleteFriend(friendId);
        if (result.status !== "ok") socket.emit("error", { message: "friendNotDeleted" });
        const exFriendSocket = await gameService.getSocketId(exFriendId);
        io.to(exFriendSocket).emit("friendDeleted", { friendId });
    });
}

module.exports = { registerInviteHandlers };