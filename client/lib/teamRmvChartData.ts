import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";
import { calculateRankLevel } from "@/lib/rmvPerOwner";

export interface TeamRMVChartRecord {
  wallet_address: string;
  username: string;
  rmv: number;
  staked_rmv: number;
  team_rank: number;
  rank_level: string;
  badge_image: string;
}

export function getRankLevelBadgeImage(rank_level: string): string {
  const mapping: Record<string, string> = {
    Diamond: "diamondbadge.png",
    Epic: "epicbadge.png",
    Rare: "rarebadge.png",
    Basic: "basicbadge.png",
    Beginner: "basicbadge.png",
    Spectator: "basicbadge.png",
  };
  return mapping[rank_level] || "basicbadge.png";
}

export async function fetchTeamRMVChartData(
  team: string,
): Promise<TeamRMVChartRecord[]> {
  const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
    | string
    | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
    | string
    | undefined;

  if (!supabaseUrl || !anonKey) {
    return [];
  }

  const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

  const fallbackData: TeamRMVChartRecord[] = [];

  // Wrap entire operation with a 15-second timeout to avoid stuck loading states
  return Promise.race([
    withSupabaseFallback(
      "team-rmv-chart-data",
      async () => {
        // First try to get from team_rmv_per_owner, but if that returns nothing,
        // fallback to getting unique owners from Minted table for this team
        const rmvUrl = `${baseUrl}/team_rmv_per_owner?team=eq.${encodeURIComponent(team)}&select=wallet_address,rmv,staked_rmv,team_rank`;

        // Set 10-second timeout for the primary query
        const rmvController = new AbortController();
        const rmvTimeout = setTimeout(() => rmvController.abort(), 10000);

        let rmvResponse: Response;
        try {
          rmvResponse = await fetch(rmvUrl, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            signal: rmvController.signal,
          });
        } catch (err) {
          clearTimeout(rmvTimeout);
          if ((err as any)?.name === "AbortError") {
            console.warn("[fetchTeamRMVChartData] Team RMV query timed out, using fallback");
          }
          throw err;
        } finally {
          clearTimeout(rmvTimeout);
        }

        if (!rmvResponse.ok) {
          if (rmvResponse.status >= 500) {
            const statusMessage = rmvResponse.statusText || `HTTP ${rmvResponse.status}`;
            console.warn(`[fetchTeamRMVChartData] Server error fetching team RMV data: ${statusMessage}`);
          }
          // Fallback: get owners from Minted table
          const mintedUrl = `${baseUrl}/Minted?team=eq.${encodeURIComponent(team)}&select=current_owner`;

          const mintedController = new AbortController();
          const mintedTimeout = setTimeout(() => mintedController.abort(), 8000);

          let mintedResponse: Response;
          try {
            mintedResponse = await fetch(mintedUrl, {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
              signal: mintedController.signal,
            });
          } catch (err) {
            clearTimeout(mintedTimeout);
            console.warn("[fetchTeamRMVChartData] Fallback Minted query failed");
            throw err;
          } finally {
            clearTimeout(mintedTimeout);
          }

          if (!mintedResponse.ok) {
            return [];
          }

          const mintedData: Array<{ current_owner: string }> = await mintedResponse.json();
          const uniqueOwners = [...new Set(mintedData.map(m => m.current_owner).filter(Boolean))];

          if (uniqueOwners.length === 0) {
            return [];
          }

          // Build rmvData from owners (all with 0 RMV since they're not in team_rmv_per_owner)
          const rmvData = uniqueOwners.map((addr, idx) => ({
            wallet_address: addr,
            rmv: 0,
            staked_rmv: 0,
            team_rank: idx + 1,
          }));

          const profilesData = await fetch(
            `${baseUrl}/profiles?select=wallet_address,username&limit=10000`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            },
          ).then(async (res) => {
            if (!res.ok) return [];
            return (await res.json()) as Array<{
              wallet_address: string;
              username: string;
            }>;
          });

          const usernameMap = new Map(
            profilesData.map((p) => [p.wallet_address.toLowerCase(), p.username]),
          );

          const chartData = rmvData.map((rmv, idx) => ({
            wallet_address: rmv.wallet_address,
            username:
              usernameMap.get(rmv.wallet_address.toLowerCase()) ||
              rmv.wallet_address.slice(0, 6),
            rmv: 0,
            staked_rmv: 0,
            team_rank: idx + 1,
            rank_level: "Beginner",
            badge_image: "basicbadge.png",
          }));

          return chartData;
        }

        const rmvData: Array<{
          wallet_address: string;
          rmv: number | string;
          staked_rmv: number | string;
          team_rank: number | string;
        }> = await rmvResponse.json();

        if (!Array.isArray(rmvData) || rmvData.length === 0) {
          // Same fallback as above
          const mintedUrl = `${baseUrl}/Minted?team=eq.${encodeURIComponent(team)}&select=current_owner`;
          const mintedResponse = await fetch(mintedUrl, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });

          if (!mintedResponse.ok) {
            return [];
          }

          const mintedData: Array<{ current_owner: string }> = await mintedResponse.json();
          const uniqueOwners = [...new Set(mintedData.map(m => m.current_owner).filter(Boolean))];

          if (uniqueOwners.length === 0) {
            return [];
          }

          const rmvDataFallback = uniqueOwners.map((addr, idx) => ({
            wallet_address: addr,
            rmv: 0,
            staked_rmv: 0,
            team_rank: idx + 1,
          }));

          const profilesData = await fetch(
            `${baseUrl}/profiles?select=wallet_address,username&limit=10000`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            },
          ).then(async (res) => {
            if (!res.ok) return [];
            return (await res.json()) as Array<{
              wallet_address: string;
              username: string;
            }>;
          });

          const usernameMap = new Map(
            profilesData.map((p) => [p.wallet_address.toLowerCase(), p.username]),
          );

          const chartDataFallback = rmvDataFallback.map((rmv, idx) => ({
            wallet_address: rmv.wallet_address,
            username:
              usernameMap.get(rmv.wallet_address.toLowerCase()) ||
              rmv.wallet_address.slice(0, 6),
            rmv: 0,
            staked_rmv: 0,
            team_rank: idx + 1,
            rank_level: "Beginner",
            badge_image: "basicbadge.png",
          }));

          return chartDataFallback;
        }

        const walletAddresses = rmvData
          .map((r) => r.wallet_address)
          .filter(Boolean);

        if (walletAddresses.length === 0) {
          return [];
        }

        const [profilesData, rmvPerOwnerData] = await Promise.all([
          fetch(
            `${baseUrl}/profiles?select=wallet_address,username&limit=10000`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            },
          ).then(async (res) => {
            if (!res.ok) {
              if (res.status >= 500) {
                const statusMessage = res.statusText || `HTTP ${res.status}`;
                console.warn(`[fetchTeamRMVChartData] Failed to fetch profiles: ${statusMessage}`);
              }
              return [];
            }
            return (await res.json()) as Array<{
              wallet_address: string;
              username: string;
            }>;
          }),
          fetch(
            `${baseUrl}/rmv_per_owner?select=current_owner,Percentile&limit=10000`,
            {
              headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            },
          ).then(async (res) => {
            if (!res.ok) {
              if (res.status >= 500) {
                const statusMessage = res.statusText || `HTTP ${res.status}`;
                console.warn(`[fetchTeamRMVChartData] Failed to fetch rmv_per_owner: ${statusMessage}`);
              }
              return [];
            }
            return (await res.json()) as Array<{
              current_owner: string;
              Percentile: number | string | null;
            }>;
          }),
        ]);

        const usernameMap = new Map(
          profilesData.map((p) => [p.wallet_address.toLowerCase(), p.username]),
        );

        const percentileMap = new Map(
          rmvPerOwnerData.map((r) => [
            r.current_owner.toLowerCase(),
            r.Percentile,
          ]),
        );

        const chartData: TeamRMVChartRecord[] = rmvData
          .map((rmv) => {
            const percentile = percentileMap.get(
              rmv.wallet_address.toLowerCase(),
            );
            const rankLevel = calculateRankLevel(percentile);
            return {
              wallet_address: rmv.wallet_address,
              username:
                usernameMap.get(rmv.wallet_address.toLowerCase()) ||
                rmv.wallet_address.slice(0, 6),
              rmv: Number(rmv.rmv) || 0,
              staked_rmv: Number(rmv.staked_rmv) || 0,
              team_rank: Number(rmv.team_rank) || 0,
              rank_level: rankLevel,
              badge_image: getRankLevelBadgeImage(rankLevel),
            };
          })
          .sort((a, b) => a.team_rank - b.team_rank);

        return chartData;
      },
      fallbackData,
      "fetchTeamRMVChartData",
    ),
    // Overall operation timeout: if nothing resolves in 15 seconds, return empty array
    new Promise<TeamRMVChartRecord[]>((resolve) => {
      setTimeout(() => {
        console.warn("[fetchTeamRMVChartData] Overall operation timeout, returning empty data");
        resolve([]);
      }, 15000);
    }),
  ]);
}
