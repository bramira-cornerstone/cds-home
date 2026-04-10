function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  } as Record<string, string>;
}

export interface DropWeekWindow {
  drop_week: string;
  redemptions_close: string; // ISO 8601 datetime string
}

/**
 * Fetch the drop_week for a given edition_id from the Minted table
 */
export async function getDropWeekForEdition(
  editionId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) {
    return null;
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/Minted?edition_id=eq.${editionId}&select=drop_week&limit=1`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(
          `Failed to fetch drop_week for edition ${editionId}: ${res.status}`,
        );
      }
      return null;
    }

    const data = (await res.json()) as { drop_week: string }[];
    return Array.isArray(data) && data[0]?.drop_week ? data[0].drop_week : null;
  } catch (err) {
    // Only log non-abort errors
    if (err instanceof Error && err.name !== "AbortError") {
    }
    return null;
  }
}

/**
 * Fetch the redemptions_close value for a given drop_week
 * Returns an object to distinguish between null in DB vs error/not found
 */
export async function getRedemptionDeadlineRaw(
  dropWeek: string,
  signal?: AbortSignal,
): Promise<{ value: string | null; found: boolean }> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !dropWeek) {
    return { value: null, found: false };
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/drop_week_windows?drop_week=eq.${encodeURIComponent(
    dropWeek,
  )}&select=redemptions_close&limit=1`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(
          `Failed to fetch redemption deadline for drop_week ${dropWeek}: ${res.status}`,
        );
      }
      return { value: null, found: false };
    }

    const data = (await res.json()) as { redemptions_close: string | null }[];
    if (Array.isArray(data) && data.length > 0) {
      // Found the entry - return the value (which may be null or a string)
      return { value: data[0]?.redemptions_close ?? null, found: true };
    }
    return { value: null, found: false };
  } catch (err) {
    // Only log non-abort errors
    if (err instanceof Error && err.name !== "AbortError") {
    }
    return { value: null, found: false };
  }
}

/**
 * Fetch the redemptions_close datetime for a given drop_week (legacy)
 */
export async function getRedemptionDeadline(
  dropWeek: string,
  signal?: AbortSignal,
): Promise<Date | null> {
  const result = await getRedemptionDeadlineRaw(dropWeek, signal);
  if (!result.found || !result.value) {
    return null;
  }
  return new Date(result.value);
}

/**
 * Get the redemption deadline for an edition_id by chaining the lookups
 */
export async function getRedemptionDeadlineForEdition(
  editionId: number,
  signal?: AbortSignal,
): Promise<Date | null> {
  const dropWeek = await getDropWeekForEdition(editionId, signal);
  if (!dropWeek) return null;

  return getRedemptionDeadline(dropWeek, signal);
}

/**
 * Fetch the airdrops_close value for a given drop_week
 * Returns an object to distinguish between null in DB vs error/not found
 */
export async function getAirdropCloseRaw(
  dropWeek: string,
  signal?: AbortSignal,
): Promise<{ value: string | null; found: boolean }> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !dropWeek) {
    return { value: null, found: false };
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/drop_week_windows?drop_week=eq.${encodeURIComponent(
    dropWeek,
  )}&select=airdrops_close&limit=1`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(
          `Failed to fetch airdrop close for drop_week ${dropWeek}: ${res.status}`,
        );
      }
      return { value: null, found: false };
    }

    const data = (await res.json()) as { airdrops_close: string | null }[];
    if (Array.isArray(data) && data.length > 0) {
      // Found the entry - return the value (which may be null or a string)
      return { value: data[0]?.airdrops_close ?? null, found: true };
    }
    return { value: null, found: false };
  } catch (err) {
    // Only log non-abort errors
    if (err instanceof Error && err.name !== "AbortError") {
    }
    return { value: null, found: false };
  }
}
