import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";

export interface ActiveListing {
  listingId: string;
  tokenId: string;
  listingType: "direct" | "auction";
  pricePerToken: string;
  startTimestamp: number;
  endTimestamp: number;
  sellerAddress: string;
  sellerUsername: string | null;
  editionId: number | null;
  serial: number | null;
  currency: string;
  minimumBidAmount?: string;
  buyoutBidAmount?: string;
  low_ask?: string | null;
  status: "active" | "inactive";
}

export async function fetchTokenMetadata(
  tokenId: string,
): Promise<{ editionId: number | null; serial: number | null }> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return { editionId: null, serial: null };
  }

  return withSupabaseFallback(
    `listing-token-metadata-${tokenId}`,
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
      if (Array.isArray(data) && data[0]) {
        return {
          editionId: data[0].edition_id,
          serial: data[0].serial,
        };
      }

      return { editionId: null, serial: null };
    },
    { editionId: null, serial: null },
    "fetchTokenMetadata (listings)",
  );
}

async function fetchSellerUsername(
  walletAddress: string,
): Promise<string | null> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return null;
  }

  return withSupabaseFallback(
    `seller-username-${walletAddress}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(walletAddress)}&select=username`;

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
      if (Array.isArray(data) && data[0]?.username) {
        return data[0].username;
      }

      return null;
    },
    null,
    "fetchSellerUsername",
  );
}

// Helper function for retry logic with exponential backoff

// Helper function to throttle async operations
async function throttledMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number = 2,
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  let running = 0;

  return new Promise((resolve, reject) => {
    const process = async () => {
      if (queue.length === 0 && running === 0) {
        resolve(results);
        return;
      }

      while (running < concurrency && queue.length > 0) {
        running++;
        const item = queue.shift()!;
        const index = items.indexOf(item);

        fn(item)
          .then((result) => {
            results[index] = result;
            running--;
            process();
          })
          .catch((err) => {
            running--;
            reject(err);
          });
      }
    };

    process();
  });
}

async function fetchAllDirectListings(): Promise<ActiveListing[]> {
  try {
    if (!MARKETPLACE_ADDRESS) {
      console.error("[fetchAllDirectListings] Missing MARKETPLACE_ADDRESS");
      return [];
    }

    console.debug(
      "[fetchAllDirectListings] Initializing contract for",
      MARKETPLACE_ADDRESS,
    );
    const client = getAlchemyThirdwebClient();
    const contract = getContract({
      address: MARKETPLACE_ADDRESS,
      chain: polygon,
      client,
    });
    console.debug("[fetchAllDirectListings] Contract initialized");

    let totalCount = 0n;
    try {
      console.debug("[fetchAllDirectListings] Fetching totalListings");
      const totalResult = await readContract({
          contract,
          method: "function totalListings() returns (uint256)",
          params: [],
        });
      totalCount = BigInt(totalResult);
      console.debug(
        "[fetchAllDirectListings] totalListings:",
        totalCount.toString(),
      );
    } catch (err: any) {
      // Network errors - silently return []
      if (
        err?.name === "TypeError" &&
        err?.message?.includes("Failed to fetch")
      ) {
        console.debug(
          "[fetchAllDirectListings] Network error fetching totalListings",
        );
        return [];
      }
      console.error(
        "[fetchAllDirectListings] Failed to fetch totalListings:",
        err,
      );
      return [];
    }

    if (totalCount === 0n) {
      console.debug(
        "[fetchAllDirectListings] No listings to fetch (totalCount = 0)",
      );
      return [];
    }

    // Fetch valid listings from getAllValidListings - only returns active listings
    let validListingsResult: any[] = [];
    try {
      const endId = totalCount - 1n;
      console.debug(
        "[fetchAllDirectListings] Calling getAllValidListings with range [0,",
        endId.toString() + "]",
      );
      const validListingsData = await readContract({
          contract,
          method:
            "function getAllValidListings(uint256 _startId, uint256 _endId) returns ((uint256 listingId, uint256 tokenId, uint256 quantity, uint256 pricePerToken, uint128 startTimestamp, uint128 endTimestamp, address listingCreator, address assetContract, address currency, uint8 tokenType, uint8 status, bool reserved)[])",
          params: [0n, endId],
        });
      if (Array.isArray(validListingsData)) {
        validListingsResult = validListingsData;
        console.debug(
          "[fetchAllDirectListings] getAllValidListings returned",
          validListingsResult.length,
          "active results",
        );
      }
    } catch (err: any) {
      // Network errors - silently return []
      if (
        err?.name === "TypeError" &&
        err?.message?.includes("Failed to fetch")
      ) {
        console.debug(
          "[fetchAllDirectListings] Network error fetching getAllValidListings",
        );
        return [];
      }
      console.error(
        "[fetchAllDirectListings] Failed to fetch getAllValidListings. Error:",
        err,
      );
      return [];
    }

    if (validListingsResult.length === 0) {
      console.debug(
        "[fetchAllDirectListings] No active listings found in getAllValidListings",
      );
      return [];
    }

    // Deduplicate by tokenId (keeping highest listingId) - only valid listings
    const deduplicatedByTokenId = new Map<
      string,
      (typeof validListingsResult)[0]
    >();

    for (const listing of validListingsResult) {
      const tokenId = String(listing.tokenId);
      const existingListing = deduplicatedByTokenId.get(tokenId);
      const currentListingId = BigInt(listing.listingId);
      const existingListingId = existingListing
        ? BigInt(existingListing.listingId)
        : 0n;

      if (!existingListing || currentListingId > existingListingId) {
        if (existingListing) {
          console.debug(
            `[fetchAllDirectListings] Replacing listing ${existingListing.listingId} with ${listing.listingId} for tokenId ${tokenId}`,
          );
        }
        deduplicatedByTokenId.set(tokenId, listing);
      } else {
        console.debug(
          `[fetchAllDirectListings] Skipping older listing ${listing.listingId} for tokenId ${tokenId} (keeping ${existingListing.listingId})`,
        );
      }
    }

    const deduplicatedListings = Array.from(deduplicatedByTokenId.values());
    console.debug(
      `[fetchAllDirectListings] After deduplication: ${deduplicatedListings.length} unique active listings from ${validListingsResult.length} valid results`,
    );

    // Now process the deduplicated listings with throttling to avoid rate limits
    console.debug(
      "[fetchAllDirectListings] Fetching metadata and usernames with throttling (max 2 concurrent)",
    );

    const processedListings = await throttledMap(
      deduplicatedListings,
      async (listing) => {
        try {
          const tokenId = String(listing.tokenId);
          const metadata = await fetchTokenMetadata(tokenId);
          const sellerUsername = await fetchSellerUsername(listing.listingCreator);

          return {
            listingId: String(listing.listingId),
            tokenId,
            listingType: "direct" as const,
            pricePerToken: String(listing.pricePerToken),
            startTimestamp: Number(listing.startTimestamp),
            endTimestamp: Number(listing.endTimestamp),
            sellerAddress: listing.listingCreator,
            sellerUsername,
            editionId: metadata.editionId,
            serial: metadata.serial,
            currency: listing.currency,
            status: "active" as const,
          };
        } catch (err) {
          console.error(
            `[fetchAllDirectListings] Failed to process listing ${listing.listingId}:`,
            err,
          );
          return null;
        }
      },
      2, // Max 2 concurrent requests
    );

    // Filter out null results (failed listings)
    const validListings = processedListings.filter(
      (l): l is ActiveListing => l !== null,
    );
    console.debug(
      `[fetchAllDirectListings] Processed ${validListings.length}/${deduplicatedListings.length} listings successfully`,
    );

    return validListings;
  } catch (err: any) {
    // Network errors (TypeError: Failed to fetch) - silently return []
    // Don't log network-level errors, they're transient and not actionable
    if (
      err?.name === "TypeError" &&
      err?.message?.includes("Failed to fetch")
    ) {
      console.debug("[fetchAllDirectListings] Network error - request failed");
      return [];
    }

    // For other errors, log details
    console.error("[fetchAllDirectListings] Error:", err);
    console.error(
      "[fetchAllDirectListings] Error message:",
      (err as any)?.message,
    );
    console.error("[fetchAllDirectListings] Error code:", (err as any)?.code);
    console.error(
      "[fetchAllDirectListings] Error details:",
      (err as any)?.details,
    );
    return [];
  }
}

async function fetchAllAuctions(): Promise<ActiveListing[]> {
  try {
    if (!MARKETPLACE_ADDRESS) {
      console.error("[fetchAllAuctions] Missing MARKETPLACE_ADDRESS");
      return [];
    }

    console.log(
      "[fetchAllAuctions] Initializing contract for",
      MARKETPLACE_ADDRESS,
    );
    const client = getAlchemyThirdwebClient();
    const contract = getContract({
      address: MARKETPLACE_ADDRESS,
      chain: polygon,
      client,
    });
    console.log("[fetchAllAuctions] Contract initialized");

    let totalCount = 0n;
    try {
      console.log("[fetchAllAuctions] Fetching totalAuctions");
      const totalResult = await readContract({
        contract,
        method: "function totalAuctions() returns (uint256)",
        params: [],
      });
      totalCount = BigInt(totalResult);
      console.log("[fetchAllAuctions] totalAuctions:", totalCount.toString());
    } catch (err) {
      console.error("[fetchAllAuctions] Failed to fetch totalAuctions:", err);
      console.error("Error message:", (err as any)?.message);
      console.error("Error code:", (err as any)?.code);
      return [];
    }

    if (totalCount === 0n) {
      console.log("[getAllAuctions] No auctions to fetch (totalCount = 0)");
      return [];
    }

    let result;
    try {
      const endId = totalCount - 1n;
      console.log(
        "[getAllAuctions] Calling with range [0,",
        endId.toString() + "]",
      );
      result = await readContract({
        contract,
        method:
          "function getAllAuctions(uint256 _startId, uint256 _endId) returns ((uint256 auctionId, uint256 tokenId, uint256 quantity, uint256 minimumBidAmount, uint256 buyoutBidAmount, uint64 timeBufferInSeconds, uint64 bidBufferBps, uint64 startTimestamp, uint64 endTimestamp, address auctionCreator, address assetContract, address currency, uint8 tokenType, uint8 status)[])",
        params: [0n, endId],
      });
      console.log(
        "[getAllAuctions] Success, got",
        Array.isArray(result) ? result.length : "non-array",
        "results",
      );
    } catch (err) {
      console.error("Failed to fetch getAllAuctions. Error:", err);
      console.error("Error keys:", Object.keys(err || {}));
      console.error("Error message:", (err as any)?.message);
      console.error("Error code:", (err as any)?.code);
      throw err;
    }

    if (!Array.isArray(result)) {
      return [];
    }

    console.log(
      "[fetchAllAuctions] Processing",
      result.length,
      "auctions with throttling (max 2 concurrent)",
    );

    const processedAuctions = await throttledMap(
      result,
      async (auction) => {
        try {
          const tokenId = String(auction.tokenId);
          const metadata = await fetchTokenMetadata(tokenId);
          const sellerUsername = await fetchSellerUsername(auction.auctionCreator);

          return {
            listingId: String(auction.auctionId),
            tokenId,
            listingType: "auction" as const,
            pricePerToken: String(auction.minimumBidAmount),
            startTimestamp: Number(auction.startTimestamp),
            endTimestamp: Number(auction.endTimestamp),
            sellerAddress: auction.auctionCreator,
            sellerUsername,
            editionId: metadata.editionId,
            serial: metadata.serial,
            currency: auction.currency,
            minimumBidAmount: String(auction.minimumBidAmount),
            buyoutBidAmount: String(auction.buyoutBidAmount),
          };
        } catch (err) {
          console.error(
            `[fetchAllAuctions] Failed to process auction ${auction.auctionId}:`,
            err,
          );
          return null;
        }
      },
      2, // Max 2 concurrent requests
    );

    // Filter out null results (failed auctions)
    const validListings = processedAuctions.filter(
      (l): l is ActiveListing => l !== null,
    );
    console.log(
      `[fetchAllAuctions] Processed ${validListings.length}/${result.length} auctions successfully`,
    );

    return validListings;
  } catch (err) {
    console.error("[fetchAllAuctions] Error:", err);
    console.error("[fetchAllAuctions] Error message:", (err as any)?.message);
    console.error("[fetchAllAuctions] Error code:", (err as any)?.code);
    console.error("[fetchAllAuctions] Error details:", (err as any)?.details);
    return [];
  }
}

export async function fetchAllActiveListings(): Promise<ActiveListing[]> {
  console.log("[activeListings] Starting fetch of all listings");
  const directListings = await fetchAllDirectListings();

  console.log(
    "[activeListings] Fetched",
    directListings.length,
    "deduplicated valid listings from contract",
  );

  // Group listings by edition_id and compute low_ask
  const editionGroups = new Map<number, ActiveListing[]>();

  for (const listing of directListings) {
    if (listing.editionId === null) continue;

    if (!editionGroups.has(listing.editionId)) {
      editionGroups.set(listing.editionId, []);
    }
    editionGroups.get(listing.editionId)!.push(listing);
  }

  // Compute low_ask for each edition
  for (const [editionId, listings] of editionGroups) {
    const prices = listings.map((l) => Number(l.pricePerToken));
    const minPrice = Math.min(...prices);
    const low_ask = `${minPrice}`;

    console.log(`[activeListings] Edition ${editionId}: low_ask = ${low_ask}`);

    // Add low_ask to all listings in this edition
    for (const listing of listings) {
      listing.low_ask = low_ask;
    }
  }

  return directListings;
}
