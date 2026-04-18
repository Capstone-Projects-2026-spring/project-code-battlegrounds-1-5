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
    console.log(`Disconnected: ${socket.id}`);
    if (socket.userId) {
      try {
        await gameService.cleanupSocket(socket.userId);
      } catch (e) {
        console.error('Error during socket cleanup on disconnect', e);
      }
      await matchmakingService.leaveAllQueues(socket.userId);
    }
  });
}



module.exports = { registerSocketHandlers };