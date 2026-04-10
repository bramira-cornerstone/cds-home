export type StakingRow = {
  edition_id: number;
  serial: number;
  team: string | null;
  timestamp: string;
  stakingExpiration: string;
  rolling_median_sale: string | null;
  [key: string]: any;
};

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Fetch staking data for a specific relic (edition_id + serial)
 * Returns all staking records for this relic, if any exist.
 *
 * Error handling:
 * - 2xx with zero records: Returns [] silently (valid case)
 * - 4xx responses: Logs warning, returns []
 * - 5xx responses: Logs error, returns []
 * - Network errors: Logs error, returns []
 */
export async function fetchStakingByEditionAndSerial(
  editionId: number,
  serial: number,
  signal?: AbortSignal,
): Promise<StakingRow[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (
    !baseUrl ||
    !anonKey ||
    !Number.isFinite(editionId) ||
    !Number.isFinite(serial)
  )
    return [];

  const root = baseUrl.replace(/\/$/, "");

  // Try the public.staking view
  const url = `${root}/rest/v1/staking?edition_id=eq.${encodeURIComponent(
    editionId,
  )}&serial=eq.${encodeURIComponent(serial)}&select=*`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      // 4xx: log as warning
      if (res.status >= 400 && res.status < 500) {
        console.warn(
          `[fetchStakingByEditionAndSerial] Client error (${res.status})`,
        );
        return [];
      }
      // 5xx: log as warning (expected when records don't exist)
      if (res.status >= 500) {
        console.warn(
          `[fetchStakingByEditionAndSerial] Server error (${res.status})`,
        );
        return [];
      }
      return [];
    }

    const rows = (await res.json()) as StakingRow[];
    return Array.isArray(rows) ? rows : [];
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.debug("[fetchStakingByEditionAndSerial] Request aborted");
      return [];
    }
    // Network error or other errors - silently return empty (expected condition)
    return [];
  }
}

/**
 * Check if a relic has an active stake (stakingExpiration > now)
 */
export function hasActiveStake(stakingRows: StakingRow[]): StakingRow | null {
  if (!Array.isArray(stakingRows) || stakingRows.length === 0) {
    return null;
  }

  const now = new Date();

  for (const row of stakingRows) {
    if (!row.stakingExpiration) continue;
    const expirationDate = new Date(row.stakingExpiration);
    if (expirationDate > now) {
      return row;
    }
  }

  return null;
}

/**
 * Format the expiration date for display (e.g., "Jan 15, 2026")
 */
export function formatExpirationDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Count the number of staked tokens (token_ids) for a given edition
 * Counts records where:
 * - edition_id matches the provided editionId
 * - stakingExpiration > current datetime
 * - longStake = TRUE
 *
 * Error handling:
 * - 2xx with zero records: Returns 0 silently (valid case)
 * - 4xx responses: Logs warning, returns 0
 * - 5xx responses: Logs error, returns 0
 * - Network errors: Logs error, returns 0
 */
export async function countStakedTokensByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<number> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return 0;

  const root = baseUrl.replace(/\/$/, "");

  try {
    // Fetch all staking records for this edition
    const url = `${root}/rest/v1/staking?edition_id=eq.${encodeURIComponent(
      editionId,
    )}&longStake=eq.true&select=serial,stakingExpiration`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      // 4xx: log as warning
      if (res.status >= 400 && res.status < 500) {
        console.warn(
          `[countStakedTokensByEditionId] Client error (${res.status} ${res.statusText})`,
        );
        return 0;
      }
      // 5xx: log as warning (expected when records don't exist)
      if (res.status >= 500) {
        console.warn(
          `[countStakedTokensByEditionId] Server error (${res.status} ${res.statusText})`,
        );
        return 0;
      }
      // Other non-ok: log as warning
      console.warn(
        `[countStakedTokensByEditionId] Failed with status ${res.status}`,
      );
      return 0;
    }

    const rows = (await res.json()) as StakingRow[];
    if (!Array.isArray(rows)) {
      console.error(
        `[countStakedTokensByEditionId] Response is not an array:`,
        rows,
      );
      return 0;
    }

    // Filter for active stakes (stakingExpiration > now)
    const now = new Date();
    const activeStakes = new Set<number>();

    for (const row of rows) {
      if (!row.stakingExpiration || !row.serial) {
        console.debug(
          `[countStakedTokensByEditionId] Skipping row: missing stakingExpiration or serial`,
          row,
        );
        continue;
      }
      const expirationDate = new Date(row.stakingExpiration);
      if (expirationDate > now) {
        activeStakes.add(row.serial);
        console.debug(
          `[countStakedTokensByEditionId] Adding serial ${row.serial}, expiration: ${expirationDate.toISOString()}`,
        );
      } else {
        console.debug(
          `[countStakedTokensByEditionId] Skipping serial ${row.serial}, expired at ${expirationDate.toISOString()}`,
        );
      }
    }

    // Zero records is valid - don't log as error
    console.debug(
      `[countStakedTokensByEditionId] Edition ${editionId}: found ${activeStakes.size} active staked tokens`,
    );
    return activeStakes.size;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.debug(`[countStakedTokensByEditionId] Request aborted`);
      return 0;
    }
    // Network error (TypeError: Failed to fetch) or other errors - silently return 0 (expected condition)
    return 0;
  }
}
