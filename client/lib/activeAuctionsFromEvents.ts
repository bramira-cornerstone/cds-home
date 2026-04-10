import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

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
  status: "active" | "completed" | "cancelled";
  winningBidder: string | null;
  currentBidAmount: string | null;
  increaseFromAsking: string | null;
}

export function isAuctionExpired(auction: ActiveAuction): boolean {
  const now = Math.floor(Date.now() / 1000);
  return auction.endTimestamp < now;
}

async function fetchEditionFromTokenIds(
  tokenIds: string[],
): Promise<Map<string, number>> {
  const emptyResult = new Map<string, number>();
  if (tokenIds.length === 0) return emptyResult;

  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return emptyResult;
  }

  return withSupabaseFallback(
    `edition-from-tokens-${tokenIds.join("-")}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Fetch all token IDs in a single query using 'in' filter
      const tokenIdFilter = tokenIds
        .map((id) => `${encodeURIComponent(id)}`)
        .join(",");
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=in.(${tokenIdFilter})&select=token_id,edition_id`;

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
        token_id: string | number;
        edition_id: number;
      }>;
      const result = new Map<string, number>();
      for (const row of data) {
        result.set(String(row.token_id), row.edition_id);
      }
      return result;
    },
    emptyResult,
    "fetchEditionFromTokenIds",
  );
}

export async function fetchSerialCardsFromTokenIds(tokenIds: string[]): Promise<
  Map<
    string,
    {
      editionId: number;
      serial: number;
      name: string | null;
      thumb: string | null;
      gameDate: string | null;
      createDate: string | null;
      setName: string | null;
      badge: string | null;
      badge2: string | null;
      badge3: string | null;
      minted: number | null;
    }
  >
> {
  const emptyResult = new Map();
  if (tokenIds.length === 0) return emptyResult;

  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return emptyResult;
  }

  return withSupabaseFallback(
    `serial-cards-${tokenIds.join("-")}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      const tokenIdFilter = tokenIds.join(",");
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=in.(${tokenIdFilter})&select=token_id,edition_id,serial,PlayerName,image_url,Badge1,Badge2,Badge3,Minted&limit=100`;

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
        token_id: string | number;
        edition_id: number;
        serial: number;
        PlayerName?: string | null;
        image_url?: string | null;
        GameDate?: string | null;
        CreateDate?: string | null;
        SetName?: string | null;
        Badge1?: string | null;
        Badge2?: string | null;
        Badge3?: string | null;
        Minted?: number | null;
      }>;

      const convertBadgeToImage = (
        badgeValue: string | null | undefined,
      ): string | null => {
        if (!badgeValue) return null;
        const badge = String(badgeValue).toUpperCase();
        if (badge === "CP") return "/images/cp-badge.webp";
        if (badge === "RY") return "/images/ry-badge.webp";
        if (badge === "CY") return "/images/cy-badge.webp";
        return null;
      };

      const result = new Map();
      for (const row of data) {
        result.set(String(row.token_id), {
          editionId: row.edition_id,
          serial: row.serial,
          name: row.PlayerName || null,
          thumb: row.image_url || null,
          gameDate: (row as any)?.GameDate || null,
          createDate: (row as any)?.CreateDate || null,
          setName: (row as any)?.SetName || null,
          badge: convertBadgeToImage(row.Badge1),
          badge2: convertBadgeToImage(row.Badge2),
          badge3: convertBadgeToImage(row.Badge3),
          minted: row.Minted || null,
        });
      }
      return result;
    },
    emptyResult,
    "fetchSerialCardsFromTokenIds",
  );
}

export async function fetchAllAuctionsFromEvents(): Promise<ActiveAuction[]> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      console.error(
        "[fetchAllAuctionsFromEvents] Missing Supabase configuration",
      );
      return [];
    }

    console.debug(
      "[fetchAllAuctionsFromEvents] Fetching auctions from marketplace events",
    );

    const root = baseUrl.replace(/\/$/, "");
    // Get all NewAuction events - includes serial for SerialCardMini rendering
    const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewAuction&select=auction_id,token_id,minimum_bid_amount,buyout_bid_amount,time_buffer_seconds,bid_buffer_bps,auction_start_ts,auction_end_ts,auction_creator,auction_creator_username,currency,quantity,winning_bidder,bid_amount,serial&order=emitted_at.desc&limit=50`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      // 4xx: log as warning
      if (response.status >= 400 && response.status < 500) {
        console.warn(
          `[fetchAllAuctionsFromEvents] Client error (${response.status})`,
        );
      }
      // 5xx: log as warning (expected when records don't exist)
      if (response.status >= 500) {
        console.warn(
          `[fetchAllAuctionsFromEvents] Server error (${response.status})`,
        );
      }
      return [];
    }

    let auctionEvents = (await response.json()) as Array<{
      auction_id?: string | number;
      token_id?: string | number;
      minimum_bid_amount?: string | number;
      buyout_bid_amount?: string | number;
      time_buffer_seconds?: string | number;
      bid_buffer_bps?: string | number;
      auction_start_ts?: string | number;
      auction_end_ts?: string | number;
      auction_creator?: string;
      auction_creator_username?: string | null;
      currency?: string;
      quantity?: string | number;
      winning_bidder?: string | null;
      bid_amount?: string | number;
      serial?: number;
      Minted?: number;
      PlayerName?: string;
    }>;

    if (!Array.isArray(auctionEvents)) {
      console.error("[fetchAllAuctionsFromEvents] Invalid response format");
      return [];
    }

    console.debug(
      "[fetchAllAuctionsFromEvents] Found",
      auctionEvents.length,
      "NewAuction events",
    );

    // Deduplicate by auction_id, keeping the first (most recent) one
    const deduplicatedByAuctionId = new Map<
      string,
      (typeof auctionEvents)[0]
    >();

    for (const event of auctionEvents) {
      const auctionId = String(event.auction_id || "");
      if (auctionId && !deduplicatedByAuctionId.has(auctionId)) {
        deduplicatedByAuctionId.set(auctionId, event);
      }
    }

    const uniqueAuctions = Array.from(deduplicatedByAuctionId.values());
    console.debug(
      "[fetchAllAuctionsFromEvents] After deduplication:",
      uniqueAuctions.length,
      "unique auctions",
    );

    // Fetch cancelled auction IDs
    const cancelledUrl = `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.CancelledAuction&select=auction_id&limit=50`;
    const cancelledResponse = await fetch(cancelledUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    let cancelledAuctionIds = new Set<string>();
    if (cancelledResponse.ok) {
      const cancelledEvents = (await cancelledResponse.json()) as Array<{
        auction_id?: string | number;
      }>;
      cancelledAuctionIds = new Set(
        cancelledEvents.map((e) => String(e.auction_id || "")),
      );
      console.debug(
        "[fetchAllAuctionsFromEvents] Found",
        cancelledAuctionIds.size,
        "cancelled auctions",
      );
    }

    // Batch fetch all edition IDs from token IDs in a single query
    const tokenIds = uniqueAuctions
      .map((e) => String(e.token_id || ""))
      .filter((tid) => tid.length > 0);
    const tokenIdToEditionId = await fetchEditionFromTokenIds(tokenIds);

    // Get current timestamp
    const now = Math.floor(Date.now() / 1000);

    // Process auctions with metadata
    const processedAuctions: ActiveAuction[] = [];

    for (const auctionEvent of uniqueAuctions) {
      try {
        const auctionId = String(auctionEvent.auction_id || "");
        if (!auctionId) continue;

        const tokenId = String(auctionEvent.token_id || "");
        const endTimestamp = Number(auctionEvent.auction_end_ts || 0);

        // Determine status
        let status: "active" | "completed" | "cancelled" = "active";
        if (cancelledAuctionIds.has(auctionId)) {
          status = "cancelled";
        } else if (endTimestamp < now) {
          status = "completed";
        }

        // Get edition ID from batch lookup
        let editionId: number | null = null;
        let serial: number | null = null;

        if (tokenId) {
          editionId = tokenIdToEditionId.get(tokenId) || null;
        }

        if (auctionEvent.serial) {
          serial = Number(auctionEvent.serial);
        }

        // Use pre-fetched creator username from the marketplace_events_with_relics view
        const auctionCreator = auctionEvent.auction_creator || "";
        const auctionCreatorUsername =
          auctionEvent.auction_creator_username || null;

        // Calculate increase from asking (minimum bid)
        let increaseFromAsking: string | null = null;
        const minimumBid =
          Number(BigInt(auctionEvent.minimum_bid_amount || "0")) / 1e18;
        const winningBid = auctionEvent.bid_amount
          ? Number(BigInt(auctionEvent.bid_amount)) / 1e18
          : minimumBid;

        if (minimumBid > 0 && auctionEvent.bid_amount) {
          const percentage = (
            ((winningBid - minimumBid) / minimumBid) *
            100
          ).toFixed(2);
          increaseFromAsking = `+${percentage}%`;
        }

        const auction: ActiveAuction = {
          auctionId,
          tokenId,
          minimumBidAmount: String(auctionEvent.minimum_bid_amount || 0),
          buyoutBidAmount: String(auctionEvent.buyout_bid_amount || 0),
          timeBufferInSeconds: Number(auctionEvent.time_buffer_seconds || 0),
          bidBufferBps: Number(auctionEvent.bid_buffer_bps || 0),
          startTimestamp: Number(auctionEvent.auction_start_ts || 0),
          endTimestamp,
          auctionCreator,
          currency: auctionEvent.currency || "",
          quantity: String(auctionEvent.quantity || 1),
          editionId,
          serial,
          auctionCreatorUsername,
          status,
          winningBidder: auctionEvent.winning_bidder || null,
          currentBidAmount: auctionEvent.bid_amount
            ? String(auctionEvent.bid_amount)
            : null,
          increaseFromAsking,
        };

        processedAuctions.push(auction);
      } catch (err) {
        console.error(
          "[fetchAllAuctionsFromEvents] Failed to process auction",
          auctionEvent.auction_id,
          ":",
          err,
        );
        continue;
      }
    }

    console.debug(
      "[fetchAllAuctionsFromEvents] Processed",
      processedAuctions.length,
      "auctions successfully",
    );

    return processedAuctions;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.debug("[fetchAllAuctionsFromEvents] Request aborted");
      return [];
    }
    // Network errors (TypeError: Failed to fetch) - silently return []
    // Don't log network-level errors, they're transient and not actionable
    return [];
  }
}
