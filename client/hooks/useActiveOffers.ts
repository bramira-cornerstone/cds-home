import { useCallback, useEffect, useState } from "react";
import {
  fetchAllActiveOffers,
  getHighestOfferForToken,
  formatOfferPrice,
  type ActiveOffer,
} from "@/lib/activeOffers";

export function useActiveOffers(tokenId?: string | number | null) {
  const [offers, setOffers] = useState<ActiveOffer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const allOffers = await fetchAllActiveOffers();
      setOffers(allOffers);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch offers";
      setError(errorMessage);
      console.error("[useActiveOffers] Error:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOffers();
  }, [loadOffers]);

  const tokenIdStr = tokenId ? String(tokenId) : null;
  const highestOfferForToken = tokenIdStr
    ? getHighestOfferForToken(offers, tokenIdStr)
    : null;

  const formattedHighestOffer = highestOfferForToken
    ? formatOfferPrice(
        highestOfferForToken.totalPrice,
        highestOfferForToken.currency,
      )
    : null;

  return {
    offers,
    highestOfferForToken,
    formattedHighestOffer,
    isLoading,
    error,
    refetch: loadOffers,
  };
}
