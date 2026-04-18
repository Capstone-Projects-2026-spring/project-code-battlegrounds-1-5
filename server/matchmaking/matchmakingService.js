const { getPrisma } = require('../prisma/index');
const { GameType, Role, ProblemDifficulty } = require('@prisma/client');
const { nanoid } = require('nanoid');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const prisma = getPrisma();

const QUEUE_KEY = (gameType, difficulty) =>
    difficulty ? `queue:${gameType}:${difficulty}` : `queue:${gameType}`;

const REQUIRED_PLAYERS = {
    [GameType.TWOPLAYER]: 2,
    [GameType.FOURPLAYER]: 4,
    [GameType.RANKED]: 4,
};

const popAndMatchSRC = join(__dirname, "./popAndMatch.lua");
const POP_AND_MATCH_SCRIPT = readFileSync(popAndMatchSRC).toString();
const popAndMatchRankedSRC = join(__dirname, "./popAndMatchRanked.lua");
const POP_AND_MATCH_RANKED = readFileSync(popAndMatchRankedSRC).toString();

function eloToDifficulty(avgElo) {
    if (avgElo < 1200) return ProblemDifficulty.EASY;
    if (avgElo < 1600) return ProblemDifficulty.MEDIUM;
    return ProblemDifficulty.HARD;
}

async function getElo(userId) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { elo: true },
    });
    return user?.elo ?? 1000;
}

function createMatchmakingService(stateRedis, io) {
    return {

        // QUEUE MANAGEMENT SECTION

        async joinQueue(userId, gameType, difficulty, partyId = null) {
            const queueKey = QUEUE_KEY(gameType, gameType === GameType.RANKED ? null : difficulty);

            if (gameType === GameType.RANKED) {
                const entries = await stateRedis.zrange(queueKey, 0, -1);

                // check neither the solo user nor their party is already queued
                const alreadyQueued = entries.some(e => {
                    const parsed = JSON.parse(e);
                    return parsed.userId === userId || parsed.partyId === partyId;
                });
                if (alreadyQueued) return { status: 'already_queued' };

                let elo;
                let entry;

                if (partyId) {
                    const party = await prisma.party.findUnique({
                        where: { id: partyId },
                        include: { owner: true, member: true },
                    });
                    if (!party) return { error: 'party_not_found' };
                    if (!party.member) return { error: 'party_not_full' };

                    const [ownerElo, memberElo] = await Promise.all([
                        getElo(party.owner.id),
                        getElo(party.member.userId),
                    ]);
                    elo = Math.round((ownerElo + memberElo) / 2);
                    entry = JSON.stringify({ partyId, joinedAt: Date.now() });
                } else {
                    elo = await getElo(userId);
                    entry = JSON.stringify({ userId, joinedAt: Date.now() });
                }

                await stateRedis.zadd(queueKey, elo, entry);
                return await this._tryFormRankedMatch(queueKey);
            }

            const entries = await stateRedis.lrange(queueKey, 0, -1);
            const alreadyQueued = entries.some(e => {
                const parsed = JSON.parse(e);
                return parsed.userId === userId;
            });
            if (alreadyQueued) return { status: 'already_queued' };

            if (partyId && gameType === GameType.TWOPLAYER) {
                return await this._formPartyGame(partyId, gameType, difficulty);
            }

            const entry = partyId
                ? JSON.stringify({ partyId, joinedAt: Date.now() })
                : JSON.stringify({ userId, joinedAt: Date.now() });

            await stateRedis.rpush(queueKey, entry);
            return await this._tryFormMatch(queueKey, gameType, difficulty);
        },

        async leaveQueue(userId, gameType, difficulty, partyId = null) {
            if (gameType === GameType.RANKED) {
                const queueKey = QUEUE_KEY(gameType, null);
                const entries = await stateRedis.zrange(queueKey, 0, -1);
                for (const entry of entries) {
                    const parsed = JSON.parse(entry);
                    const isSolo = parsed.userId === userId;
                    const isParty = partyId && parsed.partyId === partyId;
                    if (isSolo || isParty) {
                        await stateRedis.zrem(queueKey, entry);
                        return { status: 'removed' };
                    }
                }
                return { status: 'not_found' };
            }

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
                if (gt === GameType.RANKED) {
                    await this.leaveQueue(userId, gt, null);
                } else {
                    for (const diff of difficulties) {
                        await this.leaveQueue(userId, gt, diff);
                    }
                }
            }
        },

        async getQueueLengths() {
            const gameTypes = Object.values(GameType);
            const difficulties = Object.values(ProblemDifficulty);
            const result = {};
            for (const gt of gameTypes) {
                if (gt === GameType.RANKED) {
                    result[gt] = await stateRedis.zcard(QUEUE_KEY(gt, null));
                } else {
                    result[gt] = {};
                    for (const diff of difficulties) {
                        result[gt][diff] = await stateRedis.llen(QUEUE_KEY(gt, diff));
                    }
                }
            }
            return result;
        },

        // MATCH FORMATION SECTION

        async _tryFormMatch(queueKey, gameType, difficulty) {
            if (gameType === GameType.RANKED) {
                return this._tryFormRankedMatch(queueKey);
            }

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
                        const party = await prisma.party.findUnique({
                            where: { id: parsed.partyId },
                            include: { owner: true, member: true },
                        });

                        if (!party || !party.member) {
                            console.warn(`Party ${parsed.partyId} invalid at match time, dropping`);
                            return null;
                        }

                        return [
                            { userId: party.owner.id, partyId: parsed.partyId },
                            { userId: party.member.userId, partyId: parsed.partyId },
                        ];
                    }

                    return [{ userId: parsed.userId }];
                })
            );

            const players = resolved.flat().filter(Boolean);

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

        async _tryFormRankedMatch(queueKey) {
            const results = await stateRedis.eval(
                POP_AND_MATCH_RANKED,
                1,
                queueKey,
                String(Date.now())
            );

            if (!results || results.length === 0) return { status: 'queued' };

            // resolve entries — parties expand to 2 players, solos stay as 1
            const resolved = await Promise.all(
                results.map(async raw => {
                    const parsed = JSON.parse(raw);
                    if (parsed.partyId) {
                        const party = await prisma.party.findUnique({
                            where: { id: parsed.partyId },
                            include: { owner: true, member: true },
                        });
                        if (!party || !party.member) {
                            console.warn(`Ranked party ${parsed.partyId} invalid at match time, dropping`);
                            return null;
                        }
                        return [
                            { userId: party.owner.id, partyId: parsed.partyId },
                            { userId: party.member.userId, partyId: parsed.partyId },
                        ];
                    }
                    return [{ userId: parsed.userId }];
                })
            );

            const players = resolved.flat().filter(Boolean);

            if (players.length < 4) {
                // re-queue the raw entries with their original elos
                for (const raw of results) {
                    const parsed = JSON.parse(raw);
                    if (parsed.partyId) {
                        const party = await prisma.party.findUnique({
                            where: { id: parsed.partyId },
                            include: { owner: true, member: true },
                        });
                        if (!party?.member) continue;
                        const [ownerElo, memberElo] = await Promise.all([
                            getElo(party.owner.id),
                            getElo(party.member.userId),
                        ]);
                        const avgElo = Math.round((ownerElo + memberElo) / 2);
                        await stateRedis.zadd(queueKey, avgElo, JSON.stringify({ partyId: parsed.partyId, joinedAt: Date.now() }));
                    } else {
                        const elo = await getElo(parsed.userId);
                        await stateRedis.zadd(queueKey, elo, JSON.stringify({ userId: parsed.userId, joinedAt: Date.now() }));
                    }
                }
                return { status: 'queued' };
            }

            const gameRoom = await this._createGameInDB(players, GameType.RANKED, null);
            await this._notifyPlayers(gameRoom);
            return { status: 'matched', gameId: gameRoom.id };
        },

        async _formPartyGame(partyId, gameType, difficulty) {
            const party = await prisma.party.findUnique({
                where: { id: partyId },
                include: { owner: true, member: true },
            });

            if (!party) return { error: 'party_not_found' };
            if (!party.member) return { error: 'party_not_full' };

            const players = [
                { userId: party.owner.id, partyId },
                { userId: party.member.userId, partyId },
            ];
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
            let resolvedDifficulty = difficulty;

            if (gameType === GameType.RANKED) {
                const userIds = players.map(p => p.userId);
                const users = await prisma.user.findMany({
                    where: { id: { in: userIds } },
                    select: { id: true, elo: true },
                });
                const eloMap = Object.fromEntries(users.map(u => [u.id, u.elo ?? 1000]));
                const avgElo = Object.values(eloMap).reduce((a, b) => a + b, 0) / users.length;
                resolvedDifficulty = eloToDifficulty(avgElo);

                // attach elo to each player object for snapshot below
                for (const p of players) {
                    p.elo = eloMap[p.userId];
                }
            }

            const problems = await prisma.problem.findMany({
                where: { difficulty: resolvedDifficulty },
                select: { id: true },
            });

            if (!problems.length) throw new Error(`No problems found for difficulty: ${resolvedDifficulty}`);

            const randomProblem = problems[Math.floor(Math.random() * problems.length)];

            const teamGroups = [];
            for (let i = 0; i < players.length; i += 2) {
                const group = players.slice(i, i + 2);
                if (group.length < 2) {
                    throw new Error(`Invalid team group at index ${i} — only ${group.length} player(s)`);
                }
                teamGroups.push(group);
            }

            const roomID = nanoid(8);

            const gameRoom = await prisma.gameRoom.create({
                data: {
                    id: roomID,
                    gameType,
                    problem: { connect: { id: randomProblem.id } },
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
                    gameResult: { create: {} },
                },
                include: {
                    teams: { include: { players: true } },
                },
            });

            if (gameType === GameType.RANKED) {
                const eloMap = Object.fromEntries(players.map(p => [p.userId, p.elo]));
                await Promise.all(
                    gameRoom.teams.flatMap(team =>
                        team.players.map(tp =>
                            prisma.teamPlayer.update({
                                where: { teamId_userId: { teamId: tp.teamId, userId: tp.userId }},
                                data: { eloAtGame: eloMap[tp.userId] ?? 1000 },
                            })
                        )
                    )
                );
            }

            return gameRoom;
        },

        startRankedScan(intervalMs = 5000) {
            if (this._rankedScanInterval) return; // already running
            this._rankedScanInterval = setInterval(() => {
                this._tryFormRankedMatch(QUEUE_KEY(GameType.RANKED, null));
            }, intervalMs);
        },

        stopRankedScan() {
            if (this._rankedScanInterval) {
                clearInterval(this._rankedScanInterval);
                this._rankedScanInterval = null;
            }
        },
    };
}

module.exports = { createMatchmakingService };