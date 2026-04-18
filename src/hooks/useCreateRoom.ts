import { useState } from "react";
import { GameType } from "@prisma/client";

type DifficultyType = "EASY" | "MEDIUM" | "HARD";

interface CreateRoomResult {
  success: boolean;
  gameId?: string;
  error?: string;
}

export function useCreateRoom() {
  const [isLoading, setIsLoading] = useState(false);

  const createRoom = async (
    difficulty: DifficultyType,
    gameType: GameType,
  ): Promise<CreateRoomResult> => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/rooms/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ difficulty, gameType }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          gameId: data.gameId,
        };
      } else {
        return {
          success: false,
          error: data.message || "Failed to create game room",
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Network error. Please try again. ${error}`,
      };
    } finally {
      setIsLoading(false);
    }
  };

  return { createRoom, isLoading };
}
