import { GameType } from '@prisma/client';
import type { Server } from 'socket.io';
import { z } from 'zod';
import type { GameService } from '../../game/gameService';
import type { SocketWithState } from '../../types';
import { validate } from '../../utils/validate';

const parameterPrimitiveSchema = z.enum([
    'string',
    'number',
    'array_string',
    'array_number',
    'array_array_string',
    'array_array_number',
    'boolean',
]);

const parameterSchema = z.object({
    name: z.string(),
    type: parameterPrimitiveSchema,
    value: z.string().nullable(),
    isOutputParameter: z.boolean().default(false).optional(),
});

const registerSchema = z.object({
    userId: z.string(),
});

const joinGameSchema = z.object({
    gameId: z.string(),
    teamId: z.string(),
    gameType: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
});

const codeChangeSchema = z.object({
    teamId: z.string(),
    code: z.string().max(10000),
});

const messageSchema = z.object({
    id: z.string(),
    text: z.string().max(1000),
    userName: z.string(),
    timestamp: z.number(),
});

const chatMessageSchema = z.object({
    teamId: z.string(),
    message: messageSchema,
});

const testableCaseSchema = z.object({
    id: z.number(),
    functionInput: z.array(parameterSchema),
    expectedOutput: parameterSchema,
    computedOutput: z.string().nullable().optional(),
});

const updateTestCasesSchema = z.object({
    teamId: z.string(),
    testCases: z.array(testableCaseSchema),
});

const requestSyncSchema = z.object({
    teamId: z.string(),
});

const requestTeamUpdateSchema = z.object({
    teamId: z.string(),
    playerCount: z.number(),
});

const createRoomWithPartySchema = z.object({
    partyMember: z.string(),
});

const sendGameWithPartySchema = z.object({
    partyMember: z.string(),
    gameId: z.string(),
});

export function registerGameHandlers(io: Server, socket: SocketWithState, gameService: GameService): void {
    socket.on('register', (data) => {
        void (async (): Promise<void> => {
            const payload = validate(registerSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for register.' });
                return;
            }

            socket.userId = payload.userId;
            await gameService.registerSocketToUser(payload.userId, socket.id);
        })();
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
        } catch (error: unknown) {
            console.error('Error joining game room', error);
            socket.emit('error', { message: 'Failed to join game room.' });
        }

        socket.teamId = teamId;
        socket.gameId = gameId;

        let numPlayers = 0;
        try {
            const socketsInRoom = await io.in(gameId).allSockets();
            numPlayers = socketsInRoom.size;
            console.log(`Room ${gameId} now has ${numPlayers} sockets`);
        } catch (error: unknown) {
            console.error('Error fetching sockets in room', error);
            socket.emit('error', { message: 'Failed to fetch room information.' });
        }

        let gameExists = false;
        try {
            gameExists = await gameService.isGameStarted(gameId);
            console.log(`Game Exists: ${gameExists}`);
        } catch (error: unknown) {
            console.error('Error checking if game exists', error);
            socket.emit('error', { message: 'Failed to check game status.' });
        }

        if (gameExists) {
            try {
                const time = await gameService.startGameIfNeeded(gameId);
                socket.emit('gameStarted', {
                    start: time.remaining,
                    _duration: gameService.GAME_DURATION_MS,
                });
            } catch (error: unknown) {
                console.error('Error starting game', error);
                socket.emit('error', { message: 'Failed to start game.' });
            }
        } else if (
            (numPlayers === 4 && gameType === GameType.FOURPLAYER) ||
            (numPlayers === 2 && gameType === GameType.TWOPLAYER)
        ) {
            io.to(gameId).emit('gameStarting');

            setTimeout(() => {
                void (async (): Promise<void> => {
                    const time = await gameService.startGameIfNeeded(gameId);
                    console.log('game ttl:', time.remaining, 'of', time.duration);
                    io.to(gameId).emit('gameStarted', {
                        start: time.remaining,
                        _duration: gameService.GAME_DURATION_MS,
                    });
                })().catch((error: unknown) => {
                    console.error('Failed to start game after countdown', error);
                    socket.emit('error', { message: 'Failed to start game.' });
                });
            }, 3000);
        }

        try {
            const latestCode = await gameService.getLatestCode(teamId);
            if (latestCode !== null) {
                socket.emit('receiveCodeUpdate', latestCode);
            }
        } catch (error: unknown) {
            console.error('Error fetching code from Redis', error);
            socket.emit('error', { message: 'Failed to fetch latest code.' });
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
        } catch (error: unknown) {
            console.error('Error saving code to Redis', error);
            socket.emit('error', { message: 'Failed to save code update.' });
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
        } catch (error: unknown) {
            console.error('Error saving chat message to Redis', error);
            socket.emit('error', { message: 'Failed to send chat message.' });
        }

        socket.to(teamId).emit('receiveChat', message);
    });

    socket.on('requestChatSync', async (data) => {
        try {
            const payload = validate(requestSyncSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for requestChatSync.' });
                return;
            }

            const parsed = await gameService.getChatMessages(payload.teamId);
            socket.emit('receiveChatHistory', parsed);
        } catch (error) {
            console.error('Error fetching chat history', error);
            socket.emit('error', { message: 'Failed to fetch chat history.' });
        }
    });

    socket.on('updateTestCases', async (data) => {
        try {
            const payload = validate(updateTestCasesSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for updateTestCases.' });
                return;
            }

            await gameService.saveTestCases(payload.teamId, payload.testCases);
        } catch (error) {
            console.error('Error saving test cases', error);
            socket.emit('error', { message: 'Failed to save test cases.' });
        }
    });

    socket.on('requestTestCaseSync', async (data) => {
        try {
            const payload = validate(requestSyncSchema, data);
            if (!payload) {
                socket.emit('error', { message: 'Invalid payload for requestTestCaseSync.' });
                return;
            }

            const testCases = await gameService.getTestCases(payload.teamId);
            if (testCases) {
                socket.emit('receiveTestCaseSync', testCases);
            }
        } catch (error) {
            console.error('Error fetching test cases', error);
            socket.emit('error', { message: 'Failed to fetch test cases.' });
        }
    });

    socket.on('requestTeamUpdate', (data) => {
        const payload = validate(requestTeamUpdateSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for requestTeamUpdate.' });
            return;
        }

        if (!payload.playerCount) {
            return;
        }
        io.emit('teamUpdated', { teamId: payload.teamId, playerCount: payload.playerCount });
    });

    socket.on('creatingRoomWithParty', async (data) => {
        const payload = validate(createRoomWithPartySchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for creatingRoomWithParty.' });
            return;
        }

        const partyMemberSocket = await gameService.getSocketId(payload.partyMember);
        if (partyMemberSocket) {
            io.to(partyMemberSocket).emit('creatingRoomFromHost');
        }
    });

    socket.on('sendGameWithParty', async (data) => {
        const payload = validate(sendGameWithPartySchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for sendGameWithParty.' });
            return;
        }

        const partyMemberSocket = await gameService.getSocketId(payload.partyMember);
        if (partyMemberSocket) {
            io.to(partyMemberSocket).emit('createdRoomFromHost', { gameId: payload.gameId });
        }
    });
}