import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface MarketplaceUserEvent {
  emitted_at: string;
  listing_creator?: string;
  total_price_paid?: string;
  auction_creator?: string;
  bid_amount?: string;
  seller?: string;
  total_price?: string;
  max_token_id?: number;
  PlayerName?: string;
  SetName?: string;
  serial?: number;
  Minted?: number;
  max_bid?: string;
  event_name: string;
  bidder?: string;
  buyer?: string;
  offeror?: string;
}

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Fetches marketplace events filtered by specific event names (NewOffer, NewSale, NewBid)
 * for a given user, indexed by bidder, buyer, and offeror.
 * Returns the stored values: emitted_at, listing_creator, total_price_paid, auction_creator,
 * bid_amount, seller, total_price, max_token_id, PlayerName, SetName, serial, Minted, max_bid
 */
export async function fetchMarketplaceUserEvents(
  userAddress: string,
  signal?: AbortSignal,
): Promise<MarketplaceUserEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("[marketplaceUserData] Missing Supabase configuration");
    return [];
  }

  if (!userAddress) {
    console.error("[marketplaceUserData] Missing user address");
    return [];
  }

  // Normalize address to lowercase for consistent querying
  const normalizedAddress = userAddress.toLowerCase();

  const fallbackData: MarketplaceUserEvent[] = [];

  return withSupabaseFallback(
    `marketplace-user-events-${normalizedAddress}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Query marketplace_events_with_relics filtered by event names and user address
      // Split NewSale into separate queries for buyer and seller to avoid OR syntax issues
      const events = await Promise.all([
        // NewOffer events where offeror matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewOffer&offeror=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewSale events where buyer matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&buyer=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewSale events where seller matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&seller=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewBid events where bidder matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewBid&bidder=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
      ]);

      // Collect successful responses (non-200 errors are logged but not thrown)
      const successfulResponses: Response[] = [];
      for (let i = 0; i < events.length; i++) {
        if (!events[i].ok) {
          // Log the error but continue - some queries might fail but others succeed
          const statusText = events[i].statusText || `HTTP ${events[i].status}`;
          const errorBody = await events[i].text().catch(() => "");
          console.warn(
            `[marketplaceUserData] API warning: ${events[i].status} ${statusText}`,
            { error: errorBody },
          );
          // Skip this response but continue with others
          continue;
        }
        successfulResponses.push(events[i]);
      }

      // Parse all successful responses
      const allData: MarketplaceUserEvent[] = [];
      for (const response of successfulResponses) {
        let data: Array<any>;
        try {
          data = await response.json();
        } catch (parseErr: any) {
          // Check if this is an abort error
          if (parseErr.name === "AbortError") {
            console.debug("[marketplaceUserData] Request was cancelled");
            return [];
          }
          console.error(
            "[marketplaceUserData] Failed to parse response as JSON:",
            parseErr,
          );
          throw parseErr;
        }

        if (!Array.isArray(data)) {
          console.error("[marketplaceUserData] Response data is not an array:", {
            data,
          });
          throw new Error("Response data is not an array");
        }

        allData.push(...data);
      }

      // Sort by emitted_at descending
      allData.sort(
        (a, b) =>
          new Date(b.emitted_at || 0).getTime() -
          new Date(a.emitted_at || 0).getTime(),
      );

      console.debug(
        "[marketplaceUserData] Successfully fetched",
        allData.length,
        "user events",
      );

      return allData;
    },
    fallbackData,
    `marketplace-user-events-${normalizedAddress}`,
  );
}

/**
 * Fetches marketplace events for a user filtered by a specific event type
 */
export async function fetchMarketplaceUserEventsByType(
  userAddress: string,
  eventName: "NewOffer" | "NewSale" | "NewBid",
  signal?: AbortSignal,
): Promise<MarketplaceUserEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("[marketplaceUserData] Missing Supabase configuration");
    return [];
  }

  if (!userAddress) {
    console.error("[marketplaceUserData] Missing user address");
    return [];
  }

  // Normalize address to lowercase for consistent querying
  const normalizedAddress = userAddress.toLowerCase();

  const fallbackData: MarketplaceUserEvent[] = [];

  return withSupabaseFallback(
    `marketplace-user-events-${normalizedAddress}-${eventName}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      let urls: string[];

      if (eventName === "NewOffer") {
        // NewOffer events where offeror matches user
        urls = [`${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewOffer&offeror=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`];
      } else if (eventName === "NewSale") {
        // NewSale events where buyer or seller matches user - use two queries to avoid OR syntax issues
        urls = [
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&buyer=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&seller=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`,
        ];
      } else {
        // NewBid events where bidder matches user
        urls = [`${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewBid&bidder=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc`];
      }

      const allData: MarketplaceUserEvent[] = [];

      for (const url of urls) {
        console.debug("[marketplaceUserData] Fetching from:", url);

        const response = await fetch(url, {
          headers: headers(anonKey),
          signal,
        });

        if (!response.ok) {
          const statusText = response.statusText || `HTTP ${response.status}`;
          const errorBody = await response.text().catch(() => "");
          console.warn(
            `[marketplaceUserData] API warning: ${response.status} ${statusText}`,
            { url, error: errorBody },
          );
          // Continue with other queries if one fails
          continue;
        }

        let data: Array<any>;

        try {
          data = await response.json();
        } catch (parseErr: any) {
          // Check if this is an abort error
          if (parseErr.name === "AbortError") {
            console.debug("[marketplaceUserData] Request was cancelled");
            return [];
          }
          console.error(
            "[marketplaceUserData] Failed to parse response as JSON:",
            parseErr,
          );
          throw parseErr;
        }

        if (!Array.isArray(data)) {
          console.error("[marketplaceUserData] Response data is not an array:", {
            data,
          });
          throw new Error("Response data is not an array");
        }

        allData.push(...data);
      }

      // Sort by emitted_at descending
      allData.sort(
        (a, b) =>
          new Date(b.emitted_at || 0).getTime() -
          new Date(a.emitted_at || 0).getTime(),
      );

      console.debug(
        "[marketplaceUserData] Successfully fetched",
        allData.length,
        `${eventName} events for user`,
      );

      return allData;
    },
    fallbackData,
    `marketplace-user-events-${userAddress}-${eventName}`,
  );
}

/**
 * Fetches marketplace events for a user with pagination support
 */
export async function fetchMarketplaceUserEventsPaginated(
  userAddress: string,
  offset: number = 0,
  limit: number = 20,
  signal?: AbortSignal,
): Promise<MarketplaceUserEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("[marketplaceUserData] Missing Supabase configuration");
    return [];
  }

  if (!userAddress) {
    console.error("[marketplaceUserData] Missing user address");
    return [];
  }

  // Normalize address to lowercase for consistent querying
  const normalizedAddress = userAddress.toLowerCase();

  const fallbackData: MarketplaceUserEvent[] = [];

  return withSupabaseFallback(
    `marketplace-user-events-${normalizedAddress}-paginated-${offset}-${limit}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Query all event types with pagination
      // Split NewSale into separate queries for buyer and seller to avoid OR syntax issues
      const events = await Promise.all([
        // NewOffer events where offeror matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewOffer&offeror=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc&offset=${offset}&limit=${limit}`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewSale events where buyer matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&buyer=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc&offset=${offset}&limit=${limit}`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewSale events where seller matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewSale&seller=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc&offset=${offset}&limit=${limit}`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
        // NewBid events where bidder matches user
        fetch(
          `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.NewBid&bidder=eq.${encodeURIComponent(normalizedAddress)}&select=emitted_at,listing_creator,total_price_paid,auction_creator,bid_amount,seller,total_price,max_token_id,PlayerName,SetName,serial,Minted,max_bid,event_name,bidder,buyer,offeror&order=emitted_at.desc&offset=${offset}&limit=${limit}`,
          {
            headers: headers(anonKey),
            signal,
          },
        ),
      ]);

      // Collect successful responses (non-200 errors are logged but not thrown)
      const successfulResponses: Response[] = [];
      for (let i = 0; i < events.length; i++) {
        if (!events[i].ok) {
          const statusText = events[i].statusText || `HTTP ${events[i].status}`;
          const errorBody = await events[i].text().catch(() => "");
          console.warn(
            `[marketplaceUserData] API warning: ${events[i].status} ${statusText}`,
            { error: errorBody },
          );
          // Skip this response but continue with others
          continue;
        }
        successfulResponses.push(events[i]);
      }

      // Parse all successful responses
      const allData: MarketplaceUserEvent[] = [];
      for (const response of successfulResponses) {
        let data: Array<any>;
        try {
          data = await response.json();
        } catch (parseErr: any) {
          if (parseErr.name === "AbortError") {
            console.debug("[marketplaceUserData] Request was cancelled");
            return [];
          }
          console.error(
            "[marketplaceUserData] Failed to parse response as JSON:",
            parseErr,
          );
          throw parseErr;
        }

        if (!Array.isArray(data)) {
          console.error("[marketplaceUserData] Response data is not an array:", {
            data,
          });
          throw new Error("Response data is not an array");
        }

        allData.push(...data);
      }

      // Sort by emitted_at descending and limit to requested amount
      allData.sort(
        (a, b) =>
          new Date(b.emitted_at || 0).getTime() -
          new Date(a.emitted_at || 0).getTime(),
      );

      console.debug(
        "[marketplaceUserData] Successfully fetched",
        allData.length,
        "paginated user events",
      );

      return allData.slice(0, limit);
    },
    fallbackData,
    `marketplace-user-events-${userAddress}-paginated-${offset}-${limit}`,
  );
}

/**
 * Aggregates marketplace event statistics for a user
 */
export async function getMarketplaceUserStats(
  userAddress: string,
  signal?: AbortSignal,
): Promise<{
  totalOffers: number;
  totalSales: number;
  totalBids: number;
  totalSpent: string;
  totalEarned: string;
}> {
  const events = await fetchMarketplaceUserEvents(userAddress, signal);

  // Normalize address to lowercase for consistent comparison
  const normalizedAddress = userAddress.toLowerCase();

  let totalOffers = 0;
  let totalSales = 0;
  let totalBids = 0;
  let totalSpent = "0";
  let totalEarned = "0";

  const spentSet = new Set<string>();
  const earnedSet = new Set<string>();

  for (const event of events) {
    if (event.event_name === "NewOffer") {
      totalOffers++;
      if (event.total_price) {
        spentSet.add(event.total_price);
      }
    } else if (event.event_name === "NewSale") {
      totalSales++;
      if (event.total_price_paid) {
        if (event.buyer?.toLowerCase() === normalizedAddress) {
          spentSet.add(event.total_price_paid);
        } else {
          earnedSet.add(event.total_price_paid);
        }
      }
    } else if (event.event_name === "NewBid") {
      totalBids++;
      if (event.bid_amount) {
        spentSet.add(event.bid_amount);
      }
    }
  }

  return {
    totalOffers,
    totalSales,
    totalBids,
    totalSpent: Array.from(spentSet).join(", "),
    totalEarned: Array.from(earnedSet).join(", "),
  };
}
