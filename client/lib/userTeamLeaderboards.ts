import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface UserTeamLeaderboardRecord {
  team: string;
  wallet_address: string;
  rmv: number;
  staked_rmv: number;
  team_rank: number;
  staked_rank: number | null;
  staked_percentile: number | null;
}

export async function fetchUserTeamLeaderboards(
  walletAddress: string,
): Promise<UserTeamLeaderboardRecord[]> {
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
  const fallbackData: UserTeamLeaderboardRecord[] = [];

  return withSupabaseFallback(
    `user-team-leaderboards-${walletAddress.toLowerCase()}`,
    async () => {
      const lowerWalletAddress = walletAddress.toLowerCase();
      // Minimal query: fetch only what we need from the backend, no frontend computation
      const teamRmvUrl = `${baseUrl}/team_rmv_per_owner?wallet_address=eq.${encodeURIComponent(lowerWalletAddress)}&select=team,wallet_address,rmv,staked_rmv,team_rank,staked_rank,staked_percentile&order=team_rank.asc&limit=1000`;

      // Set 15-second timeout to fail fast
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      try {
        const response = await fetch(teamRmvUrl, {
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
          if (response.status >= 500) {
            const statusMessage = response.statusText || `HTTP ${response.status}`;
            console.warn(
              `Failed to fetch user team leaderboards: ${statusMessage}`,
            );
          }
          return [];
        }

        const teamData: Array<{
          team: string;
          wallet_address: string;
          rmv: number | string;
          staked_rmv: number | string;
          team_rank: number | string;
          staked_rank: number | string | null;
          staked_percentile: number | string | null;
        }> = await response.json();

        if (!Array.isArray(teamData) || teamData.length === 0) {
          return [];
        }

        // Direct conversion - no frontend computation
        return teamData.map((team): UserTeamLeaderboardRecord => ({
          team: team.team,
          wallet_address: team.wallet_address,
          rmv: Number(team.rmv) || 0,
          staked_rmv: Number(team.staked_rmv) || 0,
          team_rank: Number(team.team_rank) || 0,
          staked_rank: team.staked_rank ? Number(team.staked_rank) : null,
          staked_percentile: team.staked_percentile ? Number(team.staked_percentile) : null,
        }));
      } catch (err: any) {
        clearTimeout(timeoutId);
        // Handle abort error (timeout) - let withSupabaseFallback catch it as a server error
        if (err?.name === "AbortError") {
          console.warn(
            "[fetchUserTeamLeaderboards] Request timeout exceeded 15 seconds",
          );
          // Return empty array instead of throwing, let fallback handle it
          return [];
        }
        // Network errors will be caught by withSupabaseFallback
        throw err;
      }
    },
    fallbackData,
    "fetchUserTeamLeaderboards",
  );
}
