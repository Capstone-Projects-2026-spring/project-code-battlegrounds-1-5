function registerMatchmakingHandlers(io, socket, matchmakingService, gameService) {
    socket.on('joinQueue', async ({ userId, gameType, difficulty, partyId, lobbyId }) => {
    const result = await matchmakingService.joinQueue(userId, gameType, difficulty, partyId ?? lobbyId ?? null);
    socket.emit('queueStatus', result);
  });

  socket.on('leaveQueue', async ({ gameType, difficulty }) => {
    if (!socket.userId) return;
    const result = await matchmakingService.leaveQueue(socket.userId, gameType, difficulty);
    socket.emit('queueStatus', result);
  });

  socket.on('updateQueueSelection', async ({ gameType, difficulty, partyMember }) => {
    if (!socket.userId) return;
    const partyMemberSocket = await gameService.getSocketId(partyMember.userId);
    io.to(partyMemberSocket).emit('receiveQueueSelection', { gameType, difficulty });
  });

  socket.on('partySearch', async ({ partyMember, state }) => {
    if (!socket.userId) return;
    if (!partyMember) return;
    const partyMemberSocket = await gameService.getSocketId(partyMember.userId);
    io.to(partyMemberSocket).emit('partySearchUpdate', { state });
  });

}

module.exports = { registerMatchmakingHandlers };