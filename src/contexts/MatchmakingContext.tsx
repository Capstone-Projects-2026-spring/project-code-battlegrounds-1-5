import {
  createContext,
  useContext,
  useEffect,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import { GameType, ProblemDifficulty } from "@prisma/client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/router";
import { useParty } from "./PartyContext";
import { useSocket } from "./SocketContext";


export type QueueStatus = "idle" | "queued" | "matched" | "error";

export interface MatchmakingContextAPI {
  status: QueueStatus;
  setStatus: Dispatch<SetStateAction<QueueStatus>>;

  gameType: GameType;
  setGameType: Dispatch<SetStateAction<GameType>>;

  difficulty: ProblemDifficulty;
  setDifficulty: Dispatch<SetStateAction<ProblemDifficulty>>;

  gameId: string | undefined;
  setGameId: Dispatch<SetStateAction<string | undefined>>;

  activeTab: string;
  setActiveTab: Dispatch<SetStateAction<string>>;
}

export const MatchmakingContext = createContext<MatchmakingContextAPI | null>(null);

export const MatchmakingProvider = ({ children }: { children: ReactNode }) => {
  const { data: session } = authClient.useSession();

  const router = useRouter();

  const { socket } = useSocket();
  const [status, setStatus] = useState<QueueStatus>("idle");
  const [gameType, setGameType] = useState<GameType>(GameType.TWOPLAYER);
  const [difficulty, setDifficulty] = useState<ProblemDifficulty>(ProblemDifficulty.MEDIUM);
  const [gameId, setGameId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState<string>("create-game");

  // Initialize socket once when the user session is available
  useEffect(() => {
    if (!session?.user.id) return;
    if (!socket) return;
    if (!router.isReady) return;

    socket.emit("checkInGame", { userId: session.user.id });

    socket.emit("checkInGame", { userId: session.user.id });

    // Check on every route change
    const handleRouteChangeStart = (url: string) => {
      // Don't intercept if already navigating to a game route
      if (url.startsWith("/game/")) return;
      socket.emit("checkInGame", { userId: session.user.id });
    };

    router.events.on("routeChangeStart", handleRouteChangeStart);

    const handleInGame = ({ gameId }: { gameId: string }) => {
      setStatus("matched");
      setGameId(gameId);
      router.replace(`/game/${gameId}`);
    };

    const handleCreatedRoomFromhost = (({ gameId: id }: { gameId: string }) => {
      setStatus("matched");
      router.replace(`/game/${id}`);
      setGameId(id);
    });

    const matchFoundHandler = ({ gameId: id }: { gameId: string }) => {
      router.replace(`/game/${id}`);
      setStatus("matched");
      setGameId(id);
    };

    const queueStatusHandler = ({ status: qs, error }: { status: QueueStatus; error?: string }) => {
      if (error) { setStatus("error"); return; }
      if (qs === "queued") setStatus("queued");
      if (qs === "matched") setStatus("matched");
    };

    const handleReceiveQueueSelection = ({ gameType, difficulty, activeTab }: { gameType: GameType; difficulty: ProblemDifficulty; activeTab: string }) => {
      setGameType(gameType);
      setDifficulty(difficulty);
      setActiveTab(activeTab);
    };

    const handlePartySearchUpdate = ({ state }: { state: QueueStatus }) => {
      setStatus(state);
    };

    socket.on("matchFound", matchFoundHandler);
    socket.on("queueStatus", queueStatusHandler);
    socket.on("receiveQueueSelection", handleReceiveQueueSelection);
    socket.on("partySearchUpdate", handlePartySearchUpdate);
    socket.on("createdRoomFromHost", handleCreatedRoomFromhost);
    socket.on("inGame", handleInGame);


    return () => {
      socket.off("matchFound", matchFoundHandler);
      socket.off("queueStatus", queueStatusHandler);
      socket.off("receiveQueueSelection", handleReceiveQueueSelection);
      socket.off("partySearchUpdate", handlePartySearchUpdate);
      socket.off("createdRoomFromHost", handleCreatedRoomFromhost);
      socket.off("inGame", handleInGame);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, socket, router.isReady]);

  const v: MatchmakingContextAPI = {
    status,
    setStatus,
    gameType,
    setGameType,
    difficulty,
    setDifficulty,
    gameId,
    setGameId,
    activeTab,
    setActiveTab
  };

  return (
    <MatchmakingContext.Provider value={v}>
      {children}
    </MatchmakingContext.Provider>
  );
};

export function useMatchmaking() {
  const ctx = useContext(MatchmakingContext);
  if (!ctx) throw new Error("useMatchmaking must be used within a MatchmakingProvider");
  return ctx;
}