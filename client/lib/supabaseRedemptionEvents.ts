export interface StakingEventRecord {
  edition_id_reward: number;
  wallet_address: string;
  token_id: string;
  timestamp: string; // ISO 8601 format
}

export interface StakingEventResponse {
  id: string;
  edition_id_reward: number;
  wallet_address: string;
  token_id: string;
  timestamp: string;
  created_at: string;
}

function headers(
  anonKey: string,
  jwtToken?: string,
  includePrefer: boolean = false,
) {
  const headersObj: Record<string, string> = {
    apikey: anonKey,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (includePrefer) {
    headersObj.Prefer = "return=representation";
  }
  if (jwtToken) {
    headersObj.Authorization = `Bearer ${jwtToken}`;
  }
  return headersObj;
}

export async function insertStakingEvent(
  editionIdReward: number,
  walletAddress: string,
  tokenId: string,
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<StakingEventResponse | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    return null;
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/redemptionEvents`;

  const payload: StakingEventRecord = {
    edition_id_reward: editionIdReward,
    wallet_address: walletAddress.toLowerCase(),
    token_id: tokenId.toString(),
    timestamp: new Date().toISOString(),
  };

  try {
    console.log("Attempting to insert staking event to:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: headers(anonKey, jwtToken, true),
      body: JSON.stringify(payload),
      signal,
      mode: "cors",
    });

    console.log(`Staking event POST response status: ${res.status}`);

    // Check response status (only log 5xx errors)
    if (!res.ok && res.status !== 201) {
      if (res.status >= 500) {
        try {
          const errorText = await res.text();
          console.warn(
            `Failed to insert staking event: ${res.status}`,
            errorText,
          );
        } catch {
          console.warn(`Failed to insert staking event: ${res.status}`);
        }
      }
      return null;
    }

    // Success response (200 or 201)
    // Try to get response body
    let responseText = "";
    try {
      responseText = await res.text();
    } catch (readErr) {
      console.warn("Could not read response body:", readErr);
    }

    console.log("Raw response text:", responseText || "(empty)");

    // If empty response body but status is 201, treat as success
    if (!responseText && (res.status === 201 || res.status === 200)) {
      console.log(
        "Empty response body with success status - treating as successful insert",
      );
      const successResponse: StakingEventResponse = {
        id: "success",
        edition_id_reward: editionIdReward,
        wallet_address: walletAddress.toLowerCase(),
        token_id: tokenId.toString(),
        timestamp: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      console.log("Returning success response:", successResponse);
      return successResponse;
    }

    // Try to parse JSON response
    let data;
    if (responseText) {
      try {
        data = JSON.parse(responseText);
        console.log("Parsed response data:", data);
      } catch (parseErr) {
        console.error("Failed to parse JSON response:", parseErr);
        return null;
      }

      // Handle both array and single object responses
      let result: StakingEventResponse | null = null;

      if (Array.isArray(data)) {
        result = data.length > 0 ? (data[0] as StakingEventResponse) : null;
      } else if (data && typeof data === "object" && data.id) {
        result = data as StakingEventResponse;
      }

      if (result && result.id) {
        console.log("Staking event inserted successfully with ID:", result.id);
        return result;
      }
    }

    console.warn("Could not extract staking event from response");
    return null;
  } catch (err) {
    console.error("Error inserting staking event:", err);
    if (err instanceof Error) {
      console.error("Error details:", err.message);
    }
    return null;
  }
}

export async function getStakingEventsByWallet(
  walletAddress: string,
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<StakingEventResponse[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");
  const normalizedAddress = walletAddress.toLowerCase();
  const url = `${root}/rest/v1/redemptionEvents?wallet_address=ilike.${encodeURIComponent(
    normalizedAddress,
  )}&select=*&order=created_at.desc`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey, jwtToken),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(`Failed to fetch staking events: ${res.status}`);
      }
      return [];
    }

    const data = (await res.json()) as StakingEventResponse[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

export async function getActiveRedemptions(
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<StakingEventResponse[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");
  const fourteenDaysFromNow = new Date(
    Date.now() + 14 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const url = `${root}/rest/v1/redemptionEvents?timestamp=lte.${encodeURIComponent(
    fourteenDaysFromNow,
  )}&select=*&order=timestamp.desc`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey, jwtToken),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(`Failed to fetch active redemptions: ${res.status}`);
      }
      return [];
    }

    const data = (await res.json()) as StakingEventResponse[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

export interface RedemptionEventWithRmv {
  id: string;
  edition_id_reward: number;
  wallet_address: string;
  token_id: string;
  timestamp: string;
  created_at: string;
  edition_id_redeemed: number | null;
  serial_redeemed: number | null;
  rmv_redeemed: number | null;
  username: string | null;
}

export interface AggregatedRedemptionLeaderboard {
  edition_id_reward: number;
  username: string;
  total_rmv_redeemed: number;
  last_redeemed_at: string;
}

export async function getRedemptionLeaderboard(
  editionId: number,
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<AggregatedRedemptionLeaderboard[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/redemptionEventsWithRmv?edition_id_reward=eq.${editionId}&select=username,rmv_redeemed,timestamp`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey, jwtToken),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(`Failed to fetch redemption events: ${res.status}`);
      }
      return [];
    }

    const rows = (await res.json()) as Array<{
      username: string | null;
      rmv_redeemed: number | null;
      timestamp: string | null;
    }>;

    if (!Array.isArray(rows)) {
      return [];
    }

    // Aggregate by username
    const aggregated = new Map<
      string,
      {
        username: string;
        total_rmv_redeemed: number;
        last_redeemed_at: string;
      }
    >();

    for (const row of rows) {
      const username = row.username || "Unknown";
      const rmvRedeemed = Number(row.rmv_redeemed || 0);
      const timestamp = row.timestamp || "";

      if (!aggregated.has(username)) {
        aggregated.set(username, {
          username,
          total_rmv_redeemed: 0,
          last_redeemed_at: timestamp,
        });
      }

      const entry = aggregated.get(username)!;
      entry.total_rmv_redeemed += rmvRedeemed;
      if (
        timestamp &&
        (!entry.last_redeemed_at || timestamp > entry.last_redeemed_at)
      ) {
        entry.last_redeemed_at = timestamp;
      }
    }

    // Convert to array and sort by total_rmv_redeemed descending, then last_redeemed_at ascending
    const result = Array.from(aggregated.values()).sort((a, b) => {
      if (b.total_rmv_redeemed !== a.total_rmv_redeemed) {
        return b.total_rmv_redeemed - a.total_rmv_redeemed;
      }
      return a.last_redeemed_at.localeCompare(b.last_redeemed_at);
    });

    return result;
  } catch (err) {
    return [];
  }
}

export async function getRedemptionEventsRaw(
  editionId: number,
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<RedemptionEventWithRmv[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("Missing Supabase configuration");
    return [];
  }

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/redemptionEventsWithRmv?edition_id_reward=eq.${editionId}&select=*&order=rmv_redeemed.desc,timestamp.asc`;

  try {
    const res = await fetch(url, {
      headers: headers(anonKey, jwtToken),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      if (res.status >= 500) {
        console.warn(`Failed to fetch redemption events: ${res.status}`);
      }
      return [];
    }

    const data = (await res.json()) as RedemptionEventWithRmv[];
    return Array.isArray(data) ? data : [];
  } catch (err) {
    return [];
  }
}

/**
 * Count the number of unique serials that have been redeemed for a given edition
 *
 * Error handling:
 * - 2xx with zero records: Returns 0 silently (valid case)
 * - 4xx responses: Logs warning, returns 0
 * - 5xx responses: Logs error, returns 0
 * - Network errors (TypeError): Silently returns 0 (no error logging)
 */
export async function countRedeemedTokensByEditionId(
  editionId: number,
  jwtToken?: string,
  signal?: AbortSignal,
): Promise<number> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !Number.isFinite(editionId)) return 0;

  const root = baseUrl.replace(/\/$/, "");

  try {
    // Query: edition_id_redeemed=eq.{editionId} and select serial_redeemed
    const url = `${root}/rest/v1/redemptionEventsWithRmv?edition_id_redeemed=eq.${encodeURIComponent(
      editionId,
    )}&select=serial_redeemed`;

    const res = await fetch(url, {
      headers: headers(anonKey, jwtToken),
      signal,
      mode: "cors",
    });

    if (!res.ok) {
      // 4xx: log as warning
      if (res.status >= 400 && res.status < 500) {
        console.warn(
          `[countRedeemedTokensByEditionId] Client error (${res.status}) for edition ${editionId}`,
        );
        return 0;
      }
      // 5xx: log as warning (expected when records don't exist)
      if (res.status >= 500) {
        console.warn(
          `[countRedeemedTokensByEditionId] Server error (${res.status}) for edition ${editionId}`,
        );
        return 0;
      }
      // Other: silently return 0
      return 0;
    }

    const rows = (await res.json()) as Array<{
      serial_redeemed?: number | null;
    }>;
    if (!Array.isArray(rows)) {
      return 0;
    }

    const redeemedSerials = new Set<number>();
    for (const row of rows) {
      if (row.serial_redeemed != null) {
        redeemedSerials.add(Number(row.serial_redeemed));
      }
    }

    // Zero records is valid - don't log as error
    console.debug(
      `[countRedeemedTokensByEditionId] Edition ${editionId}: found ${redeemedSerials.size} redeemed tokens`,
    );
    return redeemedSerials.size;
  } catch (e: any) {
    if (e?.name === "AbortError") {
      console.debug("[countRedeemedTokensByEditionId] Request aborted");
      return 0;
    }
    // Network errors (TypeError: Failed to fetch) - silently return 0
    // Don't log network-level errors, they're transient and not actionable
    return 0;
  }
}
