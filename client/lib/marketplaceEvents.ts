import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface MarketplaceEvent {
  id: string;
  tx_hash: string;
  event_name: string;
  emitted_at: string;
  raw_log: string;
  decoded?: string | object | null;
  // Enhanced metadata from RelicSerialsJoined
  PlayerName?: string;
  team?: string;
  TierValue?: string;
  SetName?: string;
  SeriesName?: string;
  serial?: number;
  Minted?: number;
}

export interface SerialData {
  id: number;
  name?: string;
  thumb?: string;
  tier?: string;
  serial?: number;
  minted?: number;
  gameDate?: string;
  createDate?: string;
  setName?: string;
  badge?: string;
  badge2?: string;
  badge3?: string;
  team?: string;
}

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Fetches marketplace events from the Supabase marketplace_events_with_relics view.
 *
 * Uses the fallback architecture from SUPABASE_FALLBACK_ARCHITECTURE.md:
 * - Attempts to fetch from the marketplace_events_with_relics view
 * - On success (HTTP 200): returns the events
 * - On error (HTTP 400, 404, 500, network error): returns cached data or fallback data
 * - Errors are logged but don't cause the app to crash
 *
 * This enables the /collection page to show Recent Events and Friend Events even when
 * the Supabase API is temporarily unavailable or the view doesn't exist.
 */
export async function fetchMarketplaceEvents(
  signal?: AbortSignal,
): Promise<MarketplaceEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.warn(
      "[marketplaceEvents] Missing Supabase configuration (URL or ANON_KEY)",
    );
    return [];
  }

  // Fallback data - empty array means "no events available"
  // In production, this would be populated from cache or a fallback API
  const fallbackData: any[] = [];

  return withSupabaseFallback(
    "marketplace-events",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      // Query marketplace_events_with_relics view which contains marketplace activity with related relic data
      const url = `${root}/rest/v1/marketplace_events_with_relics?order=emitted_at.desc&limit=50`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: headers(anonKey),
          signal,
        });
      } catch (fetchErr: any) {
        // Check if this is an abort error (intentional cancellation)
        if (fetchErr.name === "AbortError") {
          console.debug("[marketplaceEvents] Request was cancelled");
          return [];
        }
        throw fetchErr;
      }

      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        const errorBody = await response.text().catch(() => "");
        console.warn(
          `[marketplaceEvents] API failed with ${response.status} ${statusText}`,
          { url, error: errorBody },
        );
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      let data: Array<any>;

      try {
        data = await response.json();
      } catch (parseErr: any) {
        // Check if this is an abort error
        if (parseErr.name === "AbortError") {
          console.debug(
            "[marketplaceEvents] Request was cancelled during parsing",
          );
          return [];
        }
        console.warn(
          "[marketplaceEvents] Failed to parse response as JSON:",
          parseErr,
        );
        throw parseErr;
      }

      if (!Array.isArray(data)) {
        console.warn("[marketplaceEvents] Response data is not an array:", {
          data,
        });
        throw new Error("Response data is not an array");
      }

      // Convert to MarketplaceEvent format with all marketplace data and relic data for display
      return data.map((event: any) => ({
        id: String(event.id),
        tx_hash: event.tx_hash || "",
        event_name: event.event_name || "",
        emitted_at: event.emitted_at || "",
        raw_log: "", // marketplace_events_with_relics doesn't have raw_log
        // Serial/Relic fields from the view join with RelicSerialsJoined (top level)
        PlayerName: event.PlayerName || undefined,
        team: event.team || undefined,
        TierValue: event.TierValue || undefined,
        SetName: event.SetName || undefined,
        SeriesName: event.SeriesName || undefined,
        serial: event.serial != null ? event.serial : undefined,
        Minted: event.Minted || undefined,
        decoded: {
          // Listing fields
          listingId: event.listing_id ? String(event.listing_id) : undefined,
          listing_id: event.listing_id ? String(event.listing_id) : undefined,
          listing_creator: event.listing_creator,
          listingCreator: event.listing_creator,
          listing_creator_username: event.listing_creator_username,
          listingCreatorUsername: event.listing_creator_username,
          pricePerToken: event.price_per_token,
          price_per_token: event.price_per_token,
          listingStartTs: event.listing_start_ts,
          listing_start_ts: event.listing_start_ts,
          listingEndTs: event.listing_end_ts,
          listing_end_ts: event.listing_end_ts,
          quantityBought: event.quantity_bought,
          quantity_bought: event.quantity_bought,
          // Auction fields
          auctionId: event.auction_id ? String(event.auction_id) : undefined,
          auction_id: event.auction_id ? String(event.auction_id) : undefined,
          auction_creator: event.auction_creator,
          auctionCreator: event.auction_creator,
          auction_creator_username: event.auction_creator_username,
          auctionCreatorUsername: event.auction_creator_username,
          minimumBidAmount: event.minimum_bid_amount,
          minimum_bid_amount: event.minimum_bid_amount,
          buyoutBidAmount: event.buyout_bid_amount,
          buyout_bid_amount: event.buyout_bid_amount,
          bid_amount: event.bid_amount,
          bidAmount: event.bid_amount,
          bidder_username: event.bidder_username,
          bidderUsername: event.bidder_username,
          auctionStartTs: event.auction_start_ts,
          auction_start_ts: event.auction_start_ts,
          auctionEndTs: event.auction_end_ts,
          auction_end_ts: event.auction_end_ts,
          closer: event.closer,
          winning_bidder: event.winning_bidder,
          winningBidder: event.winning_bidder,
          winning_bidder_username: event.winning_bidder_username,
          winningBidderUsername: event.winning_bidder_username,
          max_bid: event.max_bid,
          maxBid: event.max_bid,
          // Offer fields
          offerId: event.offer_id ? String(event.offer_id) : undefined,
          offer_id: event.offer_id ? String(event.offer_id) : undefined,
          offeror: event.offeror,
          offeror_username: event.offeror_username,
          offerorUsername: event.offeror_username,
          seller: event.seller,
          seller_username: event.seller_username,
          sellerUsername: event.seller_username,
          total_price: event.total_price,
          totalPrice: event.total_price,
          offerExpirationTs: event.offer_expiration_ts,
          offer_expiration_ts: event.offer_expiration_ts,
          // Sale fields
          buyer: event.buyer,
          buyer_username: event.buyer_username,
          buyerUsername: event.buyer_username,
          totalPricePaid: event.total_price_paid,
          total_price_paid: event.total_price_paid,
          from_address_username: event.from_address_username,
          fromAddressUsername: event.from_address_username,
          to_address_username: event.to_address_username,
          toAddressUsername: event.to_address_username,
          // General fields
          tokenId: event.token_id
            ? String(event.token_id)
            : event.max_token_id
              ? String(event.max_token_id)
              : undefined,
          token_id: event.token_id
            ? String(event.token_id)
            : event.max_token_id
              ? String(event.max_token_id)
              : undefined,
          max_token_id: event.max_token_id
            ? String(event.max_token_id)
            : undefined,
          maxTokenId: event.max_token_id
            ? String(event.max_token_id)
            : undefined,
          asset_contract: event.asset_contract,
          assetContract: event.asset_contract,
          quantity: event.quantity,
          currency: event.currency,
          token_type: event.token_type,
          tokenType: event.token_type,
          status: event.status,
          is_reserved: event.is_reserved,
          isReserved: event.is_reserved,
          edition_id: event.edition_id,
        },
      }));
    },
    fallbackData,
    "fetchMarketplaceEvents",
  );
}

/**
 * Fetches marketplace events filtered by edition_id from the marketplace_events_with_relics view.
 */
export async function fetchMarketplaceEventsByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<MarketplaceEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.warn(
      "[marketplaceEventsByEditionId] Missing Supabase configuration",
    );
    return [];
  }

  const fallbackData: any[] = [];

  return withSupabaseFallback(
    `marketplace-events-edition-${editionId}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      // Query marketplace_events_with_relics view filtered by edition_id
      const url = `${root}/rest/v1/marketplace_events_with_relics?edition_id=eq.${editionId}&order=emitted_at.desc`;

      let response: Response;
      try {
        response = await fetch(url, {
          headers: headers(anonKey),
          signal,
        });
      } catch (fetchErr: any) {
        // Check if this is an abort error (intentional cancellation)
        if (fetchErr.name === "AbortError") {
          console.debug("[marketplaceEventsByEditionId] Request was cancelled");
          return [];
        }
        throw fetchErr;
      }

      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        const errorBody = await response.text().catch(() => "");
        console.warn(
          `[marketplaceEventsByEditionId] API failed with ${response.status} ${statusText}`,
          { url, error: errorBody },
        );
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      let data: Array<any>;

      try {
        data = await response.json();
      } catch (parseErr: any) {
        // Check if this is an abort error
        if (parseErr.name === "AbortError") {
          console.debug(
            "[marketplaceEventsByEditionId] Request was cancelled during parsing",
          );
          return [];
        }
        console.warn(
          "[marketplaceEventsByEditionId] Failed to parse response as JSON:",
          parseErr,
        );
        throw parseErr;
      }

      if (!Array.isArray(data)) {
        console.warn(
          "[marketplaceEventsByEditionId] Response data is not an array:",
          {
            data,
          },
        );
        throw new Error("Response data is not an array");
      }

      // Convert to MarketplaceEvent format with all marketplace data and relic data for display
      return data.map((event: any) => ({
        id: String(event.id),
        tx_hash: event.tx_hash || "",
        event_name: event.event_name || "",
        emitted_at: event.emitted_at || "",
        raw_log: "",
        // Serial/Relic fields from the view join with RelicSerialsJoined (top level)
        PlayerName: event.PlayerName || undefined,
        team: event.team || undefined,
        TierValue: event.TierValue || undefined,
        SetName: event.SetName || undefined,
        SeriesName: event.SeriesName || undefined,
        serial: event.serial != null ? event.serial : undefined,
        Minted: event.Minted || undefined,
        decoded: {
          listingId: event.listing_id ? String(event.listing_id) : undefined,
          listing_id: event.listing_id ? String(event.listing_id) : undefined,
          listing_creator: event.listing_creator,
          listingCreator: event.listing_creator,
          listing_creator_username: event.listing_creator_username,
          listingCreatorUsername: event.listing_creator_username,
          pricePerToken: event.price_per_token,
          price_per_token: event.price_per_token,
          listingStartTs: event.listing_start_ts,
          listing_start_ts: event.listing_start_ts,
          listingEndTs: event.listing_end_ts,
          listing_end_ts: event.listing_end_ts,
          quantityBought: event.quantity_bought,
          quantity_bought: event.quantity_bought,
          auctionId: event.auction_id ? String(event.auction_id) : undefined,
          auction_id: event.auction_id ? String(event.auction_id) : undefined,
          auction_creator: event.auction_creator,
          auctionCreator: event.auction_creator,
          auction_creator_username: event.auction_creator_username,
          auctionCreatorUsername: event.auction_creator_username,
          minimumBidAmount: event.minimum_bid_amount,
          minimum_bid_amount: event.minimum_bid_amount,
          buyoutBidAmount: event.buyout_bid_amount,
          buyout_bid_amount: event.buyout_bid_amount,
          bid_amount: event.bid_amount,
          bidAmount: event.bid_amount,
          bidder_username: event.bidder_username,
          bidderUsername: event.bidder_username,
          auctionStartTs: event.auction_start_ts,
          auction_start_ts: event.auction_start_ts,
          auctionEndTs: event.auction_end_ts,
          auction_end_ts: event.auction_end_ts,
          closer: event.closer,
          winning_bidder: event.winning_bidder,
          winningBidder: event.winning_bidder,
          winning_bidder_username: event.winning_bidder_username,
          winningBidderUsername: event.winning_bidder_username,
          max_bid: event.max_bid,
          maxBid: event.max_bid,
          offerId: event.offer_id ? String(event.offer_id) : undefined,
          offer_id: event.offer_id ? String(event.offer_id) : undefined,
          offeror: event.offeror,
          offeror_username: event.offeror_username,
          offerorUsername: event.offeror_username,
          seller: event.seller,
          seller_username: event.seller_username,
          sellerUsername: event.seller_username,
          total_price: event.total_price,
          totalPrice: event.total_price,
          offerExpirationTs: event.offer_expiration_ts,
          offer_expiration_ts: event.offer_expiration_ts,
          buyer: event.buyer,
          buyer_username: event.buyer_username,
          buyerUsername: event.buyer_username,
          totalPricePaid: event.total_price_paid,
          total_price_paid: event.total_price_paid,
          from_address_username: event.from_address_username,
          fromAddressUsername: event.from_address_username,
          to_address_username: event.to_address_username,
          toAddressUsername: event.to_address_username,
          tokenId: event.token_id
            ? String(event.token_id)
            : event.max_token_id
              ? String(event.max_token_id)
              : undefined,
          token_id: event.token_id
            ? String(event.token_id)
            : event.max_token_id
              ? String(event.max_token_id)
              : undefined,
          max_token_id: event.max_token_id
            ? String(event.max_token_id)
            : undefined,
          maxTokenId: event.max_token_id
            ? String(event.max_token_id)
            : undefined,
          asset_contract: event.asset_contract,
          assetContract: event.asset_contract,
          quantity: event.quantity,
          currency: event.currency,
          token_type: event.token_type,
          tokenType: event.token_type,
          status: event.status,
          is_reserved: event.is_reserved,
          isReserved: event.is_reserved,
          edition_id: event.edition_id,
        },
      }));
    },
    fallbackData,
    "fetchMarketplaceEventsByEditionId",
  );
}

export async function enrichEventWithRelicData(
  event: MarketplaceEvent,
): Promise<MarketplaceEvent> {
  try {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;

    if (!baseUrl || !anonKey) {
      return event;
    }

    // Extract max_token_id from decoded field
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    const maxTokenId = decoded?.max_token_id || decoded?.maxTokenId;

    if (!maxTokenId) {
      return event;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${maxTokenId}&select=team,TierValue,SeriesName&limit=1`;

    const response = await fetch(url, {
      headers: headers(anonKey),
    });

    if (!response.ok) {
      return event;
    }

    const results = (await response.json()) as Array<{
      team?: string | null;
      TierValue?: string | null;
      SeriesName?: string | null;
    }>;

    if (results.length === 0) {
      return event;
    }

    const relicData = results[0];

    return {
      ...event,
      team: relicData.team || undefined,
      TierValue: relicData.TierValue || undefined,
      SeriesName: relicData.SeriesName || undefined,
    };
  } catch (err) {
    console.debug("Error enriching event with relic data:", err);
    return event;
  }
}

export async function enrichEventWithDetails(
  event: MarketplaceEvent,
): Promise<MarketplaceEvent> {
  // Username fields are now pre-joined from the marketplace_events_with_relics view
  // No additional enrichment needed
  return event;
}

export async function resolveTokenIdFromEvent(
  event: MarketplaceEvent,
): Promise<number | null> {
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    // First try token_id field (both camelCase and snake_case)
    if (decoded?.tokenId) {
      const tokenId = parseInt(String(decoded.tokenId), 10);
      return Number.isFinite(tokenId) ? tokenId : null;
    }
    if (decoded?.token_id) {
      const tokenId = parseInt(String(decoded.token_id), 10);
      return Number.isFinite(tokenId) ? tokenId : null;
    }

    // If no token_id, use max_token_id from marketplace_events_with_relics view
    if (decoded?.max_token_id || decoded?.maxTokenId) {
      const tokenId = parseInt(
        String(decoded.max_token_id || decoded.maxTokenId),
        10,
      );
      return Number.isFinite(tokenId) ? tokenId : null;
    }

    return null;
  } catch (err) {
    console.debug("Error resolving token ID from event:", err);
    return null;
  }
}

export async function fetchSerialData(
  tokenId: number,
): Promise<SerialData | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return null;
  }

  return withSupabaseFallback(
    `serial-data-${tokenId}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Query RelicSerialsJoined view which has all the data we need
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${tokenId}&select=edition_id,serial,PlayerName,image_url,TierValue,Minted,GameDate,CreateDate,SetName,Badge1,Badge2,Badge3,team&limit=1`;

      const response = await fetch(url, {
        headers: headers(anonKey),
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const text = await response.text();
      if (!text) {
        throw new Error("No data returned from RelicSerialsJoined");
      }

      const results = JSON.parse(text) as Array<{
        edition_id: number;
        serial: number;
        PlayerName: string | null;
        image_url: string | null;
        TierValue: string | null;
        Minted: number | null;
        GameDate: string | null;
        CreateDate: string | null;
        SetName: string | null;
        Badge1: string | null;
        Badge2: string | null;
        Badge3: string | null;
        team: string | null;
      }>;

      if (results.length === 0) {
        return null;
      }

      const data = results[0];

      const convertBadgeToImage = (
        badgeValue: string | null,
      ): string | undefined => {
        if (!badgeValue) return undefined;
        const badge = String(badgeValue).toUpperCase();
        if (badge === "CP") return "/images/cp-badge.webp";
        if (badge === "RY") return "/images/ry-badge.webp";
        if (badge === "CY") return "/images/cy-badge.webp";
        return undefined;
      };

      return {
        id: data.edition_id,
        name: data.PlayerName || undefined,
        thumb: data.image_url || undefined,
        tier: data.TierValue || undefined,
        serial: data.serial,
        minted: data.Minted || undefined,
        gameDate: data.GameDate || undefined,
        createDate: data.CreateDate || undefined,
        setName: data.SetName || undefined,
        badge: convertBadgeToImage(data.Badge1),
        badge2: convertBadgeToImage(data.Badge2),
        badge3: convertBadgeToImage(data.Badge3),
        team: data.team || undefined,
      };
    },
    null,
    "fetchSerialData",
  );
}

export function extractBasicSerialDataFromEvent(
  event: MarketplaceEvent,
): Partial<SerialData> | null {
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (!decoded || typeof decoded !== "object") {
      return null;
    }

    // Extract basic serial data available from marketplace_events_with_relics view
    // The view includes: PlayerName, SetName, serial, Minted (from RelicSerialsJoined join)
    if (
      decoded.PlayerName ||
      decoded.serial != null ||
      decoded.minted != null ||
      decoded.Minted != null
    ) {
      return {
        name: decoded.PlayerName || decoded.playerName || undefined,
        serial: decoded.serial != null ? decoded.serial : undefined,
        minted: decoded.minted || decoded.Minted || undefined,
        setName: decoded.SetName || decoded.setName || undefined,
      };
    }

    return null;
  } catch (err) {
    console.debug("Error extracting basic serial data from event:", err);
    return null;
  }
}

/**
 * Fetches the most recent listing/auction emitted_at timestamp for each edition_id.
 * Groups by edition_id and aggregates the MAX(emitted_at) for NewListing and NewAuction events.
 * Returns a map of edition_id -> ISO timestamp string.
 */
export async function fetchRecentListingsByEdition(
  signal?: AbortSignal,
): Promise<Record<number, string>> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.warn(
      "[fetchRecentListingsByEdition] Missing Supabase configuration",
    );
    return {};
  }

  const fallbackData: Record<number, string> = {};

  return withSupabaseFallback(
    "recent-listings-by-edition",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      // Query marketplace_events_with_relics for NewListing and NewAuction events
      // ordered by emitted_at descending, grouped conceptually by edition_id
      const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=in.("NewListing","NewAuction")&order=emitted_at.desc&select=edition_id,emitted_at`;

      const response = await fetch(url, {
        headers: headers(anonKey),
        signal,
      });

      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        const errorBody = await response.text().catch(() => "");
        console.warn(
          `[fetchRecentListingsByEdition] API failed with ${response.status} ${statusText}`,
          { url, error: errorBody },
        );
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      let data: Array<any>;

      try {
        data = await response.json();
      } catch (parseErr) {
        console.warn(
          "[fetchRecentListingsByEdition] Failed to parse response as JSON:",
          parseErr,
        );
        throw parseErr;
      }

      if (!Array.isArray(data)) {
        console.warn(
          "[fetchRecentListingsByEdition] Response data is not an array:",
          {
            data,
          },
        );
        throw new Error("Response data is not an array");
      }

      // Group by edition_id and keep the first (most recent) emitted_at for each
      const result: Record<number, string> = {};
      for (const event of data) {
        const editionId = Number(event.edition_id);
        const emittedAt = String(event.emitted_at || "");

        if (Number.isFinite(editionId) && emittedAt && !result[editionId]) {
          result[editionId] = emittedAt;
        }
      }

      return result;
    },
    fallbackData,
    "fetchRecentListingsByEdition",
  );
}

/**
 * Parses a Supabase ISO timestamp string into a Date object.
 */
export function parseSupabaseTimestamp(timestamp: string): Date | null {
  try {
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * Checks if an auction has been closed/settled by querying for the AuctionClosed event.
 * Used to determine if an auction needs settlement or is already settled.
 */
export async function checkAuctionClosed(auctionId: string): Promise<boolean> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      console.debug("[checkAuctionClosed] Missing Supabase configuration");
      return false;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(auctionId)}&event_name=eq.AuctionClosed&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      console.debug(
        "[checkAuctionClosed] Failed to fetch auction closed event:",
        response.status,
      );
      return false;
    }

    const data = (await response.json()) as Array<any>;
    return data.length > 0;
  } catch (error) {
    console.debug("[checkAuctionClosed] Error:", error);
    return false;
  }
}

/**
 * Fetches all editions that have had prior sales
 * Returns a Set of edition_ids for efficient lookup
 */
export async function fetchEditionsWithPriorSales(
  signal?: AbortSignal,
): Promise<Set<number>> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.warn("[fetchEditionsWithPriorSales] Missing Supabase configuration");
    return new Set();
  }

  try {
    const root = baseUrl.replace(/\/$/, "");
    // Fetch all NewSale events and extract unique edition_ids
    const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&select=max_token_id`;

    let response: Response;
    try {
      response = await fetch(url, {
        headers: headers(anonKey),
        signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === "AbortError") {
        console.debug("[fetchEditionsWithPriorSales] Request was cancelled");
        return new Set();
      }
      throw fetchErr;
    }

    if (!response.ok) {
      console.debug("[fetchEditionsWithPriorSales] Failed to fetch sales data:", {
        status: response.status,
      });
      return new Set();
    }

    const data = (await response.json()) as Array<any>;
    const editionsWithSales = new Set<number>();

    for (const event of data) {
      if (event.max_token_id) {
        editionsWithSales.add(Number(event.max_token_id));
      }
    }

    console.debug(
      `[fetchEditionsWithPriorSales] Found ${editionsWithSales.size} editions with prior sales`,
    );

    return editionsWithSales;
  } catch (error) {
    console.debug("[fetchEditionsWithPriorSales] Error:", error);
    return new Set();
  }
}
