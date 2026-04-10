import { useCallback, useEffect, useState } from "react";
import {
  fetchAllActiveListings,
  type ActiveListing,
} from "@/lib/activeListings";

export function useActiveListings() {
  const [listings, setListings] = useState<ActiveListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  useEffect(() => {
    async function fetchListings() {
      try {
        setLoading(true);
        setError(null);
        const allListings = await fetchAllActiveListings();
        setListings(allListings);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load listings",
        );
        setListings([]);
      } finally {
        setLoading(false);
      }
    }

    fetchListings();
  }, [refetchTrigger]);

  const refetch = useCallback(() => {
    setRefetchTrigger((prev) => prev + 1);
  }, []);

  return { listings, loading, error, refetch };
}
