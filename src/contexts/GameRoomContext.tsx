import type { Role, GameStatus } from "@prisma/client";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from "react";

import type { TeamCount } from "@/components/TeamSelect";
import type { ActiveProblem } from "@/components/ProblemBox";

export interface GameRoomContextAPI {
  gameId: string;
  role: Role | null;
  gameState: GameStatus;
  problem: ActiveProblem | null;
  teams: TeamCount[];
  teamSelected: string | null;
  code: string;
  setCode: Dispatch<SetStateAction<string>>;
  isWaitingForOtherTeam: boolean;
  isProblemVisible: boolean;
  endTime: number;
  isSpectator: boolean;
  effectiveRole: Role | null;
  showGameUI: boolean;
  userName: string;
  toggleProblemVisibility: () => void;
  onSelectSpectatorView: (
    teamId: string,
    roleView: Extract<Role, "CODER" | "TESTER">,
  ) => void;
  onExitSpectatorView: () => void;
  onRunCodeClick: () => void;
  submitFinalCode: () => void;
  handleTimerExpire: () => void;
}

const GameRoomContext = createContext<GameRoomContextAPI | null>(null);

interface GameRoomProviderProps {
  children: ReactNode;
  value: GameRoomContextAPI;
}

export function GameRoomProvider({
  children,
  value,
}: GameRoomProviderProps) {
  return (
    <GameRoomContext.Provider value={value}>
      {children}
    </GameRoomContext.Provider>
  );
}

export function useGameRoom() {
  const ctx = useContext(GameRoomContext);
  if (!ctx) {
    throw new Error("useGameRoom must be used within a GameRoomProvider");
  }

  return ctx;
}
