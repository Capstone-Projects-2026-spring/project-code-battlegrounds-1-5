import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { usePostHog } from "posthog-js/react";

interface GameTimerProps {
  endTime: number;
  onExpire?: () => void;
}

export default function GameTimer({ endTime, onExpire }: GameTimerProps) {
  const posthog = usePostHog();
  const [timeRemaining, setTimeRemaining] = useState<number>(() =>
    Math.max(0, endTime - Date.now())
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const remaining = Math.max(0, endTime - Date.now());
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        onExpire?.();
        posthog.capture("timer_expired");
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endTime]);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <Text size="xl" fw={700}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </Text>
  );
}