import { useEffect, useState } from "react";
import { getActiveRedemptions } from "@/lib/supabaseRedemptionEvents";

interface RedemptionEvent {
  token_id: string;
  timestamp: string;
}

export function useActiveRedemptions() {
  const [activeRedemptions, setActiveRedemptions] = useState<RedemptionEvent[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRedemptions = async () => {
      setLoading(true);
      const events = await getActiveRedemptions();
      const redemptionMap = events.map((event) => ({
        token_id: event.token_id,
        timestamp: event.timestamp,
      }));
      setActiveRedemptions(redemptionMap);
      setLoading(false);
    };

    fetchRedemptions();

    // Refresh every 30 seconds to keep the data fresh
    const interval = setInterval(fetchRedemptions, 30000);
    return () => clearInterval(interval);
  }, []);

  const isTokenRedeeming = (tokenId: string): boolean => {
    return activeRedemptions.some((r) => r.token_id === tokenId);
  };

  return { activeRedemptions, loading, isTokenRedeeming };
}
