const { getPrisma } = require('../prisma/index');
const { GameType, Role, ProblemDifficulty } = require('@prisma/client');
const { nanoid } = require('nanoid');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const QUEUE_KEY = (gameType, difficulty) => `queue:${gameType}:${difficulty}`;
const REQUIRED_PLAYERS = {
    [GameType.TWOPLAYER]: 2,
    [GameType.FOURPLAYER]: 4,
};

const src = join(__dirname, "./popAndMatch.lua");
const POP_AND_MATCH_SCRIPT = readFileSync(src).toString();

function createMatchmakingService(stateRedis, io) {
    return {
        
        // SOCKET REGISTRATION (needed for matchmaking and used in middleware)
        async registerSocketToUser(userId, socketId) {
            await stateRedis.set(`socket:${userId}`, socketId); // link userId
        },

        // QUEUE MANAGEMENT SECTION

        async joinQueue(userId, gameType, difficulty, partyId = null) {
            const queueKey = QUEUE_KEY(gameType, difficulty);

            const entries = await stateRedis.lrange(queueKey, 0, -1);
            const alreadyQueued = entries.some(e => {
                const parsed = JSON.parse(e);
                return parsed.userId === userId;
            });
            if (alreadyQueued) return { status: 'already_queued' };

            // TWOPLAYER + party = instant game, no queue needed
            if (partyId && gameType === GameType.TWOPLAYER) {
                return await this._formPartyGame(partyId, gameType, difficulty);
            }

            const entry = partyId
                ? JSON.stringify({ partyId, joinedAt: Date.now() })
                : JSON.stringify({ userId, joinedAt: Date.now() });

            await stateRedis.rpush(queueKey, entry);
            return await this._tryFormMatch(queueKey, gameType, difficulty);
        },

        async leaveQueue(userId, gameType, difficulty) {
            const queueKey = QUEUE_KEY(gameType, difficulty);
            const entries = await stateRedis.lrange(queueKey, 0, -1);

            for (const entry of entries) {
                const parsed = JSON.parse(entry);
                const isSolo = parsed.userId === userId;
                const isPair = parsed.userIds?.includes(userId);

                if (isSolo || isPair) {
                    await stateRedis.lrem(queueKey, 1, entry);
                    return { status: 'removed' };
                }
            }

            return { status: 'not_found' };
        },

        async leaveAllQueues(userId) {
            const difficulties = Object.values(ProblemDifficulty);
            const gameTypes = Object.values(GameType);
            for (const gt of gameTypes) {
                for (const diff of difficulties) {
                    await this.leaveQueue(userId, gt, diff);
                }
            }
        },

        async getQueueLengths() {
            const gameTypes = Object.values(GameType);
            const difficulties = Object.values(ProblemDifficulty);
            const result = {};
            for (const gt of gameTypes) {
                result[gt] = {};
                for (const diff of difficulties) {
                    result[gt][diff] = await stateRedis.llen(QUEUE_KEY(gt, diff));
                }
            }
            return result;
        },

        // MATCH FORMATION SECTION

        async _tryFormMatch(queueKey, gameType, difficulty) {
            const required = REQUIRED_PLAYERS[gameType];

            const results = await stateRedis.eval(
                POP_AND_MATCH_SCRIPT,
                1,
                queueKey,
                String(required)
            );

            if (!results || results.length === 0) return { status: 'queued' };

            const resolved = await Promise.all(
                results.map(async raw => {
                    const parsed = JSON.parse(raw);

                    if (parsed.partyId) {
                        const party = await getPrisma().party.findUnique({
                            where: { id: parsed.partyId },
                            include: { members: true },
                        });

                        if (!party || party.members.length < 2) {
                            console.warn(`Party ${parsed.partyId} invalid at match time, dropping`);
                            return null;
                        }

                        return party.members.map(m => ({ userId: m.userId, partyId: parsed.partyId }));
                    }

                    return [{ userId: parsed.userId }];
                })
            );

            const players = resolved.flat().filter(Boolean);

            // If a dropped party left us short, re-queue the valid players and abort
            if (players.length < required) {
                for (const player of players) {
                    const reEntry = player.partyId
                        ? JSON.stringify({ partyId: player.partyId, joinedAt: Date.now() })
                        : JSON.stringify({ userId: player.userId, joinedAt: Date.now() });
                    await stateRedis.lpush(queueKey, reEntry);
                }
                return { status: 'queued' };
            }

            const gameRoom = await this._createGameInDB(players, gameType, difficulty);
            await this._notifyPlayers(gameRoom);
            return { status: 'matched', gameId: gameRoom.id };
        },

        async _formPartyGame(partyId, gameType, difficulty) {
            const party = await getPrisma().party.findUnique({
                where: { id: partyId },
                include: { members: true },
            });

            if (!party) return { error: 'party_not_found' };
            if (party.members.length < 2) return { error: 'party_not_full' };

            const players = party.members.map(m => ({ userId: m.userId, partyId }));
            const gameRoom = await this._createGameInDB(players, gameType, difficulty);
            await this._notifyPlayers(gameRoom);
            return { status: 'matched', gameId: gameRoom.id };
        },

        async _notifyPlayers(gameRoom) {
            for (const team of gameRoom.teams) {
                for (const teamPlayer of team.players) {
                    const socketId = await stateRedis.get(`socket:${teamPlayer.userId}`);
                    if (socketId) {
                        io.to(socketId).emit('matchFound', { gameId: gameRoom.id });
                    }
                }
            }
        },

        async _createGameInDB(players, gameType, difficulty) {
            const prisma = getPrisma();

            const problems = await prisma.problem.findMany({
                where: { difficulty },
                select: { id: true },
            });

            if (!problems.length) throw new Error(`No problems found for difficulty: ${difficulty}`);

            const randomProblem = problems[Math.floor(Math.random() * problems.length)];

            const teamGroups = [];
            for (let i = 0; i < players.length; i += 2) {
                const group = players.slice(i, i + 2);
                if (group.length < 2) {
                    throw new Error(`Invalid team group at index ${i} — only ${group.length} player(s)`);
                }
                teamGroups.push(group);
            }

            console.log('teamGroups:', JSON.stringify(teamGroups, null, 2));

            const roomID = nanoid(8);

            return await prisma.gameRoom.create({
                data: {
                    id: roomID,
                    gameType,
                    problem: {
                        connect: { id: randomProblem.id },
                    },
                    teams: {
                        create: teamGroups.map(group => ({
                            players: {
                                create: group.map((p, idx) => ({
                                    userId: p.userId,
                                    role: idx === 0 ? Role.CODER : Role.TESTER,
                                })),
                            },
                        })),
                    },
                    gameResult: {
                        create: {},
                    },
                },
                include: {
                    teams: { include: { players: true } },
                },
            });
        }
    };
}

module.exports = { createMatchmakingService };