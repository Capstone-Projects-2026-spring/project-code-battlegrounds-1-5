import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameType, ProblemDifficulty, Role, type Prisma } from '@prisma/client';
import type { Redis } from 'ioredis';
import type { Server } from 'socket.io';
import { getPrisma } from '../prisma';
import { nanoid } from '../utils/nanoid';
import { warmVm } from '../utils/vm/warmVm';

type GameRoomWithTeams = Prisma.GameRoomGetPayload<{
    include: {
        teams: {
            include: {
                players: true;
            };
        };
    };
}>;

interface SoloQueueEntry {
    userId: string;
    joinedAt: number;
}

interface PartyQueueEntry {
    partyId: string;
    joinedAt: number;
}

interface LegacyPairQueueEntry {
    userIds: string[];
    joinedAt: number;
}

type QueueEntry = SoloQueueEntry | PartyQueueEntry | LegacyPairQueueEntry;

interface MatchedPlayer {
    userId: string;
    partyId?: string;
}

const QUEUE_KEY = (gameType: GameType, difficulty: ProblemDifficulty): string =>
    `queue:${gameType}:${difficulty}`;

const REQUIRED_PLAYERS: Record<GameType, number> = {
    [GameType.TWOPLAYER]: 2,
    [GameType.FOURPLAYER]: 4,
};

const scriptPath = join(__dirname, 'popAndMatch.lua');
const POP_AND_MATCH_SCRIPT = readFileSync(scriptPath, 'utf8');

function parseJson<T>(value: string): T {
    return JSON.parse(value) as T;
}

function isPartyEntry(entry: QueueEntry): entry is PartyQueueEntry {
    return 'partyId' in entry;
}

function isMatchedPlayer(value: MatchedPlayer | null): value is MatchedPlayer {
    return value !== null;
}

export function createMatchmakingService(stateRedis: Redis, io: Server) {
    return {
        // QUEUE MANAGEMENT SECTION
        async joinQueue(
            userId: string,
            gameType: GameType,
            difficulty: ProblemDifficulty,
            partyId: string | null = null
        ): Promise<{ status: 'already_queued' | 'queued' } | { status: 'matched'; gameId: string } | { error: string }> {
            const queueKey = QUEUE_KEY(gameType, difficulty);

            const entries = await stateRedis.lrange(queueKey, 0, -1);
            const alreadyQueued = entries.some((entry) => {
                const parsed = parseJson<QueueEntry>(entry);
                return 'userId' in parsed && parsed.userId === userId;
            });

            if (alreadyQueued) {
                return { status: 'already_queued' };
            }

            // TWOPLAYER + party = instant game, no queue needed.
            if (partyId && gameType === GameType.TWOPLAYER) {
                return this._formPartyGame(partyId, gameType, difficulty);
            }

            const entry = partyId
                ? JSON.stringify({ partyId, joinedAt: Date.now() } satisfies PartyQueueEntry)
                : JSON.stringify({ userId, joinedAt: Date.now() } satisfies SoloQueueEntry);

            await stateRedis.rpush(queueKey, entry);
            return this._tryFormMatch(queueKey, gameType, difficulty);
        },

        async leaveQueue(
            userId: string,
            gameType: GameType,
            difficulty: ProblemDifficulty
        ): Promise<{ status: 'removed' | 'not_found' }> {
            const queueKey = QUEUE_KEY(gameType, difficulty);
            const entries = await stateRedis.lrange(queueKey, 0, -1);

            for (const entry of entries) {
                const parsed = parseJson<QueueEntry>(entry);
                const isSolo = 'userId' in parsed && parsed.userId === userId;
                const isLegacyPair = 'userIds' in parsed && parsed.userIds.includes(userId);

                if (isSolo || isLegacyPair) {
                    await stateRedis.lrem(queueKey, 1, entry);
                    return { status: 'removed' };
                }
            }

            return { status: 'not_found' };
        },

        async leaveAllQueues(userId: string): Promise<void> {
            const difficulties = Object.values(ProblemDifficulty);
            const gameTypes = Object.values(GameType);
            for (const gameType of gameTypes) {
                for (const difficulty of difficulties) {
                    await this.leaveQueue(userId, gameType, difficulty);
                }
            }
        },

        async getQueueLengths(): Promise<Record<GameType, Record<ProblemDifficulty, number>>> {
            const gameTypes = Object.values(GameType);
            const difficulties = Object.values(ProblemDifficulty);

            const result = {} as Record<GameType, Record<ProblemDifficulty, number>>;
            for (const gameType of gameTypes) {
                result[gameType] = {} as Record<ProblemDifficulty, number>;
                for (const difficulty of difficulties) {
                    result[gameType][difficulty] = await stateRedis.llen(QUEUE_KEY(gameType, difficulty));
                }
            }

            return result;
        },

        // MATCH FORMATION SECTION
        async _tryFormMatch(
            queueKey: string,
            gameType: GameType,
            difficulty: ProblemDifficulty
        ): Promise<{ status: 'queued' } | { status: 'matched'; gameId: string }> {
            const required = REQUIRED_PLAYERS[gameType];

            const results = (await stateRedis.eval(
                POP_AND_MATCH_SCRIPT,
                1,
                queueKey,
                String(required)
            )) as unknown as string[] | null;

            if (!results || results.length === 0) {
                return { status: 'queued' };
            }

            const resolvedPlayers = await Promise.all(
                results.map(async (raw): Promise<MatchedPlayer[] | null> => {
                    const parsed = parseJson<QueueEntry>(raw);

                    if (isPartyEntry(parsed)) {
                        const party = await getPrisma().party.findUnique({
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

                    if ('userId' in parsed) {
                        return [{ userId: parsed.userId }];
                    }

                    return null;
                })
            );

            const players = resolvedPlayers.flat().filter(isMatchedPlayer);

            // If a dropped party left us short, re-queue valid players and abort.
            if (players.length < required) {
                for (const player of players) {
                    const reEntry = player.partyId
                        ? JSON.stringify({ partyId: player.partyId, joinedAt: Date.now() } satisfies PartyQueueEntry)
                        : JSON.stringify({ userId: player.userId, joinedAt: Date.now() } satisfies SoloQueueEntry);
                    await stateRedis.lpush(queueKey, reEntry);
                }
                return { status: 'queued' };
            }

            const gameRoom = await this._createGameInDB(players, gameType, difficulty);
            const gameId = gameRoom.id;

            void warmVm(gameId);
            await this._notifyPlayers(gameRoom);

            return { status: 'matched', gameId };
        },

        async _formPartyGame(
            partyId: string,
            gameType: GameType,
            difficulty: ProblemDifficulty
        ): Promise<{ status: 'matched'; gameId: string } | { error: 'party_not_found' | 'party_not_full' }> {
            const party = await getPrisma().party.findUnique({
                where: { id: partyId },
                include: { owner: true, member: true },
            });

            if (!party) {
                return { error: 'party_not_found' };
            }
            if (!party.member) {
                return { error: 'party_not_full' };
            }

            const players: MatchedPlayer[] = [
                { userId: party.owner.id, partyId },
                { userId: party.member.userId, partyId },
            ];

            const gameRoom = await this._createGameInDB(players, gameType, difficulty);
            const gameId = gameRoom.id;

            void warmVm(gameId);
            await this._notifyPlayers(gameRoom);

            return { status: 'matched', gameId };
        },

        async _notifyPlayers(gameRoom: GameRoomWithTeams): Promise<void> {
            for (const team of gameRoom.teams) {
                for (const teamPlayer of team.players) {
                    const socketId = await stateRedis.get(`socket:${teamPlayer.userId}`);
                    if (socketId) {
                        io.to(socketId).emit('matchFound', { gameId: gameRoom.id });
                    }
                }
            }
        },

        async _createGameInDB(
            players: MatchedPlayer[],
            gameType: GameType,
            difficulty: ProblemDifficulty
        ): Promise<GameRoomWithTeams> {
            const prisma = getPrisma();

            const problems = await prisma.problem.findMany({
                where: { difficulty },
                select: { id: true },
            });

            if (problems.length === 0) {
                throw new Error(`No problems found for difficulty: ${difficulty}`);
            }

            const randomProblem = problems[Math.floor(Math.random() * problems.length)];

            const teamGroups: MatchedPlayer[][] = [];
            for (let i = 0; i < players.length; i += 2) {
                const group = players.slice(i, i + 2);
                if (group.length < 2) {
                    throw new Error(`Invalid team group at index ${i} with ${group.length} player(s)`);
                }
                teamGroups.push(group);
            }

            console.log('teamGroups:', JSON.stringify(teamGroups, null, 2));

            const roomId = nanoid(8);
            return prisma.gameRoom.create({
                data: {
                    id: roomId,
                    gameType,
                    problem: {
                        connect: { id: randomProblem.id },
                    },
                    teams: {
                        create: teamGroups.map((group) => ({
                            players: {
                                create: group.map((player, index) => ({
                                    userId: player.userId,
                                    role: index === 0 ? Role.CODER : Role.TESTER,
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
        },
    };
}

export type MatchmakingService = ReturnType<typeof createMatchmakingService>;