import { useCallback, useEffect, useState } from "react";
import {
  fetchAllAuctionsFromEvents,
  type ActiveAuction,
} from "@/lib/activeAuctionsFromEvents";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export function useActiveAuctions() {
  const [auctions, setAuctions] = useState<ActiveAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAuctions() {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelled) return;

        try {
          setLoading(true);
          setError(null);
          const allAuctions = await fetchAllAuctionsFromEvents();
          if (cancelled) return;

          setAuctions(allAuctions);
          setError(null);
          return;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));

          if (attempt < MAX_RETRIES) {
            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
          }
        }
      }

      if (cancelled) return;

      // All retries failed
      setError(
        lastError?.message || "Failed to load auctions after multiple retries",
      );
      setAuctions([]);
    }

    setLoading(true);
    fetchAuctions().finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  return { auctions, loading, error, refetch };
}
