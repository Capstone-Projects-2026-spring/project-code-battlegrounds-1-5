const { GameType } = require("@prisma/client");
const { getPrisma } = require("../../prisma");
const { validate } = require("../../utils/validate");
const { deleteVm } = require("../../utils/vm/deleteVm");
const { submitCodeSchema } = require("../models/submitCode");

const prisma = getPrisma();

function registerExecutionHandlers(io, socket, gameService) {

    socket.on('submitCode', async (data) => {
        const payload = validate(submitCodeSchema, data);
        if (!payload) {
            socket.emit('error', { message: 'Invalid payload for submitCode.' });
            return;
        }
        const { roomId, code, type, team, teamId, testCases, runIDs } = payload;

        if (!roomId) return;

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
                    gameId: roomId,
                    language: "javascript",
                    code: btoa(code),
                    testCases: JSON.stringify(testCases),
                    runIDs: JSON.stringify(runIDs)
                };
                // console.log(JSON.stringify(payload));
                const res = await fetch(`${process.env.EXECUTOR_ADDR}/execute`, {
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
                // deletes vm after game is over
                deleteVm(roomId);
                io.to(roomId).emit('gameEnded');
            }
        }
        else if (type === GameType.FOURPLAYER) {
            console.log('verify its a fourplayer game');
            if (!team) {
                socket.emit('error', { message: 'Missing team for four-player submitCode.' });
                return;
            }

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
                        gameId: roomId,
                        language: "javascript",
                        code: btoa(code),
                        testCases: JSON.stringify(testCases),
                        runIDs: JSON.stringify(runIDs)
                    };
                    // console.log(JSON.stringify(payload));
                    const res = await fetch(`${process.env.EXECUTOR_ADDR}/execute`, {
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
                    // deletes vm after game is over
                    deleteVm(roomId);
                    await gameService.deleteGameData(submissionKey);
                }
            } else {
                // First team submitted - notify waiting (only to that team)
                console.log('First team submitted, waiting for other team');
                if (teamId) {
                    io.to(teamId).emit('waitingForOtherTeam');
                }
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
    socket.on("submitTestCases", async (data) => {
        const {
            roomId,
            code,
            testCases,
            runIDs
        } = data;
        let payload = {
            gameId: roomId,
            language: "javascript",
            code: btoa(code),
            testCases: JSON.stringify(testCases),
            runIDs: JSON.stringify(runIDs)
        };
        // console.log(JSON.stringify(payload));

        try {
            const res = await fetch(`${process.env.EXECUTOR_ADDR}/execute`, {
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
        } catch (error) {
            console.error(error);
            socket.emit("errorTests", { message: "Sorry that didn't work try again in a few seconds"});
        }
    });
}

module.exports = { registerExecutionHandlers };