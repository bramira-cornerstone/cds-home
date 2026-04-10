import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface MintedRow {
  edition_id: number;
  [key: string]: any;
}

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

export async function fetchMintedEditionIds(
  signal?: AbortSignal,
): Promise<number[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    "minted-edition-ids",
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?select=edition_id&order=edition_id.asc`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as MintedRow[];
      const ids = rows
        .map((r) => r?.edition_id)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
      return Array.from(new Set(ids));
    },
    [],
    "fetchMintedEditionIds",
  );
}

export async function fetchMintedEditionIdsPaginated(
  offset: number = 0,
  limit: number = 48,
  signal?: AbortSignal,
): Promise<number[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    `minted-edition-ids-paginated-${offset}-${limit}`,
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?select=edition_id&order=edition_id.asc&offset=${offset}&limit=${limit}`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as MintedRow[];
      const ids = rows
        .map((r) => r?.edition_id)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
      return Array.from(new Set(ids));
    },
    [],
    `minted-edition-ids-paginated-${offset}-${limit}`,
  );
}

export async function fetchMintedEditionIdsByStatus(
  itemStatus: string,
  signal?: AbortSignal,
): Promise<number[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    `minted-edition-ids-${itemStatus}`,
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?item_status=eq.${encodeURIComponent(itemStatus)}&select=edition_id&order=edition_id.asc`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as MintedRow[];
      const ids = rows
        .map((r) => r?.edition_id)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
      return Array.from(new Set(ids));
    },
    [],
    "fetchMintedEditionIdsByStatus",
  );
}

export async function fetchLatestMintedEditionIds(
  limit: number = 10,
  signal?: AbortSignal,
): Promise<number[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    `minted-latest-edition-ids-${limit}`,
    async () => {
      // Exclude 'Fan Favorite' SetName and order by edition_id descending
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?SetName=neq.Fan%20Favorite&select=edition_id&order=edition_id.desc&limit=${limit}`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as MintedRow[];
      const ids = rows
        .map((r) => r?.edition_id)
        .filter(
          (v): v is number => typeof v === "number" && Number.isFinite(v),
        );
      return Array.from(new Set(ids));
    },
    [],
    `minted-latest-edition-ids-${limit}`,
  );
}

export async function fetchMintedByEditionId(
  id: number,
  signal?: AbortSignal,
): Promise<(MintedRow & { SeriesName?: string; TierValue?: string }) | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(id)) return null;

  return withSupabaseFallback(
    `minted-by-edition-${id}`,
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?edition_id=eq.${encodeURIComponent(
        id,
      )}&select=*&limit=1`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return null;
      }
      const rows = (await res.json()) as (MintedRow & {
        SeriesName?: string;
        TierValue?: string;
      })[];
      return (Array.isArray(rows) && rows[0]) || null;
    },
    null,
    "fetchMintedByEditionId",
  );
}

export async function fetchMintedByTierAndDropWeek(
  tierValue: string,
  dropWeek: string,
  signal?: AbortSignal,
): Promise<MintedRow[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    `minted-tier-dropweek-${tierValue}-${dropWeek}`,
    async () => {
      const params = new URLSearchParams({
        select: "*",
        order: "edition_id.asc",
      });
      // Use eq filters; Supabase REST allows multiple filters via query string
      const filters = [
        `TierValue=eq.${encodeURIComponent(tierValue)}`,
        `drop_week=eq.${encodeURIComponent(dropWeek)}`,
      ].join("&");
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?${filters}&${params.toString()}`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as MintedRow[];
      return Array.isArray(rows) ? rows : [];
    },
    [],
    "fetchMintedByTierAndDropWeek",
  );
}

export async function fetchMintedBySerials(
  serials: number[],
  signal?: AbortSignal,
): Promise<(Pick<MintedRow, "edition_id"> & { SerialFront?: number })[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Array.isArray(serials) || serials.length === 0)
    return [];
  const uniq = Array.from(new Set(serials.filter((n) => Number.isFinite(n))));
  if (uniq.length === 0) return [];

  return withSupabaseFallback(
    `minted-by-serials-${uniq.join("-")}`,
    async () => {
      const list = `(${uniq.join(",")})`;
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?SerialFront=in.${encodeURIComponent(list)}&select=edition_id,SerialFront`;
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
        return [];
      }
      const rows = (await res.json()) as (Pick<MintedRow, "edition_id"> & {
        SerialFront?: number;
      })[];
      return Array.isArray(rows) ? rows : [];
    },
    [],
    "fetchMintedBySerials",
  );
}

export async function fetchAllMinted(signal?: AbortSignal): Promise<
  (MintedRow & {
    edition_id: number;
    GameDate?: string;
    Minted?: number;
    PlayerName?: string;
  })[]
> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    "all-minted",
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?select=edition_id,GameDate,Minted,PlayerName&order=GameDate.asc,Minted.asc,PlayerName.asc`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return [];
      }
      const rows = (await res.json()) as (MintedRow & {
        edition_id: number;
        GameDate?: string;
        Minted?: number;
        PlayerName?: string;
      })[];
      return Array.isArray(rows) ? rows : [];
    },
    [],
    "fetchAllMinted",
  );
}

export async function fetchMintedByDropWeek(
  dropWeek: string,
  signal?: AbortSignal,
): Promise<MintedRow | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !dropWeek) return null;

  return withSupabaseFallback(
    `minted-by-dropweek-${dropWeek}`,
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?drop_week=eq.${encodeURIComponent(
        dropWeek,
      )}&select=*&limit=1`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return null;
      }
      const rows = (await res.json()) as MintedRow[];
      return (Array.isArray(rows) && rows[0]) || null;
    },
    null,
    "fetchMintedByDropWeek",
  );
}

export async function fetchHighestFanFavoriteEdition(
  signal?: AbortSignal,
): Promise<MintedRow | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return null;

  return withSupabaseFallback(
    "highest-fan-favorite-edition",
    async () => {
      const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/Minted?SetName=eq.Fan%20Favorite&select=*&order=edition_id.desc&limit=1`;
      const res = await fetch(url, { headers: headers(anonKey), signal });
      if (!res.ok) {
        if (res.status >= 500) {
          const error = new Error(`Supabase API error: ${res.status}`) as any;
          error.status = res.status;
          throw error;
        }
        return null;
      }
      const rows = (await res.json()) as MintedRow[];
      return (Array.isArray(rows) && rows[0]) || null;
    },
    null,
    "fetchHighestFanFavoriteEdition",
  );
}
