const { registerExecutionHandlers } = require("./executionHandlers");
const { registerGameHandlers } = require("./gameHandlers");
const { registerMatchmakingHandlers } = require("./matchmakingHandlers");
const { registerInviteHandlers } = require("./inviteHandlers");


function registerSocketHandlers(io, socket, services) {
  const { gameService, matchmakingService, inviteService } = services;

  registerGameHandlers(io, socket, gameService);
  registerExecutionHandlers(io, socket, gameService);
  registerMatchmakingHandlers(io, socket, matchmakingService);
  registerInviteHandlers(io, socket, inviteService, gameService);

  socket.on('disconnect', async () => {
    if (socket.gameId && socket.userId) {
      try {
        await gameService.cleanupGame(socket.gameId, socket.userId);
        console.log(`Disconnected: ${socket.id}`);
      } catch (e) {
        console.error('Error during cleanup on disconnect', e);
        socket.emit('error', { e, message: 'Failed to cleanup on disconnect.' });
      }
    }
    if (socket.userId) {
      await matchmakingService.leaveAllQueues(socket.userId);
    }
  });
}



module.exports = { registerSocketHandlers };