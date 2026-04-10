import { useEffect, useState, useCallback } from "react";
import { readContract } from "thirdweb";
import {
  fetchAllActiveListings,
  type ActiveListing,
} from "@/lib/activeListings";

export interface Listing {
  listingId: string;
  seller: string;
  assetContract: string;
  tokenId: string;
  quantity: string;
  pricePerToken: string;
  currency: string;
  listingType: "direct" | "auction";
  expirationTimestamp?: number;
  buyoutPricePerToken?: string;
  startTime?: number;
  endTime?: number;
  currentBid?: string;
  highestBidder?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  tokenType?: number;
  status?: number;
  reserved?: boolean;
  sellerAddress?: string;
  sellerUsername?: string | null;
  editionId?: number | null;
  serial?: number | null;
  low_ask?: string | null;
}

const INITIAL_PAGE_SIZE = 20;
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

export function useMarketplaceListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [allListings, setAllListings] = useState<Listing[]>([]);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchListings() {
      let lastError: Error | null = null;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        if (cancelled) return;

        try {
          setLoading(true);
          setError(null);

          console.log(
            "[useMarketplaceListings] Fetching active listings from contract",
          );
          const activeListings = await fetchAllActiveListings();

          if (cancelled) return;

          console.log(
            "[useMarketplaceListings] Got",
            activeListings.length,
            "active listings",
          );

          const formattedListings: Listing[] = activeListings.map(
            (listing: ActiveListing) => ({
              listingId: listing.listingId,
              seller: listing.sellerAddress,
              sellerAddress: listing.sellerAddress,
              sellerUsername: listing.sellerUsername,
              assetContract: "",
              tokenId: listing.tokenId,
              quantity: "1",
              pricePerToken: listing.pricePerToken,
              currency: listing.currency,
              listingType: listing.listingType,
              startTimestamp: listing.startTimestamp,
              endTimestamp: listing.endTimestamp,
              tokenType: 0,
              status: listing.status === "active" ? 1 : 0,
              reserved: false,
              editionId: listing.editionId,
              serial: listing.serial,
              low_ask: listing.low_ask,
            }),
          );

          setAllListings(formattedListings);
          setListings(formattedListings.slice(0, INITIAL_PAGE_SIZE));
          setHasMore(formattedListings.length > INITIAL_PAGE_SIZE);
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
      console.error("[useMarketplaceListings] Error after retries:", lastError);
      setError(
        lastError?.message || "Failed to load listings after multiple retries",
      );
      setListings([]);
      setAllListings([]);
      setHasMore(false);
    }

    setLoading(true);
    fetchListings().finally(() => {
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

  const loadMore = useCallback(() => {
    setListings((prev) => {
      const currentCount = prev.length;
      const nextBatch = allListings.slice(
        currentCount,
        currentCount + INITIAL_PAGE_SIZE,
      );
      const newListings = [...prev, ...nextBatch];
      setHasMore(newListings.length < allListings.length);
      return newListings;
    });
  }, [allListings]);

  return {
    listings,
    loading,
    error,
    refetch,
    hasMore,
    loadMore,
    totalCount: allListings.length,
  };
}

export function findListingByTokenId(
  listings: Listing[],
  tokenId: string | number,
): Listing | null {
  const tokenIdStr = String(tokenId);
  return listings.find((listing) => listing.tokenId === tokenIdStr) || null;
}

export async function getListing(
  contract: any,
  listingId: string,
): Promise<Listing | null> {
  if (!contract) return null;

  try {
    const result = await readContract({
      contract,
      method:
        "function getListing(uint256 listingId) returns (tuple(uint256 listingId, address seller, address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, uint128 expirationTimestamp, bool reserved))",
      params: [BigInt(listingId)],
    });

    if (result) {
      return {
        listingId: String(result.listingId),
        seller: result.seller,
        assetContract: result.assetContract,
        tokenId: String(result.tokenId),
        quantity: String(result.quantity),
        pricePerToken: String(result.pricePerToken),
        currency: result.currency,
        listingType: "direct",
        expirationTimestamp: Number(result.expirationTimestamp),
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function getAuction(
  contract: any,
  auctionId: string,
): Promise<Listing | null> {
  if (!contract) return null;

  try {
    const result = await readContract({
      contract,
      method:
        "function getAuction(uint256 auctionId) returns (tuple(uint256 auctionId, address seller, address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 minimumBidAmount, uint256 buyoutBidAmount, uint64 timeBufferInSeconds, uint16 bidBufferBps, uint64 startTimestamp, uint64 endTimestamp, uint256 currentBidAmount, address currentBidder))",
      params: [BigInt(auctionId)],
    });

    if (result) {
      return {
        listingId: String(result.auctionId),
        seller: result.seller,
        assetContract: result.assetContract,
        tokenId: String(result.tokenId),
        quantity: String(result.quantity),
        pricePerToken: String(result.minimumBidAmount),
        currency: result.currency,
        listingType: "auction",
        startTime: Number(result.startTimestamp),
        endTime: Number(result.endTimestamp),
        buyoutPricePerToken: String(result.buyoutBidAmount),
        currentBid: String(result.currentBidAmount),
        highestBidder: result.currentBidder,
      };
    }
  } catch {
    return null;
  }

  return null;
}
