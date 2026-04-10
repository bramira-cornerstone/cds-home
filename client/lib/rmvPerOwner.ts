import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface RMVPerOwnerRecord {
  current_owner: string;
  league_rank: number | string | null;
  Percentile: number | string | null;
  total_rolling_median_sale?: number | string | null;
  rank_level?: string;
  [key: string]: any;
}

export function calculateUserDropTier(
  percentile: number | string | null | undefined,
): string {
  if (percentile === null || percentile === undefined) {
    return "—";
  }

  const pct = Number(percentile);

  if (pct >= 0.75) {
    return "Epic Tier";
  } else if (pct >= 0.5) {
    return "Rare Tier";
  } else {
    return "Basic Tier";
  }
}

export function calculateRankLevel(
  percentile: number | string | null | undefined,
): string {
  if (percentile === null || percentile === undefined) {
    return "Spectator";
  }

  const pct = Number(percentile);

  if (pct >= 0.9) {
    return "Diamond";
  } else if (pct >= 0.75) {
    return "Epic";
  } else if (pct >= 0.5) {
    return "Rare";
  } else if (pct >= 0.25) {
    return "Basic";
  } else {
    return "Beginner";
  }
}

export async function fetchRMVPerOwner(): Promise<RMVPerOwnerRecord[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    console.warn(
      "[fetchRMVPerOwner] Missing Supabase configuration (URL or ANON_KEY)",
    );
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  const fallbackData: RMVPerOwnerRecord[] = [];

  return withSupabaseFallback(
    "rmv-per-owner",
    async () => {
      const url = `${baseUrl}/rmv_per_owner?select=*`;
      console.debug("[fetchRMVPerOwner] Fetching from:", url);

      // Set 30-second timeout to allow slow queries to complete
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      try {
        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          const statusMessage = response.statusText || `HTTP ${response.status}`;
          const error = new Error(
            `Failed to fetch RMV per owner data: ${statusMessage}`,
          ) as any;
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        clearTimeout(timeoutId);
        // Convert AbortError to a proper 500 timeout error
        if (err?.name === "AbortError") {
          const timeoutError = new Error(
            "Request timeout: RMV per owner query exceeded 10 seconds",
          ) as any;
          timeoutError.status = 504;
          throw timeoutError;
        }
        throw err;
      }
    },
    fallbackData,
    "fetchRMVPerOwner",
  );
}

export function findRMVByOwner(
  records: RMVPerOwnerRecord[],
  ownerAddress: string,
): RMVPerOwnerRecord | undefined {
  const lowerAddress = ownerAddress.toLowerCase();
  return records.find(
    (record) =>
      record.current_owner &&
      record.current_owner.toLowerCase() === lowerAddress,
  );
}
