import { GameType } from "@prisma/client";
import {
  createContext,
  Dispatch,
  useContext,
  useState,
  type ReactNode,
  type SetStateAction,
} from "react";
import { type Socket } from "socket.io-client";

export interface GameStateContextAPI {
  socket: Socket | undefined,
  setSocket: Dispatch<SetStateAction<Socket | undefined>>,

  teamId: string | undefined,
  setTeamId: Dispatch<SetStateAction<string | undefined>>
  gameId: string | undefined,
  setGameId: Dispatch<SetStateAction<string | undefined>>

  gameType: GameType | undefined
  setGameType: Dispatch<SetStateAction<GameType | undefined>>,

  code: string | undefined;
  setCode: Dispatch<SetStateAction<string | undefined>>;
}

export const GameStateContext = createContext<GameStateContextAPI | null>(null);

export const GameStateProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket>();
  const [teamId, setTeamId] = useState<string>();
  const [gameId, setGameId] = useState<string>();
  const [gameType, setGameType] = useState<GameType>();
  const [code, setCode] = useState<string>();

  const v: GameStateContextAPI = {
    socket,
    setSocket,
    teamId,
    setTeamId,
    gameId,
    setGameId,
    gameType,
    setGameType,
    code,
    setCode
  };

  return (
    <GameStateContext.Provider value={v}>
      {children}
    </GameStateContext.Provider>
  );
};

export function useGameState() {
  const ctx = useContext(GameStateContext);
  if (!ctx) {
    throw new Error("useGameState must be used within a GameStateProvider");
  }

  return ctx;
}
