import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";

interface Props {
  startedAt: number;
  duration: number;
  onExpire?: () => void;
}

export default function GameTimer({ startedAt, duration, onExpire }: Props) {
  const [timeLeft, setTimeLeft] = useState<number>(duration);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(
        duration - (Date.now() - startedAt),
        0
      );

      setTimeLeft(remaining);

      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        onExpire?.();
      }
    };

    updateTimer();
    intervalRef.current = setInterval(updateTimer, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [startedAt, duration]);

  const minutes = Math.floor(timeLeft / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);

  return (
    <Text size="xl" fw={700}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </Text>
  );
}