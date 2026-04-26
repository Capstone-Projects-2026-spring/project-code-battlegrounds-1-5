import { useEffect, useState } from "react";
import { type TestsResponse } from "@/pages/api/results/[gameId]";

interface UseGameResultsReturn {
  data: TestsResponse | null;
  loading: boolean;
  error: Error | null;
}

export function useGameResults(gameId: string | undefined): UseGameResultsReturn {
  const [data, setData] = useState<TestsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!gameId) return;

    let cancelled = false;

    const fetchGameResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/results/${gameId}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch game results: ${response.status}`);
        }
        const result = (await response.json()) as TestsResponse;
        if (!cancelled) {
          setData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchGameResults();

    return () => {
      cancelled = true;
    };
  }, [gameId]);

  return { data, loading, error };
}
