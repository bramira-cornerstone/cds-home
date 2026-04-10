export async function fetchVoteLocations(
  signal?: AbortSignal,
): Promise<string[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey) return [];

  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/rpc/get_vote_locations`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: "{}",
      signal,
      // ensure CORS mode
      mode: "cors",
    });
  } catch (err) {
    // Network error or blocked request
    // Fail gracefully and return empty list
    // eslint-disable-next-line no-console
    console.warn("fetchVoteLocations failed:", err);
    return [];
  }

  if (!res.ok) {
    return [];
  }

  let data: { vote_rank?: number; video_location?: string }[];
  try {
    data = (await res.json()) as { vote_rank?: number; video_location?: string }[];
  } catch (err) {
    // invalid JSON
    // eslint-disable-next-line no-console
    console.warn("fetchVoteLocations: failed to parse JSON:", err);
    return [];
  }
  const byRank: string[] = [];
  for (const row of data) {
    if (
      typeof row.vote_rank === "number" &&
      row.vote_rank > 0 &&
      row.video_location
    ) {
      byRank[row.vote_rank - 1] = row.video_location;
    }
  }
  return byRank;
}

export async function fetchVoteByRank(
  rank: number,
  signal?: AbortSignal,
): Promise<any | null> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;
  if (!baseUrl || !anonKey || !Number.isFinite(rank)) return null;
  const root = baseUrl.replace(/\/$/, "");

  // 1) Try private schema For_Votes (full row)
  try {
    const url1 = `${root}/rest/v1/For_Votes?vote_rank=eq.${encodeURIComponent(String(rank))}&select=*&limit=1`;
    const res1 = await fetch(url1, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Accept-Profile": "cornerstone_private_schemas",
      },
      signal,
      mode: "cors",
    });
    if (res1.ok) {
      const rows = (await res1.json()) as any[];
      if (Array.isArray(rows) && rows.length) return rows[0];
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("fetchVoteByRank For_Votes fallback failed:", err);
  }

  // 2) Try public ActiveVotes (full row)
  try {
    const url2 = `${root}/rest/v1/ActiveVotes?vote_rank=eq.${encodeURIComponent(String(rank))}&select=*&limit=1`;
    const res2 = await fetch(url2, {
      method: "GET",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
      signal,
      mode: "cors",
    });
    if (res2.ok) {
      const rows = (await res2.json()) as any[];
      if (Array.isArray(rows) && rows.length) return rows[0];
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("fetchVoteByRank ActiveVotes fallback failed:", err);
  }

  // 3) Fallback to RPC (may return subset)
  try {
    const url3 = `${root}/rest/v1/rpc/get_vote_by_rank`;
    const res3 = await fetch(url3, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Accept-Profile": "cornerstone_private_schemas",
      },
      body: JSON.stringify({ _rank: rank }),
      signal,
      mode: "cors",
    });
    if (!res3.ok) return null;
    const rows = (await res3.json()) as any[];
    return Array.isArray(rows) && rows.length ? rows[0] : null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("fetchVoteByRank rpc fallback failed:", err);
    return null;
  }
}
