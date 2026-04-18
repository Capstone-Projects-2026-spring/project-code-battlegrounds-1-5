import { Box, Center, Text } from '@mantine/core';
import { useRouter } from 'next/router';
import { useEffect, useState, useRef } from 'react';
import { usePostHog } from 'posthog-js/react';

import TeamSelect from "@/components/TeamSelect";
import { TeamCount } from "@/components/TeamSelect";
import type { ActiveProblem } from "@/components/ProblemBox";
import EnteringBattleground from "@/components/gameRoom/EnteringBattleground";
import GameStateScreen from "@/components/gameRoom/GameStateScreen";
import GameWorkspace from "@/components/gameRoom/GameWorkspace";
import SpectatorControls from "@/components/gameRoom/SpectatorControls";
import WaitingForOtherTeamModal from "@/components/gameRoom/WaitingForOtherTeamModal";
import { showRoleSwapWarning } from "@/components/notifications";

import { Role, GameStatus, GameType } from "@prisma/client";
import { authClient } from "@/lib/auth-client";
import {
  DEFAULT_TEST_CASES,
  GameTestCasesProvider,
  TestableCase,
  useTestCases,
} from "@/contexts/GameTestCasesContext";
import {
  GameStateProvider,
  useGameState,
} from "@/contexts/GameStateContext";
import {
  GameRoomProvider,
  type GameRoomContextAPI,
} from "@/contexts/GameRoomContext";
import { useSocket } from '@/contexts/SocketContext';
import { useMatchmaking } from '@/contexts/MatchmakingContext';

interface RoomDetailsResponse {
  problem: ActiveProblem;
  gameType: GameType;
  status: GameStatus;
  teams: TeamCount[];
  teamId: string | null;
  role: Role | null;
}

const DEFAULT_STARTER_CODE = "function solution(a, b) { \n\treturn a + b;\n}";

// interface TestCase {
//   id: string
//   content: string
// }

export default function Page() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  // Early auth check to prevent loading all the heavy stuff
  // if we aren't even logged in
  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  if (isPending) {
    return <EnteringBattleground />;
  }

  return (
    <GameStateProvider>
      <GameTestCasesProvider>
        <PlayGameRoom />
      </GameTestCasesProvider>
    </GameStateProvider>
  );
}

function PlayGameRoom() {
  // 1. Grab the ID from the URL (e.g., "624")
  const router = useRouter();
  const gameId = router.query.gameID as string;
  const { data: session } = authClient.useSession();
  const posthog = usePostHog();

  // 2. Set up our game state and the user's role
  const [role, setRole] = useState<Role | null>(null);
  const [gameState, setGameState] = useState<GameStatus>(GameStatus.WAITING);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<ActiveProblem | null>(null);
  const [teams, setTeams] = useState<TeamCount[]>([]);
  const [teamSelected, setTeamSelected] = useState<string | null>(null);
  const [liveCode, setLiveCode] = useState<string>(DEFAULT_STARTER_CODE);
  const [gameType, setGameType] = useState<GameType | null>(null);
  const [isWaitingForOtherTeam, setIsWaitingForOtherTeam] = useState(false);

  // Context <3
  const testCaseCtx = useTestCases();
  const gameStateCtx = useGameState();
  const { socket } = useSocket();
  const { setStatus } = useMatchmaking();

  const [spectatorView, setSpectatorView] = useState<Role>(Role.SPECTATOR);

  const endTimeRef = useRef<number | null>(null);
  const [endTime, setEndTime] = useState(0);
  const [isProblemVisible, setIsProblemVisible] = useState(true);
  const toggleProblemVisibility = () => setIsProblemVisible((prev) => !prev);

  const isSpectator = role === Role.SPECTATOR;

  const handleTimerExpire = () => {
    if (!socket || !gameType || !teamSelected) return;
    const team = getTeamLabel();
    setIsWaitingForOtherTeam(true);
    const indexes = Array.from(
      { length: testCaseCtx.cases.length }, (_, i) => i);

    const codeToSubmit = gameStateCtx.code || liveCode || "";

    console.log("Timer expired - submitting code:", {
      liveCode,
      gameStateCtxCode: gameStateCtx.code,
      codeToSubmit,
      teamSelected,
      gameId,
    });

    socket.emit("submitCode", {
      roomId: gameId,
      code: codeToSubmit,
      type: gameType,
      team,
      teamId: teamSelected,
      testCases: testCaseCtx.cases,
      runIDs: indexes,
    });
  };

  // ONLY HAPPENS ON PAGE LAUNCH
  useEffect(() => {
    if (!session?.user.id || !gameId || !socket) return;

    gameStateCtx.setGameId(gameId);

    const loadRoomDetails = async () => {
      try {
        const response = await fetch(`/api/rooms/${gameId}/${session.user.id}`);
        if (!response.ok) {
          // Game room doesn't exist or user isn't authorized — send them home
          router.replace("/");
          return;
        }
        const data = (await response.json()) as RoomDetailsResponse;

        // If the game is already finished, send straight to results
        if (data.status === GameStatus.FINISHED) {
          router.replace(`/results/${gameId}`);
          return;
        }

        setProblem(data.problem as ActiveProblem);
        setGameType(data.gameType as GameType);
        setTeams(data.teams as TeamCount[]);
        if (data.teamId) setTeamSelected(data.teamId as string);
        if (data.role) setRole(data.role as Role);
        console.log("Fetched room details:", data);

        if (
          data.gameType === GameType.TWOPLAYER &&
          !data.teamId &&
          !data.role
        ) {
          // Auto-join team if it's a 2 player game and the user isn't assigned to a team yet
          const teamId = data.teams[0]?.teamId;
          if (teamId) {
            const res = await fetch(`/api/team/join`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                userId: session.user.id,
                teamId,
                gameRoomId: gameId,
              }),
            });
            if (res.ok) {
              const joined = await res.json();
              setTeamSelected(teamId);
              setRole(joined.role);
            }
          }
        }
        setLoading(false);
      } catch (error) {
        console.error("Failed to load room problem", error);
        router.replace("/");
      }
    };
    loadRoomDetails();

    // 3. Initialize the connection to our custom server.js backend

    const teamUpdatedHandler = ({ teamId, playerCount }: { teamId: string; playerCount: number }) => {
      setTeams((prev) => prev.map((t) => (t.teamId === teamId ? { ...t, playerCount } : t)));
    };

    const invalidGameHandler = () => {
      router.replace('/');
    };

    const errorHandler = (data: JSON) => {
      console.error("Socket error:", data);
    };

    // This is so if another person picks while someone is deciding
    socket.on("teamUpdated", teamUpdatedHandler);

    socket.on('invalidGame', invalidGameHandler);
    socket.on("error", errorHandler);

    // 6. Cleanup: disconnect the socket if the user leaves the page
    return () => {
      socket.off("teamUpdated", teamUpdatedHandler);
      socket.off('invalidGame', invalidGameHandler);
      socket.off("error", errorHandler);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, session?.user.id]);

  useEffect(() => {
    if (!socket || !teamSelected) return;
    // Emit the default test cases ONCE to the socket
    // so that they're at least synced and ready to go should somebody
    // hit the run button or attempt to make a new case.
    console.log("Syncing default test cases :3");
    socket.emit("updateTestCases", {
      teamId: teamSelected,
      testCases: DEFAULT_TEST_CASES,
    });

    console.log("Syncing default code");
    socket.emit("codeChange", { teamId: teamSelected, code: DEFAULT_STARTER_CODE });
  }, [socket, teamSelected]);

  useEffect(() => {
    // Runs after team gets selected - join rooms first, then set up room-specific listeners
    if (!socket || !teamSelected || !gameId || !gameType) return;
    socket.emit("joinGame", { gameId, teamId: teamSelected, gameType });
    gameStateCtx.setGameType(gameType);

    // Set up game room event listeners AFTER joining the room
    const handleGameStarting = () => {
      posthog.capture("game_spectated", { gameId });
      setGameState(GameStatus.STARTING);
    };

    const handleGameStarted = ({ start }: { start: number }) => {
      if (isNaN(start)) return;
      posthog.capture("game_started", { gameId });
      if (!endTimeRef.current) {
        endTimeRef.current = Date.now() + Number(start);
        setEndTime(endTimeRef.current);
      }
      setGameState(GameStatus.ACTIVE);
    };

    const handleGameEnded = () => {
      posthog.capture("game_ended", { gameId });
      setIsWaitingForOtherTeam(false);
      setGameState(GameStatus.FINISHED);
      setStatus("idle"); // reset matchmaking status so players can queue again from results page
      router.push(`/results/${gameId}`);
    };

    const handleRoleSwapWarning = () => {
      if (role) {
        showRoleSwapWarning(role);
      } else {
        showRoleSwapWarning(Role.SPECTATOR);
      }
    };

    const handleRoleSwapping = () => {
      setGameState(GameStatus.FLIPPING);
    };

    const handleRoleSwap = () => {
      setGameState(GameStatus.ACTIVE);
      setRole((prev) =>
        prev === Role.SPECTATOR
          ? Role.SPECTATOR
          : prev === Role.CODER
            ? Role.TESTER
            : Role.CODER,
      );
    };

    const handleWaitingForOtherTeam = () => {
      setIsWaitingForOtherTeam(true);
    };

    socket.on("gameStarting", handleGameStarting);
    socket.on("gameStarted", handleGameStarted);
    socket.on("gameEnded", handleGameEnded);
    socket.on("roleSwapWarning", handleRoleSwapWarning);
    socket.on("roleSwapping", handleRoleSwapping);
    socket.on("roleSwap", handleRoleSwap);
    socket.on("waitingForOtherTeam", handleWaitingForOtherTeam);

    return () => {
      socket.off("gameStarting", handleGameStarting);
      socket.off("gameStarted", handleGameStarted);
      socket.off("gameEnded", handleGameEnded);
      socket.off("roleSwapWarning", handleRoleSwapWarning);
      socket.off("roleSwapping", handleRoleSwapping);
      socket.off("roleSwap", handleRoleSwap);
      socket.off("waitingForOtherTeam", handleWaitingForOtherTeam);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, teamSelected, gameId, gameType, role]);

  useEffect(() => {
    if (!socket || !role || !teamSelected) return;
    socket.emit("requestCodeSync", { teamId: teamSelected });
    socket.emit("requestTestCaseSync", { teamId: teamSelected });

    const testHandler = (cases: TestableCase[] | null) => {
      console.log("Receiving test case sync!", cases);
      if (Array.isArray(cases)) {
        testCaseCtx.setCases(cases);
      } else {
        console.warn("Ignoring invalid test case payload from server:", cases);
      }
    };
    socket.on("receiveTestCaseSync", testHandler);

    const handler = (newCode: string) => {
      setLiveCode(newCode);
      // must also set code in game state otherwise coder cant run their test cases
      gameStateCtx.setCode(newCode);
    };
    socket.on("receiveCodeUpdate", handler);

    return () => {
      socket.off("receiveTestCaseSync", testHandler);
      socket.off("receiveCodeUpdate", handler);
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, role, teamSelected]);

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined && role === Role.CODER && socket) {
      setLiveCode(value);
      socket.emit("codeChange", { teamId: teamSelected, code: value });
      gameStateCtx.setCode(value);
    }
  };

  const getTeamLabel = () => {
    if (!teamSelected) return null;
    const teamIndex = teams.findIndex((team) => team.teamId === teamSelected);
    if (teamIndex === 0) return "team1";
    if (teamIndex === 1) return "team2";
    return null;
  };

  const submitFinalCode = () => {
    //Send bother Coder and Tester to the results page
    //Store submission and evaluate results on the backend
    //server broadcasts the event to both player
    if (!socket || !gameType || !teamSelected) return; //make sure the socket is connected before emitting
    const team = getTeamLabel();
    setIsWaitingForOtherTeam(true);
    const indexes = Array.from(
      { length: testCaseCtx.cases.length },
      (_, i) => i,
    );

    socket.emit("submitCode", {
      roomId: gameId,
      code: gameStateCtx.code,
      type: gameType,
      team,
      teamId: teamSelected,
      testCases: testCaseCtx.cases,
      runIDs: indexes,
    });
  };

  // --- RENDERING LOGIC ---
  // State A: Still connecting to the WebSocket server
  if (!socket || loading) {
    return <EnteringBattleground />;
  }

  if (!teamSelected && role !== Role.SPECTATOR) {
    return (
      <TeamSelect
        userId={session?.user.id as string}
        teams={teams}
        gameRoomId={gameId}
        onJoined={(teamId, role, playerCount) => {
          setTeamSelected(teamId);
          setRole(role); // TODO: add localStorage persistence
          if (role === Role.SPECTATOR) {
            setGameState(GameStatus.ACTIVE);
          }
          socket.emit("requestTeamUpdate", { teamId, playerCount });
        }}
      />
    );
  }

  if (gameState === GameStatus.STARTING) {
    return (
      <GameStateScreen
        message="Starting in 3...2...1...Battle!"
        roomId={gameId}
        testId="waiting-for-second"
      />
    );
  }

  if (gameState === GameStatus.WAITING) {
    return (
      <GameStateScreen
        message="Waiting for another player to join..."
        roomId={gameId}
        testId="waiting-for-second"
      />
    );
  }

  const effectiveRole =
    isSpectator && spectatorView !== Role.SPECTATOR ? spectatorView : role;
  const showGameUI = !isSpectator || spectatorView !== Role.SPECTATOR;

  const gameRoomContextValue: GameRoomContextAPI = {
    role,
    gameState,
    problem,
    teams,
    teamSelected,
    liveCode,
    isWaitingForOtherTeam,
    isProblemVisible,
    endTime,
    isSpectator,
    effectiveRole,
    showGameUI,
    userName: session?.user.name ?? "Unknown",
    toggleProblemVisibility,
    onSelectSpectatorView: (selectedTeamId, roleView) => {
      setTeamSelected(selectedTeamId);
      setSpectatorView(roleView);
    },
    onExitSpectatorView: () => {
      setTeamSelected(null);
      setSpectatorView(Role.SPECTATOR);
    },
    onRunCodeClick: () => posthog.capture("code_run_triggered", { gameId }),
    handleEditorChange,
    submitFinalCode,
    handleTimerExpire,
  };

  return (
    <GameRoomProvider value={gameRoomContextValue}>
      <Box style={{ position: "relative", height: "100vh" }}>
        <WaitingForOtherTeamModal />

        {isSpectator && <SpectatorControls />}

        {isSpectator && spectatorView === Role.SPECTATOR && (
          <Center h="100vh">
            <Text data-testid="spectating-words" size="xl" c="dimmed">
              The room is full. You are spectating.
            </Text>
          </Center>
        )}

        {showGameUI && <GameWorkspace />}
      </Box>
    </GameRoomProvider>
  );
}
