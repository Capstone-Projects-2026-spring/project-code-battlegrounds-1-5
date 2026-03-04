import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";

interface Props {
  _timeRemaining: number;
  duration: number;
  onExpire?: () => void;
}

export default function GameTimer({ _timeRemaining, duration, onExpire }: Props) {
  const [timeRemaining, setTimeRemaining] = useState<number>(_timeRemaining);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const updateTimer = () => {
      const remaining = Math.max(
        timeRemaining - 1000,
        0
      );
      setTimeRemaining(timeRemaining - 1000)

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
  }, [_timeRemaining, duration]);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <Text size="xl" fw={700}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </Text>
  );
}