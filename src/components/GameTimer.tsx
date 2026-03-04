import { useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";

interface Props {
  _timeRemaining: number; // milliseconds remaining when game starts
  duration: number; // total duration (ms) - kept for possible display/use
  onExpire?: () => void;
}

export default function GameTimer({ _timeRemaining, duration, onExpire }: Props) {
  const [timeRemaining, setTimeRemaining] = useState<number>(_timeRemaining || 0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef<number>(0);

  useEffect(() => {
    // ensure client has no repeated intervals
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // if time remaining isnt passed in somethings fucked up. bail out
    if (!_timeRemaining || _timeRemaining <= 0) {
      setTimeRemaining(0);
      return;
    }

    // find end time based on the remaining ms provided by server at join
    endTimeRef.current = Date.now() + _timeRemaining;
    setTimeRemaining(_timeRemaining);

    const tick = () => {
      const remaining = Math.max(0, endTimeRef.current - Date.now());
      setTimeRemaining(remaining);
      if (remaining <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = null;
        onExpire?.();
      }
    };

    // start an interval. note the 250ms. this is drift correction. we calculate the end time above then rely on systems date.now for time difference.
    tick();
    intervalRef.current = setInterval(tick, 250);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [_timeRemaining, onExpire]);

  const minutes = Math.floor(timeRemaining / 60000);
  const seconds = Math.floor((timeRemaining % 60000) / 1000);

  return (
    <Text size="xl" fw={700}>
      {minutes}:{seconds.toString().padStart(2, "0")}
    </Text>
  );
}