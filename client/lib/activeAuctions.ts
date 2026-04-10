import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";

export interface ActiveAuction {
  auctionId: string;
  tokenId: string;
  minimumBidAmount: string;
  buyoutBidAmount: string;
  timeBufferInSeconds: number;
  bidBufferBps: number;
  startTimestamp: number;
  endTimestamp: number;
  auctionCreator: string;
  currency: string;
  quantity: string;
  editionId: number | null;
  serial: number | null;
  auctionCreatorUsername: string | null;
  status: "active" | "inactive";
}

export function isAuctionExpired(auction: ActiveAuction): boolean {
  const now = Math.floor(Date.now() / 1000);
  return auction.endTimestamp < now;
}

async function fetchTokenMetadata(
  tokenId: string,
): Promise<{ editionId: number | null; serial: number | null }> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return { editionId: null, serial: null };
  }

  return withSupabaseFallback(
    `auction-token-metadata-${tokenId}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(tokenId)}&select=edition_id,serial`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as Array<{
        edition_id: number;
        serial: number;
      }>;
      if (data.length > 0) {
        return { editionId: data[0].edition_id, serial: data[0].serial };
      }
      return { editionId: null, serial: null };
    },
    { editionId: null, serial: null },
    "fetchTokenMetadata (auctions)",
  );
}

async function fetchAuctionCreatorUsername(
  address: string,
): Promise<string | null> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return null;
  }

  return withSupabaseFallback(
    `auction-creator-username-${address}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(address)}&select=username`;

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as Array<{ username: string }>;
      if (data.length > 0) {
        return data[0].username;
      }
      return null;
    },
    null,
    "fetchAuctionCreatorUsername",
  );
}


async function throttledMap<T, U>(
  items: T[],
  fn: (item: T) => Promise<U>,
  maxConcurrent: number,
): Promise<U[]> {
  const results: U[] = [];
  const executing: Promise<U>[] = [];

  for (const item of items) {
    const promise = Promise.resolve().then(() => fn(item));

    results.push(promise as any);

    if (maxConcurrent <= items.length) {
      promise.then(() => executing.splice(executing.indexOf(promise), 1));
      executing.push(promise);

      if (executing.length >= maxConcurrent) {
        await Promise.race(executing);
      }
    }
  }

  return Promise.all(results);
}

async function fetchAllActiveAuctions(): Promise<ActiveAuction[]> {
  try {
    if (!MARKETPLACE_ADDRESS) {
      console.error("[fetchAllActiveAuctions] Missing MARKETPLACE_ADDRESS");
      return [];
    }

    console.log(
      "[fetchAllActiveAuctions] Initializing contract for",
      MARKETPLACE_ADDRESS,
    );
    const client = getAlchemyThirdwebClient();
    const contract = getContract({
      address: MARKETPLACE_ADDRESS,
      chain: polygon,
      client,
    });
    console.log("[fetchAllActiveAuctions] Contract initialized");

    let totalCount = 0n;
    try {
      console.log("[fetchAllActiveAuctions] Fetching totalAuctions");
      const totalResult = await readContract({
          contract,
          method: "function totalAuctions() returns (uint256)",
          params: [],
        });
      totalCount = BigInt(totalResult);
      console.log(
        "[fetchAllActiveAuctions] totalAuctions:",
        totalCount.toString(),
      );
    } catch (err) {
      console.error(
        "[fetchAllActiveAuctions] Failed to fetch totalAuctions:",
        err,
      );
      return [];
    }

    if (totalCount === 0n) {
      console.log(
        "[fetchAllActiveAuctions] No auctions to fetch (totalCount = 0)",
      );
      return [];
    }

    // Fetch valid auctions from getAllValidAuctions - only returns active auctions
    let validAuctionsResult: any[] = [];
    try {
      const endId = totalCount - 1n;
      console.log(
        "[fetchAllActiveAuctions] Calling getAllValidAuctions with range [0,",
        endId.toString() + "]",
      );
      const validAuctionsData = await readContract({
          contract,
          method:
            "function getAllValidAuctions(uint256 _startId, uint256 _endId) returns ((uint256 auctionId, uint256 tokenId, uint256 quantity, uint256 minimumBidAmount, uint256 buyoutBidAmount, uint64 timeBufferInSeconds, uint64 bidBufferBps, uint64 startTimestamp, uint64 endTimestamp, address auctionCreator, address assetContract, address currency, uint8 tokenType, uint8 status)[])",
          params: [0n, endId],
        });
      if (Array.isArray(validAuctionsData)) {
        validAuctionsResult = validAuctionsData;
        console.log(
          "[fetchAllActiveAuctions] getAllValidAuctions returned",
          validAuctionsResult.length,
          "active results",
        );
      }
    } catch (err) {
      console.error(
        "[fetchAllActiveAuctions] Failed to fetch getAllValidAuctions. Error:",
        err,
      );
      console.error("Error message:", (err as any)?.message);
      console.error("Error code:", (err as any)?.code);
      return [];
    }

    if (validAuctionsResult.length === 0) {
      console.log(
        "[fetchAllActiveAuctions] No active auctions found in getAllValidAuctions",
      );
      return [];
    }

    // Deduplicate by tokenId (keeping highest auctionId) - only valid auctions
    const deduplicatedByTokenId = new Map<
      string,
      (typeof validAuctionsResult)[0]
    >();

    for (const auction of validAuctionsResult) {
      const tokenId = String(auction.tokenId);
      const existingAuction = deduplicatedByTokenId.get(tokenId);
      const currentAuctionId = BigInt(auction.auctionId);
      const existingAuctionId = existingAuction
        ? BigInt(existingAuction.auctionId)
        : 0n;

      if (!existingAuction || currentAuctionId > existingAuctionId) {
        if (existingAuction) {
          console.log(
            `[fetchAllActiveAuctions] Replacing auction ${existingAuction.auctionId} with ${auction.auctionId} for tokenId ${tokenId}`,
          );
        }
        deduplicatedByTokenId.set(tokenId, auction);
      } else {
        console.log(
          `[fetchAllActiveAuctions] Skipping older auction ${auction.auctionId} for tokenId ${tokenId} (keeping ${existingAuction.auctionId})`,
        );
      }
    }

    const deduplicatedAuctions = Array.from(deduplicatedByTokenId.values());
    console.log(
      `[fetchAllActiveAuctions] After deduplication: ${deduplicatedAuctions.length} unique active auctions from ${validAuctionsResult.length} valid results`,
    );

    // Now process the deduplicated auctions with throttling to avoid rate limits
    console.log(
      "[fetchAllActiveAuctions] Fetching metadata and usernames with throttling (max 2 concurrent)",
    );

    const processedAuctions = await throttledMap(
      deduplicatedAuctions,
      async (auction) => {
        try {
          const tokenId = String(auction.tokenId);
          const metadata = await fetchTokenMetadata(tokenId);
          const auctionCreatorUsername = await fetchAuctionCreatorUsername(auction.auctionCreator);

          return {
            auctionId: String(auction.auctionId),
            tokenId,
            minimumBidAmount: String(auction.minimumBidAmount),
            buyoutBidAmount: String(auction.buyoutBidAmount),
            timeBufferInSeconds: Number(auction.timeBufferInSeconds),
            bidBufferBps: Number(auction.bidBufferBps),
            startTimestamp: Number(auction.startTimestamp),
            endTimestamp: Number(auction.endTimestamp),
            auctionCreator: auction.auctionCreator,
            currency: auction.currency,
            quantity: String(auction.quantity),
            editionId: metadata.editionId,
            serial: metadata.serial,
            auctionCreatorUsername,
            status: "active" as const,
          };
        } catch (err) {
          console.error(
            `[fetchAllActiveAuctions] Failed to process auction ${auction.auctionId}:`,
            err,
          );
          return null;
        }
      },
      2, // Max 2 concurrent requests
    );

    // Filter out null results (failed auctions)
    const validAuctions = processedAuctions.filter(
      (a): a is ActiveAuction => a !== null,
    );
    console.log(
      `[fetchAllActiveAuctions] Processed ${validAuctions.length}/${deduplicatedAuctions.length} auctions successfully`,
    );

    return validAuctions;
  } catch (err) {
    console.error("[fetchAllActiveAuctions] Error:", err);
    console.error(
      "[fetchAllActiveAuctions] Error message:",
      (err as any)?.message,
    );
    console.error("[fetchAllActiveAuctions] Error code:", (err as any)?.code);
    console.error(
      "[fetchAllActiveAuctions] Error details:",
      (err as any)?.details,
    );
    return [];
  }
}

export { fetchAllActiveAuctions };
