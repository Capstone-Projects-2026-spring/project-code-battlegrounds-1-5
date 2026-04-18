const { z } = require("zod");
const { GameType } = require("@prisma/client");
const { getPrisma } = require("../../prisma");
const { validate, getOrCreateTeamTestCases } = require("./utils");

const prisma = getPrisma();

const submitCodeSchema = z.object({
    roomId: z.string(),
    code: z.string().min(1).max(10000),
    type: z.enum([GameType.TWOPLAYER, GameType.FOURPLAYER]),
    team: z.enum(["team1", "team2"]).nullable().optional(),
    teamId: z.string(),
});

async function persistTeamGameTests(roomId, teamNumber, testCases) {
    const gameResult = await prisma.gameResult.upsert({
        where: { gameRoomId: roomId },
        update: {},
        create: { gameRoomId: roomId },
        select: { id: true },
    });

    const rows = testCases.map((testCase, position) => ({
        gameResultId: gameResult.id,
        teamNumber,
        position,
        testCaseId: typeof testCase.id === "number" ? testCase.id : position,
        functionInput: testCase.functionInput ?? [],
        expectedOutput: testCase.expectedOutput ?? null,
    }));

    await prisma.$transaction([
        prisma.gameTest.deleteMany({
            where: {
                gameResultId: gameResult.id,
                teamNumber,
            },
        }),
        ...(rows.length > 0 ? [prisma.gameTest.createMany({ data: rows })] : []),
    ]);
}

function registerExecutionHandlers(io, socket, gameService) {

    socket.on('submitCode', async (data) => {
        const payload = validate(submitCodeSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for submitCode.' });
            return;
        }
        const { roomId, code, type, team, teamId } = payload;

        if (!roomId) return;

        let testCases;
        try {
            testCases = await getOrCreateTeamTestCases(gameService, teamId);
        } catch (e) {
            console.error('Error preparing test cases for submitCode', e);
            socket.emit('error', { e, message: 'Failed to prepare test cases for submission.' });
            return;
        }

        const runIDs = testCases.map((testCase) => testCase.id);

        let teamNumber = 1;
        if (type === GameType.FOURPLAYER) {
            if (!team) {
                socket.emit('error', { message: 'Missing team for four-player submitCode.' });
                return;
            }
            teamNumber = team === "team2" ? 2 : 1;
        }

        try {
            await persistTeamGameTests(roomId, teamNumber, testCases);
        } catch (e) {
            console.error('Error persisting game tests for submitCode', e);
            socket.emit('error', { e, message: 'Failed to persist submitted test cases.' });
            return;
        }

        console.log('submitCode received for roomId:', roomId, 'with code length:', code?.length, 'and type:', type);

        if (type === GameType.TWOPLAYER) {
            console.log('verify its a twoplayer game');
            await prisma.gameResult.update({
                where: { gameRoomId: roomId },
                data: {
                    gameRoomId: roomId,
                    team1Code: code
                }
            });
            console.log('code submitted for two-player game');

            try {
                // Post results to the code executor
                let payload = {
                    language: "javascript",
                    code: btoa(code),
                    testCases: JSON.stringify(testCases),
                    runIDs: JSON.stringify(runIDs)
                };
                // console.log(JSON.stringify(payload));
                const res = await fetch("http://127.0.0.1:6969/execute", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload),
                });
                const json = await res.json();
                console.log(JSON.stringify(json));
            } catch (error) {
                console.error("Error POSTing to code executor:", error);
            } finally {
                await gameService.cleanupGameTimers(roomId);
                await prisma.gameRoom.update({
                    where: { id: roomId },
                    data: { status: 'FINISHED' },
                });
                io.to(roomId).emit('gameEnded');
            }
        }
        else if (type === GameType.FOURPLAYER) {
            console.log('verify its a fourplayer game');

            // Track submissions in Redis
            const submissionKey = `game:${roomId}:submissions`;
            const existingSubmissions = await gameService.getGameData(submissionKey);

            if (existingSubmissions && existingSubmissions[team]) {
                console.log(`Team ${team} already submitted, ignoring duplicate submission`);
                return;
            }

            // Store this team's code
            await prisma.gameResult.update({
                where: { gameRoomId: roomId },
                data: {
                    gameRoomId: roomId,
                    ...(team === "team1" ? { team1Code: code } : { team2Code: code })
                }
            });
            console.log(`code submitted for four-player game by ${team}`);

            // Track submission
            const updatedSubmissions = {
                ...(existingSubmissions || {}),
                [team]: true
            };
            await gameService.saveGameData(submissionKey, JSON.stringify(updatedSubmissions));

            // Check if both teams have submitted
            if (Object.keys(updatedSubmissions).length === 2) {
                // Both teams submitted - end game
                console.log('Both teams submitted, ending game');
                try {
                    // Post results to the code executor
                    let payload = {
                        language: "javascript",
                        code: btoa(code),
                        testCases: JSON.stringify(testCases),
                        runIDs: JSON.stringify(runIDs)
                    };
                    // console.log(JSON.stringify(payload));
                    const res = await fetch("http://127.0.0.1:6969/execute", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    const json = await res.json();
                    console.log(JSON.stringify(json));
                } catch (error) {
                    console.error("Error POSTing to code executor:", error);
                } finally {
                    await gameService.cleanupGameTimers(roomId);
                    await prisma.gameRoom.update({
                        where: { id: roomId },
                        data: { status: 'FINISHED' },
                    });
                    io.to(roomId).emit('gameEnded');
                    await gameService.deleteGameData(submissionKey);
                }
            } else {
                // First team submitted - notify waiting (only to that team)
                console.log('First team submitted, waiting for other team');
                io.to(teamId).emit('waitingForOtherTeam');
            }
        }
    });

    /**
     * data: object
     * data.gameId: string,
     * data.teamId: string,
     * data.code: string,
     * data.testCases: Array<TestableCase>
     * data.runIDs: Array<number> test case IDs to run
     * 
     * @see GameTestCasesContext#TestableCase
     */
    // TODO: should only send test cases needed. also, the model here needs updated to actually hook up (wtf does that mean??). additionally, this sends base64 for undefined, so somethings broke somewhere.
    socket.on("submitTestCases", async (data) => {
        const {
            code,
            testCases,
            runIDs
        } = data;
        let payload = {
            language: "javascript",
            code: btoa(code),
            testCases: JSON.stringify(testCases),
            runIDs: JSON.stringify(runIDs)
        };
        // console.log(JSON.stringify(payload));
        const res = await fetch("http://127.0.0.1:6969/execute", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const json = await res.json();

        // json.testCases should realistically only modify a single property
        // on the existing testCases object: `computedOutput`. Syncing this
        // back to the frontend is handled over there :)
        console.log(JSON.stringify(json, null, 2));

        /* 
          export interface TestableCase {
            id: number;
            functionInput: ParameterType[];
            expectedOutput: ParameterType;
            computedOutput?: string | null;
          }
        */

        const toReceive = [];
        for (const result of json.results) {
            const matched = testCases.find(t => t.id === result.id);
            if (!matched) continue;
            toReceive.push({
                id: matched.id,
                functionInput: matched.functionInput,
                expectedOutput: matched.expectedOutput,
                computedOutput: result.actual
            });
        }

        socket.emit("receiveTestCaseSync", toReceive);
    });
}

module.exports = { registerExecutionHandlers };