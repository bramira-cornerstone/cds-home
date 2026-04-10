export interface StakingEvent {
  id: string;
  database_id: string; // The actual row id from public.staking table
  type: "staking";
  token_id: number;
  staker: string;
  timestamp: string;
  longStake: boolean;
  stakingExpiration: string;
  edition_id: number;
  serial: number;
  team: string | null;
  PlayerName: string | null;
  TierValue: number | null;
  SetName: string | null;
  SeriesName: string | null;
  rolling_median_sale: string | null;
  Minted: number | null;
  username: string | null;
}

export interface RedemptionEvent {
  id: string;
  database_id: string; // The actual row id from public.redemptionEventsWithRmv table
  type: "redemption";
  edition_id_reward: number;
  wallet_address: string;
  token_id: string;
  timestamp: string;
  created_at: string;
  edition_id_redeemed: number | null;
  serial_redeemed: number | null;
  rmv_redeemed: number | null;
  minted: number | null;
  player_name: string | null;
  team: string | null;
  username: string | null;
}

export type CollectionEvent = StakingEvent | RedemptionEvent;

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Fetch all staking events for a specific wallet
 */
export async function fetchStakingEventsForWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<StakingEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !walletAddress) return [];

  const root = baseUrl.replace(/\/$/, "");
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const url = `${root}/rest/v1/staking?staker=ilike.${encodeURIComponent(
      normalizedAddress,
    )}&select=*&order=timestamp.desc`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) return [];

    const rows = (await res.json()) as any[];
    return Array.isArray(rows)
      ? rows.map((row, idx) => ({
          id: `staking-${row.id || idx}`,
          database_id: String(row.id || idx),
          type: "staking" as const,
          token_id: row.token_id,
          staker: row.staker,
          timestamp: row.timestamp,
          longStake: row.longStake,
          stakingExpiration: row.stakingExpiration,
          edition_id: row.edition_id,
          serial: row.serial,
          team: row.team,
          PlayerName: row.PlayerName,
          TierValue: row.TierValue,
          SetName: row.SetName,
          SeriesName: row.SeriesName,
          rolling_median_sale: row.rolling_median_sale,
          Minted: row.Minted,
          username: row.username,
        }))
      : [];
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
    return [];
  }
}

/**
 * Fetch all redemption events for a specific wallet
 */
export async function fetchRedemptionEventsForWallet(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<RedemptionEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !walletAddress) return [];

  const root = baseUrl.replace(/\/$/, "");
  const normalizedAddress = walletAddress.toLowerCase();

  try {
    const url = `${root}/rest/v1/redemptionEventsWithRmv?wallet_address=ilike.${encodeURIComponent(
      normalizedAddress,
    )}&select=*&order=timestamp.desc`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) return [];

    const rows = (await res.json()) as any[];
    return Array.isArray(rows)
      ? rows.map((row) => ({
          id: row.id,
          database_id: String(row.id),
          type: "redemption" as const,
          edition_id_reward: row.edition_id_reward,
          wallet_address: row.wallet_address,
          token_id: row.token_id,
          timestamp: row.timestamp,
          created_at: row.created_at,
          edition_id_redeemed: row.edition_id_redeemed,
          serial_redeemed: row.serial_redeemed,
          rmv_redeemed: row.rmv_redeemed,
          minted: row.minted,
          player_name: row.player_name,
          team: row.team,
          username: row.username,
        }))
      : [];
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
    return [];
  }
}

/**
 * Fetch followee addresses for a user (for friend events)
 */
export async function fetchFolloweeStakingAndRedemptionEvents(
  followeeAddresses: string[],
  signal?: AbortSignal,
): Promise<CollectionEvent[]> {
  if (followeeAddresses.length === 0) return [];

  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const root = baseUrl.replace(/\/$/, "");
  const events: CollectionEvent[] = [];

  try {
    // Fetch staking events for all followees
    for (const address of followeeAddresses) {
      try {
        const url = `${root}/rest/v1/staking?staker=ilike.${encodeURIComponent(
          address,
        )}&select=*&order=timestamp.desc`;

        const res = await fetch(url, {
          headers: headers(anonKey),
          signal,
          mode: "cors",
        });

        if (res.ok) {
          const rows = (await res.json()) as any[];
          if (Array.isArray(rows)) {
            rows.forEach((row, idx) => {
              events.push({
                id: `staking-${row.id || idx}`,
                database_id: String(row.id || idx),
                type: "staking",
                token_id: row.token_id,
                staker: row.staker,
                timestamp: row.timestamp,
                longStake: row.longStake,
                stakingExpiration: row.stakingExpiration,
                edition_id: row.edition_id,
                serial: row.serial,
                team: row.team,
                PlayerName: row.PlayerName,
                TierValue: row.TierValue,
                SetName: row.SetName,
                SeriesName: row.SeriesName,
                rolling_median_sale: row.rolling_median_sale,
                Minted: row.Minted,
                username: row.username,
              });
            });
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
        }
      }
    }

    // Fetch redemption events for all followees
    for (const address of followeeAddresses) {
      try {
        const url = `${root}/rest/v1/redemptionEventsWithRmv?wallet_address=ilike.${encodeURIComponent(
          address,
        )}&select=*&order=timestamp.desc`;

        const res = await fetch(url, {
          headers: headers(anonKey),
          signal,
          mode: "cors",
        });

        if (res.ok) {
          const rows = (await res.json()) as any[];
          if (Array.isArray(rows)) {
            rows.forEach((row) => {
              events.push({
                id: row.id,
                database_id: String(row.id),
                type: "redemption",
                edition_id_reward: row.edition_id_reward,
                wallet_address: row.wallet_address,
                token_id: row.token_id,
                timestamp: row.timestamp,
                created_at: row.created_at,
                edition_id_redeemed: row.edition_id_redeemed,
                serial_redeemed: row.serial_redeemed,
                rmv_redeemed: row.rmv_redeemed,
                minted: row.minted,
                player_name: row.player_name,
                team: row.team,
                username: row.username,
              });
            });
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error(
            `Error fetching redemption events for ${address}:`,
            err,
          );
        }
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
  }

  return events;
}

/**
 * Fetch all staking events globally (for global event timeline)
 */
export async function fetchAllStakingEvents(
  signal?: AbortSignal,
): Promise<StakingEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const root = baseUrl.replace(/\/$/, "");

  try {
    const url = `${root}/rest/v1/staking?select=*&order=timestamp.desc&limit=1000`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) return [];

    const rows = (await res.json()) as any[];
    return Array.isArray(rows)
      ? rows.map((row, idx) => ({
          id: `staking-${row.id || idx}`,
          database_id: String(row.id || idx),
          type: "staking" as const,
          token_id: row.token_id,
          staker: row.staker,
          timestamp: row.timestamp,
          longStake: row.longStake,
          stakingExpiration: row.stakingExpiration,
          edition_id: row.edition_id,
          serial: row.serial,
          team: row.team,
          PlayerName: row.PlayerName,
          TierValue: row.TierValue,
          SetName: row.SetName,
          SeriesName: row.SeriesName,
          rolling_median_sale: row.rolling_median_sale,
          Minted: row.Minted,
          username: row.username,
        }))
      : [];
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
    return [];
  }
}

/**
 * Fetch all redemption events globally (for global event timeline)
 */
export async function fetchAllRedemptionEvents(
  signal?: AbortSignal,
): Promise<RedemptionEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const root = baseUrl.replace(/\/$/, "");

  try {
    const url = `${root}/rest/v1/redemptionEventsWithRmv?select=*&order=timestamp.desc&limit=1000`;

    const res = await fetch(url, {
      headers: headers(anonKey),
      signal,
      mode: "cors",
    });

    if (!res.ok) return [];

    const rows = (await res.json()) as any[];
    return Array.isArray(rows)
      ? rows.map((row) => ({
          id: row.id,
          database_id: String(row.id),
          type: "redemption" as const,
          edition_id_reward: row.edition_id_reward,
          wallet_address: row.wallet_address,
          token_id: row.token_id,
          timestamp: row.timestamp,
          created_at: row.created_at,
          edition_id_redeemed: row.edition_id_redeemed,
          serial_redeemed: row.serial_redeemed,
          rmv_redeemed: row.rmv_redeemed,
          minted: row.minted,
          player_name: row.player_name,
          team: row.team,
          username: row.username,
        }))
      : [];
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
    return [];
  }
}

/**
 * Fetch all staking and redemption events for a specific edition_id
 */
export async function fetchStakingAndRedemptionEventsByEditionId(
  editionId: number,
  signal?: AbortSignal,
): Promise<CollectionEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !editionId) return [];

  const root = baseUrl.replace(/\/$/, "");
  const events: CollectionEvent[] = [];

  try {
    // Fetch staking events for this edition
    try {
      const url = `${root}/rest/v1/staking?edition_id=eq.${editionId}&select=*&order=timestamp.desc`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (res.ok) {
        const rows = (await res.json()) as any[];
        if (Array.isArray(rows)) {
          rows.forEach((row, idx) => {
            events.push({
              id: `staking-${row.id || idx}`,
              database_id: String(row.id || idx),
              type: "staking",
              token_id: row.token_id,
              staker: row.staker,
              timestamp: row.timestamp,
              longStake: row.longStake,
              stakingExpiration: row.stakingExpiration,
              edition_id: row.edition_id,
              serial: row.serial,
              team: row.team,
              PlayerName: row.PlayerName,
              TierValue: row.TierValue,
              SetName: row.SetName,
              SeriesName: row.SeriesName,
              rolling_median_sale: row.rolling_median_sale,
              Minted: row.Minted,
              username: row.username,
            });
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(
          `Error fetching staking events for edition ${editionId}:`,
          err,
        );
      }
    }

    // Fetch redemption events for this edition
    try {
      const url = `${root}/rest/v1/redemptionEventsWithRmv?edition_id_reward=eq.${editionId}&select=*&order=timestamp.desc`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (res.ok) {
        const rows = (await res.json()) as any[];
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            events.push({
              id: row.id,
              database_id: String(row.id),
              type: "redemption",
              edition_id_reward: row.edition_id_reward,
              wallet_address: row.wallet_address,
              token_id: row.token_id,
              timestamp: row.timestamp,
              created_at: row.created_at,
              edition_id_redeemed: row.edition_id_redeemed,
              serial_redeemed: row.serial_redeemed,
              rmv_redeemed: row.rmv_redeemed,
              minted: row.minted,
              player_name: row.player_name,
              team: row.team,
              username: row.username,
            });
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(
          `Error fetching redemption events for edition ${editionId}:`,
          err,
        );
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      console.error(
        "Error fetching staking/redemption events for edition:",
        err,
      );
    }
  }

  return events;
}

/**
 * Fetch staking and redemption events for a specific team
 */
export async function fetchStakingAndRedemptionEventsByTeam(
  teamName: string,
  signal?: AbortSignal,
): Promise<CollectionEvent[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey || !teamName) return [];

  const root = baseUrl.replace(/\/$/, "");
  const events: CollectionEvent[] = [];

  try {
    // Fetch staking events for this team
    try {
      const url = `${root}/rest/v1/staking?team=eq.${encodeURIComponent(
        teamName,
      )}&select=*&order=timestamp.desc`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (res.ok) {
        const rows = (await res.json()) as any[];
        if (Array.isArray(rows)) {
          rows.forEach((row, idx) => {
            events.push({
              id: `staking-${row.id || idx}`,
              database_id: String(row.id || idx),
              type: "staking",
              token_id: row.token_id,
              staker: row.staker,
              timestamp: row.timestamp,
              longStake: row.longStake,
              stakingExpiration: row.stakingExpiration,
              edition_id: row.edition_id,
              serial: row.serial,
              team: row.team,
              PlayerName: row.PlayerName,
              TierValue: row.TierValue,
              SetName: row.SetName,
              SeriesName: row.SeriesName,
              rolling_median_sale: row.rolling_median_sale,
              Minted: row.Minted,
              username: row.username,
            });
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(
          `Error fetching staking events for team ${teamName}:`,
          err,
        );
      }
    }

    // Fetch redemption events for this team
    try {
      const url = `${root}/rest/v1/redemptionEventsWithRmv?team=eq.${encodeURIComponent(
        teamName,
      )}&select=*&order=timestamp.desc`;

      const res = await fetch(url, {
        headers: headers(anonKey),
        signal,
        mode: "cors",
      });

      if (res.ok) {
        const rows = (await res.json()) as any[];
        if (Array.isArray(rows)) {
          rows.forEach((row) => {
            events.push({
              id: row.id,
              database_id: String(row.id),
              type: "redemption",
              edition_id_reward: row.edition_id_reward,
              wallet_address: row.wallet_address,
              token_id: row.token_id,
              timestamp: row.timestamp,
              created_at: row.created_at,
              edition_id_redeemed: row.edition_id_redeemed,
              serial_redeemed: row.serial_redeemed,
              rmv_redeemed: row.rmv_redeemed,
              minted: row.minted,
              player_name: row.player_name,
              team: row.team,
              username: row.username,
            });
          });
        }
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        console.error(
          `Error fetching redemption events for team ${teamName}:`,
          err,
        );
      }
    }
  } catch (err: any) {
    if (err?.name !== "AbortError") {
    }
  }

  return events;
}
