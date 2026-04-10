export type RelicSerialRow = {
  edition_id: number;
  serial: number;
  token_id?: number | string | null;
  tokenId?: number | string | null;
  [key: string]: any;
};

// Cache for rolling median sale data to prevent repeated failing requests
const rollingMedianSaleCache = new Map<number, { value: string | null; attempts: number }>();

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

export async function fetchRelicSerialsJoinedByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<number[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return [];
  const root = baseUrl.replace(/\/$/, "");

  // Try the RelicSerialsJoined table
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];

  const tryFetch = async (table: string) => {
    const base = `${root}/rest/v1/${table}`;
    const selects = [
      { select: "serial", order: "serial.asc" },
      { select: "Serial", order: "Serial.asc" },
      { select: "serial_number", order: "serial_number.asc" },
    ];
    const editionKeys = ["edition_id", "EditionID", "editionId"] as const;

    for (const key of editionKeys) {
      for (const s of selects) {
        const url = `${base}?${key}=eq.${encodeURIComponent(
          editionId,
        )}&select=${encodeURIComponent(s.select)}&order=${encodeURIComponent(s.order)}`;
        try {
          const res = await fetch(url, {
            headers: headers(anonKey),
            signal,
            mode: "cors",
          });
          if (!res.ok) continue;
          const rows = (await res.json()) as any[];
          const nums = rows
            .map((r) => r?.serial ?? r?.Serial ?? r?.serial_number)
            .map((v: any) => {
              const n = typeof v === "number" ? v : Number(String(v));
              return Number.isFinite(n) ? n : null;
            })
            .filter((n: number | null): n is number => typeof n === "number");
          if (nums.length) return nums as number[];
        } catch (e: any) {
          if (e?.name === "AbortError") return [];
        }
      }
    }
    return [];
  };

  for (const table of tables) {
    const got = await tryFetch(table);
    if (got.length) return Array.from(new Set(got)).sort((a, b) => a - b);
  }
  return [];
}

export async function fetchRelicSerialsByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<RelicSerialRow | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return null;

  const root = baseUrl.replace(/\/$/, "");
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];
  const eidKeys = ["edition_id", "EditionID", "editionId"] as const;

  for (const table of tables) {
    for (const ek of eidKeys) {
      const url = `${root}/rest/v1/${table}?${ek}=eq.${encodeURIComponent(
        editionId,
      )}&select=*&limit=1`;
      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      }).catch(() => null);
      if (!res?.ok) continue;
      const rows = (await res.json().catch(() => null)) as
        | RelicSerialRow[]
        | null;
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  }
  return null;
}

export async function fetchRelicSerialByEditionAndSerial(
  editionId: number,
  serial: number,
  signal?: AbortSignal,
): Promise<RelicSerialRow | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (
    !baseUrl ||
    !anonKey ||
    !Number.isFinite(editionId) ||
    !Number.isFinite(serial)
  )
    return null;

  const root = baseUrl.replace(/\/$/, "");
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];
  const eidKeys = ["edition_id", "EditionID", "editionId"] as const;
  const serialKeys = ["serial", "Serial", "serial_number"] as const;

  for (const table of tables) {
    for (const ek of eidKeys) {
      for (const sk of serialKeys) {
        const url = `${root}/rest/v1/${table}?${ek}=eq.${encodeURIComponent(
          editionId,
        )}&${sk}=eq.${encodeURIComponent(serial)}&select=*`;
        const res = await fetch(url, {
          headers: headers(anonKey),
          signal,
          mode: "cors",
        }).catch(() => null);
        if (!res?.ok) continue;
        const rows = (await res.json().catch(() => null)) as
          | RelicSerialRow[]
          | null;
        if (Array.isArray(rows) && rows[0]) return rows[0];
      }
    }
  }
  return null;
}

export async function fetchRelicSerialByTokenId(
  tokenId: string | number,
  signal?: AbortSignal,
): Promise<RelicSerialRow | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !tokenId) return null;

  const root = baseUrl.replace(/\/$/, "");
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];
  const tokenIdKeys = ["token_id", "TokenID", "tokenId"] as const;

  for (const table of tables) {
    for (const tk of tokenIdKeys) {
      const url = `${root}/rest/v1/${table}?${tk}=eq.${encodeURIComponent(
        tokenId,
      )}&select=*&limit=1`;
      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      }).catch(() => null);
      if (!res?.ok) continue;
      const rows = (await res.json().catch(() => null)) as
        | RelicSerialRow[]
        | null;
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  }
  return null;
}

export async function fetchUsernameByWalletAddress(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !walletAddress) return null;

  const normalizedAddress = walletAddress.toUpperCase();

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(
    normalizedAddress,
  )}&select=username`;

  const res = await fetch(url, {
    headers: headers(anonKey),
    signal,
    mode: "cors",
  }).catch(() => null);

  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as Array<{
    username: string;
  }> | null;
  return Array.isArray(rows) && rows[0]?.username ? rows[0].username : null;
}

export async function fetchRelicOwnerByTokenId(
  tokenId: string | number,
  signal?: AbortSignal,
): Promise<{ current_owner: string | null } | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !tokenId) return null;

  const root = baseUrl.replace(/\/$/, "");
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];
  const tokenIdKeys = ["token_id", "TokenID", "tokenId"] as const;

  for (const table of tables) {
    for (const tk of tokenIdKeys) {
      const url = `${root}/rest/v1/${table}?${tk}=eq.${encodeURIComponent(
        tokenId,
      )}&select=current_owner&limit=1`;
      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      }).catch(() => null);
      if (!res?.ok) continue;
      const rows = (await res.json().catch(() => null)) as Array<{
        current_owner: string | null;
      }> | null;
      if (Array.isArray(rows) && rows[0]) return rows[0];
    }
  }
  return null;
}

export async function fetchFavoriteTeamByWalletAddress(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !walletAddress) return null;

  const normalizedAddress = walletAddress.toUpperCase();

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(
    normalizedAddress,
  )}&select=favorite_team`;

  const res = await fetch(url, {
    headers: headers(anonKey),
    signal,
    mode: "cors",
  }).catch(() => null);

  if (!res?.ok) return null;
  const rows = (await res.json().catch(() => null)) as Array<{
    favorite_team: string | null;
  }> | null;
  return Array.isArray(rows) && rows[0]?.favorite_team
    ? rows[0].favorite_team
    : null;
}

export async function fetchRollingMedianSaleByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return null;

  // Check cache first
  const cached = rollingMedianSaleCache.get(editionId);
  if (cached?.value !== null) {
    return cached.value;
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/RMV?edition_id=eq.${encodeURIComponent(
    editionId,
  )}&select=rolling_median_sale`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      console.warn(`[fetchRollingMedianSaleByEditionId] Failed for edition ${editionId}: HTTP ${res.status}`);
      rollingMedianSaleCache.set(editionId, { value: null, attempts: 1 });
      return null;
    }

    const rows = (await res.json()) as Array<any>;
    if (!Array.isArray(rows) || !rows[0]) {
      console.warn(`[fetchRollingMedianSaleByEditionId] No data for edition ${editionId}`);
      rollingMedianSaleCache.set(editionId, { value: null, attempts: 1 });
      return null;
    }

    const rawValue = rows[0].rolling_median_sale;
    if (rawValue == null || rawValue === "") {
      console.warn(`[fetchRollingMedianSaleByEditionId] No rolling_median_sale for edition ${editionId}`);
      rollingMedianSaleCache.set(editionId, { value: null, attempts: 1 });
      return null;
    }

    // Convert from wei (18 decimals) to dollars
    const valueStr = String(rawValue).trim();
    const bigValue = BigInt(valueStr);
    const wholePart = bigValue / BigInt(1e18);
    const remainder = bigValue % BigInt(1e18);
    const decimalValue = Number(wholePart) + Number(remainder) / 1e18;
    const result = `$${decimalValue.toFixed(2)}`;

    console.log(`[fetchRollingMedianSaleByEditionId] Edition ${editionId}: ${valueStr} wei -> $${decimalValue.toFixed(2)}`);
    rollingMedianSaleCache.set(editionId, { value: result, attempts: 1 });
    return result;
  } catch (err) {
    console.warn(`[fetchRollingMedianSaleByEditionId] Error for edition ${editionId}: ${err}`);
    rollingMedianSaleCache.set(editionId, { value: null, attempts: 1 });
    return null;
  }
}

export async function fetchAllRelicSerialsJoinedByEditions(
  editionIds: number[],
  signal?: AbortSignal,
): Promise<Record<number, RelicSerialRow | null>> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (
    !baseUrl ||
    !anonKey ||
    !Array.isArray(editionIds) ||
    editionIds.length === 0
  ) {
    return {};
  }

  const root = baseUrl.replace(/\/$/, "");
  const result: Record<number, RelicSerialRow | null> = {};

  // Initialize result with null for all edition IDs
  for (const eid of editionIds) {
    result[eid] = null;
  }

  // Fetch each edition in parallel using Promise.allSettled
  const fetchSingleEdition = async (
    editionId: number,
  ): Promise<[number, RelicSerialRow | null]> => {
    const tables = [
      "RelicSerialsJoined",
      "relic_serials_joined",
      "RelicSerials",
    ];
    const eidKeys = ["edition_id", "EditionID", "editionId"] as const;

    for (const table of tables) {
      for (const ek of eidKeys) {
        const url = `${root}/rest/v1/${table}?${ek}=eq.${encodeURIComponent(
          editionId,
        )}&select=*&limit=1`;

        const res = await fetch(url, {
          headers: headers(anonKey),
          signal,
          mode: "cors",
        }).catch(() => null);

        if (!res?.ok) continue;

        const rows = (await res.json().catch(() => null)) as
          | RelicSerialRow[]
          | null;
        if (Array.isArray(rows) && rows[0]) {
          return [editionId, rows[0]];
        }
      }
    }

    return [editionId, null];
  };

  // Use Promise.allSettled to fetch all editions in parallel without failing on individual errors
  const promises = editionIds.map((eid) => fetchSingleEdition(eid));
  const results = await Promise.allSettled(promises);

  // Map results back to result object
  for (const resultItem of results) {
    if (resultItem.status === "fulfilled") {
      const [editionId, row] = resultItem.value;
      result[editionId] = row;
    }
  }

  return result;
}

/**
 * Count the number of token_ids (serials) that are "in pack" for a given edition
 * In packs = records where current_owner is NULL
 */
export async function countInPackTokensByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<number> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return 0;

  const root = baseUrl.replace(/\/$/, "");

  // Try different table combinations
  const tables = ["RelicSerialsJoined", "relic_serials_joined", "RelicSerials"];
  const editionKeys = ["edition_id", "EditionID", "editionId"] as const;

  for (const table of tables) {
    for (const eidKey of editionKeys) {
      try {
        // Query: edition_id=eq.{editionId} AND current_owner=is.null
        const url = `${root}/rest/v1/${table}?${eidKey}=eq.${encodeURIComponent(
          editionId,
        )}&current_owner=is.null&select=serial`;

        const res = await fetch(url, {
          headers: headers(anonKey),
          signal,
          mode: "cors",
        });

        if (!res.ok) continue;

        const rows = (await res.json()) as Array<{ serial?: number }>;
        if (!Array.isArray(rows)) continue;

        const inPackSerials = new Set<number>();
        for (const row of rows) {
          if (row.serial != null) {
            inPackSerials.add(Number(row.serial));
          }
        }

        if (inPackSerials.size > 0) {
          console.log(
            `[countInPackTokensByEditionId] Edition ${editionId}: found ${inPackSerials.size} in-pack tokens`,
            Array.from(inPackSerials),
          );
          return inPackSerials.size;
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return 0;
        continue;
      }
    }
  }

  console.log(
    `[countInPackTokensByEditionId] Edition ${editionId}: found 0 in-pack tokens`,
  );
  return 0;
}
