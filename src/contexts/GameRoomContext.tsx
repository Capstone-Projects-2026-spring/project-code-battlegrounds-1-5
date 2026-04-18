import type { Role, GameStatus } from "@prisma/client";
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from "react";

import type { TeamCount } from "@/components/TeamSelect";
import type { TestableCase } from "@/contexts/GameTestCasesContext";
import type { ActiveProblem } from "@/components/ProblemBox";
import type { ParameterType } from "@/lib/ProblemInputOutput";

export interface GameRoomContextAPI {
  role: Role | null;
  gameState: GameStatus;
  problem: ActiveProblem | null;
  teams: TeamCount[];
  teamSelected: string | null;
  liveCode: string;
  activeTestId: number;
  setActiveTestId: Dispatch<SetStateAction<number>>;
  isWaitingForOtherTeam: boolean;
  runningAllTests: boolean;
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
  handleEditorChange: (value: string | undefined) => void;
  submitFinalCode: () => void;
  addNewTest: () => void;
  removeTest: (testId: TestableCase["id"]) => void;
  handleNewParameter: (parameter: ParameterType) => void;
  handleParameterDelete: (parameter: ParameterType) => void;
  handleTestBoxChange: (testCase: TestableCase) => void;
  handleExpectedOutputTypeChange: (type: ParameterType["type"]) => void;
  handleRunAllTests: () => void;
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
