import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface RelicSerialWithMetadata {
  token_id: string | number;
  edition_id: number;
  serial: number;
  claim_time?: string;
  PlayerName?: string;
  PlayDescription?: string;
  video_location?: string;
  TierValue?: string;
  league?: string;
  team?: string;
  SetName?: string;
  SeriesName?: string;
  GameDate?: string;
  drop_week?: string;
  Minted?: number;
  image_url?: string;
  animation_url?: string;
  Badge1?: string;
  Badge2?: string;
  Badge3?: string;
  CreateDate?: string;
  rolling_median_sale?: string;
  low_ask?: string;
}

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

export interface AlchemyTokenWithTime {
  tokenId: string;
  transferTime?: string;
}

export async function fetchRelicsFromAlchemy(
  walletAddress: string,
  rpcKey: string,
): Promise<AlchemyTokenWithTime[]> {
  if (!walletAddress || !rpcKey) return [];

  try {
    const relicContract = (import.meta as any).env.VITE_ERC721_ADDRESS as string | undefined;
    if (!relicContract) {
      return [];
    }
    const url = `https://polygon-mainnet.g.alchemy.com/nft/v3/${encodeURIComponent(
      rpcKey,
    )}/getNFTsForOwner?owner=${encodeURIComponent(
      walletAddress,
    )}&contractAddresses%5B%5D=${encodeURIComponent(
      relicContract,
    )}&withMetadata=true&orderBy=transferTime&pageSize=24`;

    const res = await fetch(url, {
      mode: "cors",
      cache: "no-store",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(
          "[fetchRelicsFromAlchemy] Failed to fetch from Alchemy:",
          res.status,
          res.statusText,
        );
      }
      return [];
    }

    const data = await res.json();
    const ownedNfts = Array.isArray(data?.ownedNfts) ? data.ownedNfts : [];

    const tokens = ownedNfts
      .map((nft: any) => {
        const tokenId = nft?.tokenId ?? nft?.id ?? null;
        if (!tokenId) return null;
        return {
          tokenId: String(tokenId),
          transferTime: nft?.acquiredAt?.blockTimestamp ?? undefined,
        };
      })
      .filter(
        (item: AlchemyTokenWithTime | null): item is AlchemyTokenWithTime =>
          item !== null,
      );

    console.log(
      "[fetchRelicsFromAlchemy] Fetched",
      tokens.length,
      "token IDs from Alchemy",
    );

    return tokens;
  } catch (err) {
    console.error("[fetchRelicsFromAlchemy] Error:", err);
    return [];
  }
}

export async function fetchRelicSerialsByTokenIds(
  tokenIds: string[],
  signal?: AbortSignal,
): Promise<Map<string, RelicSerialWithMetadata>> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  const emptyResult = new Map<string, RelicSerialWithMetadata>();

  if (
    !baseUrl ||
    !anonKey ||
    !Array.isArray(tokenIds) ||
    tokenIds.length === 0
  ) {
    return emptyResult;
  }

  return withSupabaseFallback(
    `relic-serials-${tokenIds.join("-")}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Batch fetch all token IDs in a single query
      // Supabase in() filter expects comma-separated values without individual encoding
      // Select only required columns to reduce view computation overhead
      const requiredColumns =
        "token_id,edition_id,serial,video_location,PlayerName,GameDate,CreateDate,SetName,Badge1,Badge2,Badge3,team,TierValue,Minted,claim_time";
      const tokenIdFilter = tokenIds.join(",");
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=in.(${tokenIdFilter})&select=${encodeURIComponent(requiredColumns)}`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return new Map<string, RelicSerialWithMetadata>();
      }

      const rows = (await res.json()) as RelicSerialWithMetadata[];

      if (!Array.isArray(rows)) {
        throw new Error("Invalid response format");
      }

      const result = new Map<string, RelicSerialWithMetadata>();
      for (const row of rows) {
        const tokenId = String(row.token_id);
        result.set(tokenId, row);
      }

      console.log(
        "[fetchRelicSerialsByTokenIds] Fetched metadata for",
        result.size,
        "token IDs",
      );

      return result;
    },
    emptyResult,
    "fetchRelicSerialsByTokenIds",
  );
}

export async function fetchRelicSerialByTokenId(
  tokenId: string | number,
  signal?: AbortSignal,
): Promise<RelicSerialWithMetadata | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !tokenId) {
    return null;
  }

  return withSupabaseFallback(
    `relic-serial-${tokenId}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      // Select only required columns to reduce view computation overhead
      const requiredColumns =
        "token_id,edition_id,serial,video_location,PlayerName,GameDate,CreateDate,SetName,Badge1,Badge2,Badge3,team,TierValue,Minted,claim_time";
      const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(
        tokenId,
      )}&select=${encodeURIComponent(requiredColumns)}&limit=1`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return null;
      }

      const rows = (await res.json()) as RelicSerialWithMetadata[];

      if (Array.isArray(rows) && rows[0]) {
        return rows[0];
      }

      return null;
    },
    null,
    "fetchRelicSerialByTokenId",
  );
}
