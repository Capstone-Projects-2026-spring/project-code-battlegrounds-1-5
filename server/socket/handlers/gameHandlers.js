const { GameType } = require("@prisma/client");
const { z } = require("zod");
const { validate } = require("../../utils/validate");

const ParameterPrimitive = z.union([
    z.literal("string"),
    z.literal("number"),
    z.literal("array_string"),
    z.literal("array_number"),
    z.literal("array_array_string"),
    z.literal("array_array_number"),
    z.literal("boolean")
]);

const Parameter = z.object({
    name: z.string(),
    type: ParameterPrimitive,
    value: z.string().nullable(),
    isOutputParameter: z.optional(z.boolean().default(false))
});



const joinGameSchema = z.object({
    gameId: z.string(),
    teamId: z.string(),
    gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER])
});

const codeChangeSchema = z.object({
    teamId: z.string(),
    code: z.string().max(10000)
});

const messageSchema = z.object({
    id: z.string(),
    text: z.string().max(1000),
    userName: z.string(),
    timestamp: z.number()
});

const chatMessageSchema = z.object({
    teamId: z.string(),
    message: messageSchema
});

const testableCaseSchema = z.object({
    id: z.number(),
    functionInput: z.array(Parameter),
    expectedOutput: Parameter,
    computedOutput: z.string().nullable().optional(),
});

const updateTestCasesSchema = z.object({
    teamId: z.string(),
    testCases: z.array(testableCaseSchema)
});

const requestSyncSchema = z.object({
    teamId: z.string(),
});

const requestTeamUpdateSchema = z.object({
    teamId: z.string(),
    gameId: z.string(),
    playerCount: z.number(),
});

function registerGameHandlers(io, socket, gameService, delayMs = 3000) { // delayMs for testing

    socket.on('joinLobby', async (data) => {
        await socket.join(`${data.gameId}:lobby`);
        socket.emit("joinedLobby");
    });
  
    socket.on('register', async (data) => {
        socket.userId = data.userId;
        await gameService.registerSocketToUser(data.userId, socket.id);
    });

    socket.on('joinGame', async (data) => {
        const payload = validate(joinGameSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for joinGame.' });
            return;
        }

        const { gameId, teamId, gameType } = payload;
        try {
            await socket.join(teamId);
            await socket.join(gameId);
            await socket.leave(`${gameId}:lobby`);
        } catch (e) {
            console.error('Error joining game room', e);
            socket.emit('error', { e, message: 'Failed to join game room.' });
        }

        socket.teamId = teamId;
        socket.gameId = gameId;

        let numPlayers = 0;

        try {
            const socketsInRoom = await io.in(gameId).allSockets();
            console.log(`Room ${gameId} now has ${socketsInRoom.size} sockets`);
            numPlayers = socketsInRoom ? socketsInRoom.size : 0;
        } catch (e) {
            console.error('Error fetching sockets in room', e);
            socket.emit('error', { e, message: 'Failed to fetch room information.' });
        }

        let gameExists = false;

        try {
            gameExists = await gameService.isGameStarted(gameId);
            console.log(`Game Exists: ${gameExists}`);
        } catch (e) {
            console.error('Error checking if game exists', e);
            socket.emit('error', { e, message: 'Failed to check game status.' });
        }

        if (gameExists) {
            try {
                const time = await gameService.startGameIfNeeded(gameId);
                socket.emit('gameStarted', {
                    start: time.remaining,
                    _duration: gameService.GAME_DURATION_MS
                });
            } catch (e) {
                console.error('Error starting game', e);
                socket.emit('error', { e, message: 'Failed to start game.' });
            }
        } else if ((numPlayers === 4 && gameType === GameType.FOURPLAYER) || (numPlayers === 2 && gameType === GameType.TWOPLAYER)) {
            try {
                io.to(gameId).emit('gameStarting');
                setTimeout(async () => {
                    const time = await gameService.startGameIfNeeded(gameId);
                    console.log('game ttl:', time?.remaining, 'of', time?.duration);
                    io.to(gameId).emit('gameStarted', { start: time?.remaining, _duration: gameService.GAME_DURATION_MS });
                }, delayMs);
            } catch (e) {
                console.error('Failed to start game', e);
                socket.emit('error', { e, message: 'Failed to start game.' });
            }
        }

        try {
            const latestCode = await gameService.getLatestCode(teamId);
            if (latestCode != null) {
                socket.emit('receiveCodeUpdate', latestCode);
            }
        } catch (e) {
            console.error('Error fetching code from Redis', e);
            socket.emit('error', { e, message: 'Failed to fetch latest code.' });
        }

        console.log(`Socket ${socket.id} joined room ${gameId} and team ${teamId}`);
    });

    socket.on('codeChange', async (data) => {
        const payload = validate(codeChangeSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for codeChange.' });
            return;
        }

        const { teamId, code } = payload;
        try {
            await gameService.saveLatestCode(teamId, code);
        } catch (e) {
            console.error('Error saving code to Redis', e);
            socket.emit('error', { e, message: 'Failed to save code update.' });
        }

        socket.to(teamId).emit('receiveCodeUpdate', code);
    });

    socket.on('sendChat', async (data) => {
        const payload = validate(chatMessageSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for sendChat.' });
            return;
        }

        const { teamId, message } = payload;

        try {
            await gameService.saveChatMessage(teamId, message);
        } catch (e) {
            console.error('Error saving chat message to Redis', e);
            socket.emit('error', { e, message: 'Failed to send chat message.' });
        }

        socket.to(teamId).emit('receiveChat', message);
    });

    socket.on('requestChatSync', async (data) => {
        const payload = validate(requestSyncSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for requestChatSync.' });
            return;
        }
        const { teamId } = payload;

        try {
            const parsed = await gameService.getChatMessages(teamId);
            socket.emit('receiveChatHistory', parsed);
        } catch (e) {
            console.error('Error fetching chat history', e);
            socket.emit('error', { e, message: 'Failed to fetch chat history.' });
        }
    });

    socket.on('updateTestCases', async (data) => {
        const payload = validate(updateTestCasesSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for updateTestCases.' });
            return;
        }
        const { teamId, testCases } = payload;

        try {
            await gameService.saveTestCases(teamId, testCases);
            socket.to(teamId).emit('receiveTestCaseSync', testCases);
        } catch (e) {
            console.error('Error saving test cases', e);
            socket.emit('error', { e, message: 'Failed to save test cases.' });
        }
    });

    socket.on('requestTestCaseSync', async (data) => {
        const payload = validate(requestSyncSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for requestTestCaseSync.' });
            return;
        }
        const { teamId } = payload;

        try {
            const testCases = await gameService.getTestCases(teamId);
            if (testCases) {
                socket.emit('receiveTestCaseSync', testCases); 
                socket.to(teamId).emit('receiveTestCaseSync', testCases);
            }
        } catch (e) {
            console.error('Error fetching test cases', e);
            socket.emit('error', { e, message: 'Failed to fetch test cases.' });
        }
    });

    socket.on('requestTeamUpdate', async (data) => {
        const payload = validate(requestTeamUpdateSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for requestTeamUpdate.' });
            return;
        }
        const { teamId, gameId, playerCount } = payload;

        if (!playerCount) return;
        io.to(`${gameId}:lobby`).emit('teamUpdated', { teamId, playerCount });
    });

    socket.on('creatingRoomWithParty', async (data) => {
        const { partyMember } = data;
        const partyMemSocket = await gameService.getSocketId(partyMember);
        io.to(partyMemSocket).emit('creatingRoomFromHost');
    });

    socket.on('sendGameWithParty', async (data) => {
        const { partyMember, gameId } = data;
        const partyMemSocket = await gameService.getSocketId(partyMember);
        io.to(partyMemSocket).emit('createdRoomFromHost', { gameId });
    });
}

module.exports = { registerGameHandlers };