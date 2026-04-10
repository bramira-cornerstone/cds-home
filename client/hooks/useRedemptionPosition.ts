import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getRedemptionEventsRaw } from "@/lib/supabaseRedemptionEvents";

interface PositionData {
  position: number | null;
  rmvValue: number | null;
  loading: boolean;
  error: string | null;
}

export function useRedemptionPosition(
  editionId: number | null | undefined,
): PositionData {
  const account = useActiveAccount();
  const walletAddress = account?.address?.toLowerCase() ?? null;
  const [position, setPosition] = useState<number | null>(null);
  const [rmvValue, setRmvValue] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editionId || !walletAddress) {
      setLoading(false);
      setPosition(null);
      setRmvValue(null);
      return;
    }

    const fetchPosition = async () => {
      setLoading(true);
      setError(null);
      try {
        const events = await getRedemptionEventsRaw(editionId);

        if (!events || events.length === 0) {
          setPosition(null);
          setRmvValue(null);
          setLoading(false);
          return;
        }

        // Find the user's entry by wallet address
        const userEntry = events.find(
          (entry) =>
            entry.wallet_address &&
            entry.wallet_address.toLowerCase() === walletAddress,
        );

        if (!userEntry) {
          setPosition(null);
          setRmvValue(null);
        } else {
          // Calculate position based on ranking
          // Position is determined by highest rmv_redeemed (1st), then earliest timestamp for ties
          let userPosition = 1;
          for (const entry of events) {
            // If this entry is better than user's (higher rmv or same rmv but earlier)
            if (
              (entry.rmv_redeemed ?? 0) > (userEntry.rmv_redeemed ?? 0) ||
              ((entry.rmv_redeemed ?? 0) === (userEntry.rmv_redeemed ?? 0) &&
                entry.timestamp &&
                userEntry.timestamp &&
                new Date(entry.timestamp).getTime() <
                  new Date(userEntry.timestamp).getTime())
            ) {
              userPosition++;
            }
          }
          setPosition(userPosition);
          setRmvValue(userEntry.rmv_redeemed);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
        setPosition(null);
        setRmvValue(null);
      } finally {
        setLoading(false);
      }
    };

    fetchPosition();
  }, [editionId, walletAddress]);

  return { position, rmvValue, loading, error };
}
