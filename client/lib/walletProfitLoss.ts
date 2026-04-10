/**
 * Helper functions to fetch and calculate token data by wallet owner
 * Joins RelicSerialsJoined with RMV table to get rolling median values
 */

import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface OwnedTokenData {
  edition_id: number;
  serial: number;
  token_id: string | number;
  team?: string | null;
}

export interface RMVData {
  edition_id: number;
  rolling_median_sale: string | null;
}

export interface AcquisitionEventData {
  event_name: string;
  total_price_paid: string | null;
  total_price: string | null;
  max_bid: string | null;
  emitted_at: string;
  PlayerName?: string | null;
  SetName?: string | null;
  Minted?: number | null;
}

export interface AcquisitionData {
  price: number;
  PlayerName: string | null;
  SetName: string | null;
  Minted: number | null;
  emitted_at: string | null;
}

export interface OwnedTokenWithValue {
  edition_id: number;
  serial: number;
  token_id: string | number;
  rolling_median_sale: string | null;
  value: number;
  price_paid: number;
  profit_loss: number;
  displayLabel: string;
  PlayerName?: string | null;
  SetName?: string | null;
  Minted?: number | null;
  emitted_at?: string | null;
  team?: string | null;
}

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Fetch all RMV data (rolling median value per edition)
 * Uses cache with withSupabaseFallback
 */
export async function fetchAllRMVData(
  signal?: AbortSignal,
): Promise<RMVData[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");
  const fallbackData: RMVData[] = [];

  return withSupabaseFallback(
    "rmv-all-data",
    async () => {
      const url = `${root}/rest/v1/RMV?select=edition_id,rolling_median_sale`;

      console.debug("[fetchAllRMVData] Fetching from:", url);

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (!res.ok) {
        if (res.status >= 500) {
        // 500 errors are expected when records don't exist - silently use fallback
        return fallbackData;
      }
        return fallbackData;
      }

      const rows = (await res.json().catch(() => null)) as RMVData[] | null;
      if (!Array.isArray(rows)) {
        throw new Error("Invalid response format");
      }

      console.debug("[fetchAllRMVData] Fetched", rows.length, "RMV records");
      return rows;
    },
    fallbackData,
    "fetchAllRMVData",
  );
}

/**
 * Fetch edition metadata from the Minted table
 */
export async function fetchEditionMetadata(
  editionId: number,
  signal?: AbortSignal,
): Promise<{ PlayerName: string | null; SetName: string | null; Minted: number | null }> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    return { PlayerName: null, SetName: null, Minted: null };
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/Minted?edition_id=eq.${editionId}&select=PlayerName,SetName,Minted&limit=1`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (res.ok) {
      const rows = (await res.json().catch(() => null)) as
        | Array<{ PlayerName: string | null; SetName: string | null; Minted: number | null }>
        | null;

      if (Array.isArray(rows) && rows[0]) {
        return {
          PlayerName: rows[0].PlayerName || null,
          SetName: rows[0].SetName || null,
          Minted: rows[0].Minted || null,
        };
      }
    }
  } catch (e) {
    // Network errors or abort - silently fail
  }

  return { PlayerName: null, SetName: null, Minted: null };
}

/**
 * Fetch the acquisition price and metadata for a specific token from marketplace events
 * Gets the MOST RECENT transaction among NewSale, AcceptedOffer, or AuctionClosed
 * Falls back to edition metadata if marketplace event not found
 */
export async function fetchAcquisitionPrice(
  tokenId: string | number,
  editionId: number,
  signal?: AbortSignal,
): Promise<AcquisitionData> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !tokenId) {
    return {
      price: 0,
      PlayerName: null,
      SetName: null,
      Minted: null,
    };
  }

  const root = baseUrl.replace(/\/$/, "");

  // Query marketplace_events_with_relics for NewSale, AcceptedOffer, or AuctionClosed
  // Use max_token_id to match the token
  // Use OR filter to get all three event types, then sort by emitted_at desc to get most recent
  const url = `${root}/rest/v1/marketplace_events_with_relics?max_token_id=eq.${encodeURIComponent(
    tokenId,
  )}&or=(event_name.eq.NewSale,event_name.eq.AcceptedOffer,event_name.eq.AuctionClosed)&order=emitted_at.desc&select=event_name,total_price_paid,total_price,max_bid,emitted_at,PlayerName,SetName,Minted&limit=1`;

  try {
    console.debug("[fetchAcquisitionPrice] Fetching from URL:", url);

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    console.debug("[fetchAcquisitionPrice] Response status:", res.status);

    if (res.ok) {
      const rows = (await res.json().catch(() => null)) as
        | AcquisitionEventData[]
        | null;

      console.debug("[fetchAcquisitionPrice] Raw response rows:", rows);

      if (Array.isArray(rows) && rows[0]) {
        const event = rows[0];
        console.debug(
          "[fetchAcquisitionPrice] Event for token",
          tokenId,
          ":",
          event,
        );

        // Coalesce price fields: total_price_paid (NewSale), total_price (AcceptedOffer), max_bid (ClosedAuction)
        const priceStr =
          event.total_price_paid || event.total_price || event.max_bid;
        console.debug(
          "[fetchAcquisitionPrice] Price string for token",
          tokenId,
          "- total_price_paid:",
          event.total_price_paid,
          ", total_price:",
          event.total_price,
          ", max_bid:",
          event.max_bid,
          "-> final:",
          priceStr,
        );

        const price = parsePriceToNumber(priceStr);
        console.debug(
          "[fetchAcquisitionPrice] Final price for token",
          tokenId,
          ":",
          price,
        );
        return {
          price,
          PlayerName: event.PlayerName || null,
          SetName: event.SetName || null,
          Minted: event.Minted || null,
          emitted_at: event.emitted_at || null,
        };
      } else {
        console.warn(
          "[fetchAcquisitionPrice] No marketplace events found for token",
          tokenId,
          "- will fallback to edition metadata",
        );
        // Fallback to edition metadata from Minted table
        const editionData = await fetchEditionMetadata(editionId, signal);
        return {
          price: 0,
          PlayerName: editionData.PlayerName,
          SetName: editionData.SetName,
          Minted: editionData.Minted,
          emitted_at: null,
        };
      }
    } else {
      // 500 errors - fallback to edition metadata
      const editionData = await fetchEditionMetadata(editionId, signal);
      return {
        price: 0,
        PlayerName: editionData.PlayerName,
        SetName: editionData.SetName,
        Minted: editionData.Minted,
        emitted_at: null,
      };
    }
  } catch (e: any) {
    if (e?.name === "AbortError")
      return {
        price: 0,
        PlayerName: null,
        SetName: null,
        Minted: null,
        emitted_at: null,
      };
    // Network errors - fallback to edition metadata
    const editionData = await fetchEditionMetadata(editionId, signal);
    return {
      price: 0,
      PlayerName: editionData.PlayerName,
      SetName: editionData.SetName,
      Minted: editionData.Minted,
      emitted_at: null,
    };
  }
}

/**
 * Fetch all tokens owned by a wallet address from RelicSerialsJoined
 */
export async function fetchOwnedTokensByWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<OwnedTokenData[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !walletAddress) {
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");

  const url = `${root}/rest/v1/RelicSerialsJoined?current_owner=ilike.${encodeURIComponent(
    walletAddress,
  )}&select=edition_id,serial,token_id,team`;

  try {
    console.debug("[fetchOwnedTokensByWallet] Fetching from:", url);

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      // 500 errors are expected when records don't exist
      return [];
    }

    const rows = (await res.json().catch(() => null)) as
      | OwnedTokenData[]
      | null;
    if (Array.isArray(rows) && rows.length > 0) {
      console.debug(
        "[fetchOwnedTokensByWallet] Fetched",
        rows.length,
        "owned tokens",
      );
      return rows;
    }

    console.warn(
      "[fetchOwnedTokensByWallet] No owned tokens found for wallet",
      walletAddress,
    );
    return [];
  } catch (e: any) {
    if (e?.name === "AbortError") return [];
    // Network errors are expected - silently return empty
    return [];
  }
}

/**
 * Convert BigInt-like price strings to numeric values
 */
export function parsePriceToNumber(price: string | null | undefined): number {
  if (!price) {
    console.debug("[parsePriceToNumber] No price provided");
    return 0;
  }

  try {
    const bigIntValue = BigInt(price);
    const numValue = Number(bigIntValue) / 1e18;
    console.debug(
      "[parsePriceToNumber] Converted",
      price,
      "to BigInt",
      bigIntValue.toString(),
      "to number",
      numValue,
    );
    return isFinite(numValue) ? numValue : 0;
  } catch (e) {
    // Failed to parse - return 0 as fallback
    return 0;
  }
}

/**
 * Transform owned tokens data into chart-ready format
 * Joins RelicSerialsJoined with RMV data and fetches acquisition prices
 */
export async function getOwnedTokensForChart(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<OwnedTokenWithValue[]> {
  const ownedTokens = await fetchOwnedTokensByWallet(walletAddress, signal);
  const rmvData = await fetchAllRMVData(signal);

  if (ownedTokens.length === 0) {
    console.warn("[getOwnedTokensForChart] No owned tokens found");
    return [];
  }

  // Create a map of edition_id -> rolling_median_sale for fast lookup
  const rmvMap = new Map<number, string | null>();
  for (const rmv of rmvData) {
    rmvMap.set(rmv.edition_id, rmv.rolling_median_sale);
  }

  // Join owned tokens with RMV data (don't filter - show all owned tokens even without RMV)
  const joined = ownedTokens
    .map((token) => ({
      edition_id: token.edition_id,
      serial: token.serial,
      token_id: token.token_id,
      team: token.team || null,
      rolling_median_sale: rmvMap.get(token.edition_id) || null,
    }));

  if (joined.length === 0) {
    console.warn(
      "[getOwnedTokensForChart] No owned tokens found",
    );
    return [];
  }

  // Fetch acquisition prices in parallel, passing edition_id for metadata fallback
  const acquisitionPrices = await Promise.all(
    joined.map((token) => fetchAcquisitionPrice(token.token_id, token.edition_id, signal)),
  );

  // Transform and calculate profit/loss
  const withProfitLoss = joined.map((token, index) => {
    const value = parsePriceToNumber(token.rolling_median_sale);
    const acquisitionData = acquisitionPrices[index];
    const price_paid = acquisitionData.price;
    const profit_loss = value - price_paid;
    const playerName = acquisitionData.PlayerName || "Unknown";
    const minted = acquisitionData.Minted || 0;
    return {
      ...token,
      value,
      price_paid,
      profit_loss,
      PlayerName: acquisitionData.PlayerName,
      SetName: acquisitionData.SetName,
      Minted: acquisitionData.Minted,
      emitted_at: acquisitionData.emitted_at,
      displayLabel: `${playerName} - #${token.serial} of ${minted}`,
    };
  });

  // Sort by profit_loss descending (highest profit first, then losses), excluding items with no value or name
  // but keep them in the list - just sorted to the end
  return withProfitLoss.sort((a, b) => {
    // Items with valid data (have PlayerName and Minted) come first
    const aValid = a.PlayerName && a.Minted && a.Minted > 0;
    const bValid = b.PlayerName && b.Minted && b.Minted > 0;

    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    // Among items with valid data, sort by profit_loss descending
    return b.profit_loss - a.profit_loss;
  });
}
