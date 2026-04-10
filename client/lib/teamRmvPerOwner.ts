import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface TeamRMVPerOwnerRecord {
  wallet_address: string;
  team: string | null;
  rmv: number | string | null;
  last_buy: string | null;
  team_rank: number | string | null;
  percentile: number | string | null;
  staked_rank: number | null;
  staked_rmv?: number | string | null;
  staked_percentile?: number | string | null;
}

export interface TeamRMVStats {
  team: string | null;
  total_rmv: number;
  member_count: number;
  average_rmv: number;
}

export async function fetchTeamRMVPerOwner(): Promise<TeamRMVPerOwnerRecord[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    console.warn("[fetchTeamRMVPerOwner] Missing Supabase configuration");
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  const fallbackData: TeamRMVPerOwnerRecord[] = [];

  return withSupabaseFallback(
    "team-rmv-per-owner",
    async () => {
      const url = `${baseUrl}/team_rmv_per_owner?select=*`;

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

        clearTimeout(timeoutId);

        if (!response.ok) {
          const statusMessage = response.statusText || `HTTP ${response.status}`;
          const error = new Error(
            `Failed to fetch team RMV data: ${statusMessage}`,
          ) as any;
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        clearTimeout(timeoutId);
        // Convert AbortError to a proper 504 timeout error
        if (err?.name === "AbortError") {
          const timeoutError = new Error(
            "Request timeout: Team RMV query exceeded 30 seconds",
          ) as any;
          timeoutError.status = 504;
          throw timeoutError;
        }
        throw err;
      }
    },
    fallbackData,
    "fetchTeamRMVPerOwner",
  );
}

/**
 * Fetch team RMV data for a specific wallet address (much more efficient than fetching all)
 * Uses a filter query to get only the user's records
 */
export async function fetchTeamRMVPerOwnerByWallet(
  walletAddress: string,
): Promise<TeamRMVPerOwnerRecord[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey || !walletAddress) {
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  const fallbackData: TeamRMVPerOwnerRecord[] = [];

  const lowerAddress = walletAddress.toLowerCase();
  const cacheKey = `team-rmv-per-owner-wallet-${lowerAddress}`;

  return withSupabaseFallback(
    cacheKey,
    async () => {
      const url = `${baseUrl}/team_rmv_per_owner?wallet_address=eq.${encodeURIComponent(lowerAddress)}&select=*`;

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
            `Failed to fetch team RMV data for wallet: ${statusMessage}`,
          ) as any;
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (err: any) {
        clearTimeout(timeoutId);
        // Convert AbortError to a proper 504 timeout error
        if (err?.name === "AbortError") {
          const timeoutError = new Error(
            "Request timeout: Team RMV query for wallet exceeded 30 seconds",
          ) as any;
          timeoutError.status = 504;
          throw timeoutError;
        }
        throw err;
      }
    },
    fallbackData,
    "fetchTeamRMVPerOwnerByWallet",
  );
}

export function findTeamRMVByWallet(
  records: TeamRMVPerOwnerRecord[],
  walletAddress: string,
): TeamRMVPerOwnerRecord | undefined {
  const lowerAddress = walletAddress.toLowerCase();
  return records.find(
    (record) =>
      record.wallet_address &&
      record.wallet_address.toLowerCase() === lowerAddress,
  );
}

export function findTeamRMVByTeam(
  records: TeamRMVPerOwnerRecord[],
  team: string | null,
): TeamRMVPerOwnerRecord[] {
  return records.filter((record) => record.team === team);
}

export function calculateTeamStats(
  records: TeamRMVPerOwnerRecord[],
  team: string | null,
): TeamRMVStats {
  const teamRecords = findTeamRMVByTeam(records, team);

  if (teamRecords.length === 0) {
    return {
      team,
      total_rmv: 0,
      member_count: 0,
      average_rmv: 0,
    };
  }

  const total_rmv = teamRecords.reduce((sum, record) => {
    const rmv = Number(record.rmv) || 0;
    return sum + rmv;
  }, 0);

  return {
    team,
    total_rmv: Math.round(total_rmv * 100) / 100,
    member_count: teamRecords.length,
    average_rmv: Math.round((total_rmv / teamRecords.length) * 100) / 100,
  };
}

export function getTopTeamsByRMV(
  records: TeamRMVPerOwnerRecord[],
  limit: number = 10,
): TeamRMVStats[] {
  const uniqueTeams = new Set(records.map((r) => r.team));
  const teams = Array.from(uniqueTeams);

  return teams
    .map((team) => calculateTeamStats(records, team))
    .sort((a, b) => b.total_rmv - a.total_rmv)
    .slice(0, limit);
}

export function getWalletTeamRank(
  records: TeamRMVPerOwnerRecord[],
  walletAddress: string,
): TeamRMVPerOwnerRecord | null {
  return findTeamRMVByWallet(records, walletAddress) || null;
}
