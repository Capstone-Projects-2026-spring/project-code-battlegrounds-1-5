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

  // Initialize socket once when the user session is available
  useEffect(() => {
    if (!session?.user.id) return;
    if (!socket) return;

    socket.emit("register", { userId: session.user.id });

    const matchFoundHandler = ({ gameId: id }: { gameId: string }) => {
      router.push(`/game/${id}`);
      setStatus("matched");
      setGameId(id);
    };

    const queueStatusHandler = ({ status: qs, error }: { status: QueueStatus; error?: string }) => {
      if (error) { setStatus("error"); return; }
      if (qs === "queued") setStatus("queued");
      if (qs === "matched") setStatus("matched");
    };
    
    const handleReceiveQueueSelection = ({ gameType, difficulty }: { gameType: GameType; difficulty: ProblemDifficulty }) => {
      setGameType(gameType);
      setDifficulty(difficulty);
    };

    const handlePartySearchUpdate = ({ state }: { state: QueueStatus }) => {
      setStatus(state);
    };

    socket.on("matchFound", matchFoundHandler);
    socket.on("queueStatus", queueStatusHandler);
    socket.on("receiveQueueSelection", handleReceiveQueueSelection);
    socket.on("partySearchUpdate", handlePartySearchUpdate);


    return () => {
      socket.off("matchFound", matchFoundHandler);
      socket.off("queueStatus", queueStatusHandler);
      socket.off("receiveQueueSelection", handleReceiveQueueSelection);
      socket.off("partySearchUpdate", handlePartySearchUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user.id, socket]);

  const v: MatchmakingContextAPI = {
    status,
    setStatus,
    gameType,
    setGameType,
    difficulty,
    setDifficulty,
    gameId,
    setGameId,
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