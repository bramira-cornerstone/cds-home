import { useNavigate } from "react-router-dom";
import { useEffect, useState, useMemo } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useSharedCountdownBreakdown } from "@/hooks/useSharedCountdown";
import { getAllTeams } from "@/lib/teams";
import EditionSplineScene from "@/components/EditionSplineScene";
import { fetchMintedByDropWeek } from "@/lib/supabaseMinted";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

interface LeaderboardRow {
  wallet_address: string;
  team: string;
  rmv: number;
  staked_rmv: number;
  staked_rank: number | null;
  team_rank: number;
}

interface AirdropWindow {
  id: number;
  team_airdrop: string;
  airdrops_close: string;
  drop_week?: string;
}

function teamNameToSlug(teamName: string): string {
  return teamName.toLowerCase().replace(/\s+/g, "-");
}

interface AirdropWindowDisplayProps {
  teamName: string;
  window: AirdropWindow;
  mintedData: any;
  countdown: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null;
  activeListings: any;
  activeAuctions: any;
}

function AirdropWindowDisplay({
  teamName,
  window,
  mintedData,
  countdown,
  activeListings,
  activeAuctions,
}: AirdropWindowDisplayProps) {
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  // Check if current time is before 5pm EST on airdrops_close date
  const isBeforeDeadline = useMemo(() => {
    try {
      const closeDate = new Date(window.airdrops_close);
      // Set to 5pm EST on the close date
      const estDate = new Date(closeDate);
      estDate.setHours(21, 0, 0, 0); // 21:00 UTC = 5pm EST
      return new Date() < estDate;
    } catch {
      return true; // Default to showing if date parsing fails
    }
  }, [window.airdrops_close]);

  const activeListingsCount = useMemo(() => {
    if (!mintedData?.edition_id) return 0;
    const editionId = mintedData.edition_id;
    const serialsSet = new Set<number>();
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === editionId &&
          listing.serial !== null &&
          listing.status === "active"
        ) {
          serialsSet.add(listing.serial);
        }
      }
    }
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === editionId &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }
    return serialsSet.size;
  }, [mintedData?.edition_id, activeListings, activeAuctions]);

  useEffect(() => {
    if (!mintedData?.edition_id) {
      setStakedCount(0);
      return;
    }

    const fetchStakedCount = async () => {
      try {
        const count = await countStakedTokensByEditionId(mintedData.edition_id);
        setStakedCount(count ?? 0);
      } catch (error) {
        console.error("Failed to fetch staked count:", error);
        setStakedCount(0);
      }
    };

    fetchStakedCount();
  }, [mintedData?.edition_id]);

  useEffect(() => {
    if (!mintedData?.edition_id) {
      setInPacksCount(0);
      return;
    }

    const fetchInPacksCount = async () => {
      try {
        const count = await countInPackTokensByEditionId(mintedData.edition_id);
        setInPacksCount(count ?? 0);
      } catch (error) {
        console.error("Failed to fetch in-packs count:", error);
        setInPacksCount(0);
      }
    };

    fetchInPacksCount();
  }, [mintedData?.edition_id]);

  useEffect(() => {
    if (!mintedData?.edition_id) {
      setRedeemedCount(0);
      return;
    }

    const fetchRedeemedCount = async () => {
      try {
        const count = await countRedeemedTokensByEditionId(
          mintedData.edition_id,
        );
        setRedeemedCount(count ?? 0);
      } catch (error) {
        console.error("Failed to fetch redeemed count:", error);
        setRedeemedCount(0);
      }
    };

    fetchRedeemedCount();
  }, [mintedData?.edition_id]);

  if (!isBeforeDeadline) {
    return null;
  }

  return (
    <div className="mb-8 text-center">
      <p className="text-slate-600 text-sm mb-2">
        Free 'Fan Favorite' relic rewarded to the top 50 ranked{" "}
        <span style={{ fontWeight: "700" }}>{teamName}</span> collectors on:
      </p>
      <p className="text-slate-600 text-sm">
        {new Date(window.airdrops_close).toISOString().split("T")[0]} 5pm EST
      </p>
      {countdown && (
        <p
          className="earn-countdown mt-2"
          style={{
            fontSize: "40px",
            lineHeight: "40px",
            color: "#FF6300",
            textShadow: "1px 1px 25px rgba(155, 155, 155, 1)",
            fontWeight: "400",
            margin: "0",
          }}
        >
          {countdown.days}d {countdown.hours}h {countdown.minutes}m{" "}
          {countdown.seconds}s
        </p>
      )}
      {mintedData && (
        <div className="mt-6 flex justify-center">
          <div className="w-full max-w-sm h-96">
            <EditionSplineScene
              edition_id={mintedData.edition_id ?? null}
              overlayUrl={
                mintedData?.video_location
                  ? `https://stream.mux.com/${String(mintedData.video_location).trim()}.m3u8`
                  : undefined
              }
              minted={mintedData.Minted ?? null}
              playerName={mintedData.PlayerName ?? null}
              seriesName={mintedData.SeriesName ?? null}
              tierValue={mintedData.TierValue ?? null}
              productName={mintedData.ProductName ?? null}
              playDescription={mintedData.PlayDescription ?? null}
              setName={mintedData.SetName ?? null}
              finalScore={mintedData.FinalScore ?? null}
              gameDate={mintedData.GameDate ?? null}
              statValue1={mintedData.PlayerStatValue1 ?? null}
              statValue2={mintedData.PlayerStatValue2 ?? null}
              statValue3={mintedData.PlayerStatValue3 ?? null}
              statValue4={mintedData.PlayerStatValue4 ?? null}
              statValue5={mintedData.PlayerStatValue5 ?? null}
              statName1={mintedData.PlayerStat1 ?? null}
              statName2={mintedData.PlayerStat2 ?? null}
              statName3={mintedData.PlayerStat3 ?? null}
              statName4={mintedData.PlayerStat4 ?? null}
              statName5={mintedData.PlayerStat5 ?? null}
              badge1={mintedData.Badge1 ?? null}
              badge2={mintedData.Badge2 ?? null}
              badge3={mintedData.Badge3 ?? null}
              team={mintedData.team ?? null}
              forceSerialMode={false}
              showControls={true}
              autoPlay={true}
              activeListingsCount={activeListingsCount}
              stakedCount={stakedCount}
              inPacksCount={inPacksCount}
              redeemedCount={redeemedCount}
            />
          </div>
        </div>
      )}
    </div>
  );
}

async function fetchTeamLeaderboard(
  teamName: string,
): Promise<LeaderboardRow[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const root = baseUrl.replace(/\/$/, "");
  const url = `${root}/rest/v1/team_rmv_per_owner?team=eq.${encodeURIComponent(
    teamName,
  )}&select=wallet_address,team,rmv,staked_rmv,staked_rank,team_rank`;

  // Use Promise wrapper with synchronous error handling
  return new Promise<LeaderboardRow[]>((resolve) => {
    // Wrap everything in immediate resolution to catch sync errors
    Promise.resolve()
      .then(() => {
        // Wrap fetch in try/catch to handle any synchronous throws
        try {
          return fetch(url, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
            mode: "cors",
          });
        } catch (syncErr) {
          // If fetch throws synchronously, return rejected promise
          return Promise.reject(syncErr);
        }
      })
      .then((res) => {
        if (!res.ok) {
          // Only log 5xx server errors - silently return empty for other statuses
          if (res.status >= 500) {
            console.error(
              `[fetchTeamLeaderboard] Server error (${res.status}) for team ${teamName}`,
            );
          }
          // For 4xx, zero records, and other cases - silently return []
          return [];
        }

        // Success - return the data (including zero records, which is valid)
        return res.json() as Promise<LeaderboardRow[]>;
      })
      .catch((err: any) => {
        // Catch ALL errors - network errors, parse errors, sync errors, etc.
        // Only log AbortError for debugging
        if (err?.name === "AbortError") {
          console.debug("[fetchTeamLeaderboard] Request aborted");
        }
        // For all other errors (including TypeError: Failed to fetch) - completely silent
        return [];
      })
      .then((result) => {
        // Always resolve (never reject) - ensures no unhandled rejection
        resolve(result);
      });
  });
}

export default function EarnPage() {
  const betaAllowlist = useBetaAllowlist();
  const navigate = useNavigate();
  const teams = getAllTeams();
  const account = useActiveAccount();
  const connectedWallet = account?.address?.toLowerCase() ?? null;
  const [leaderboardData, setLeaderboardData] = useState<
    Map<string, LeaderboardRow[]>
  >(new Map());
  const [airdropWindows, setAirdropWindows] = useState<
    Map<string, AirdropWindow>
  >(new Map());
  const [mintedDataByDropWeek, setMintedDataByDropWeek] = useState<
    Map<string, any>
  >(new Map());
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();

  // Compute the first airdrop window's close time in milliseconds
  const firstWindowMs = useMemo(() => {
    if (airdropWindows.size === 0) return 0;
    const firstWindow = Array.from(airdropWindows.values())[0];
    return new Date(firstWindow.airdrops_close).getTime();
  }, [airdropWindows]);

  // Use shared countdown hook for the first airdrop window
  const countdown = useSharedCountdownBreakdown(firstWindowMs);

  useEffect(() => {
    const fetchAllLeaderboards = async () => {
      try {
        const data = new Map<string, LeaderboardRow[]>();
        for (const team of teams) {
          const leaderboard = await fetchTeamLeaderboard(team.team_name);
          data.set(team.team_name, leaderboard);
        }
        setLeaderboardData(data);
      } catch (err: any) {
        // Silently handle any unexpected errors - just set empty state
        // Individual team fetch errors are already handled in fetchTeamLeaderboard
        setLeaderboardData(new Map());
      }
    };

    // Call the async function and catch any unhandled promise rejections
    fetchAllLeaderboards().catch(() => {
      // Silently suppress any unexpected promise rejections
    });
  }, [teams]);

  // Fetch airdrop windows
  useEffect(() => {
    const fetchAirdropWindows = async () => {
      try {
        const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!baseUrl || !anonKey) {
          setAirdropWindows(new Map());
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/drop_week_windows?select=*`;

        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
          mode: "cors",
        });

        if (!res.ok) {
          // 4xx: log as warning
          if (res.status >= 400 && res.status < 500) {
            console.warn(`[fetchAirdropWindows] Client error (${res.status})`);
          }
          // 5xx: log as error
          if (res.status >= 500) {
            console.error(`[fetchAirdropWindows] Server error (${res.status})`);
          }
          setAirdropWindows(new Map());
          return;
        }

        const data = (await res.json()) as AirdropWindow[];
        const windowMap = new Map<string, AirdropWindow>();
        const mintedMap = new Map<string, any>();
        const now = new Date();

        for (const window of data) {
          const closeTime = new Date(window.airdrops_close);
          if (closeTime >= now) {
            windowMap.set(window.team_airdrop, window);

            // Fetch Minted data for this drop week if available
            if (window.drop_week) {
              const mintedData = await fetchMintedByDropWeek(window.drop_week);
              if (mintedData) {
                mintedMap.set(window.drop_week, mintedData);
              }
            }
          }
        }

        setAirdropWindows(windowMap);
        setMintedDataByDropWeek(mintedMap);
      } catch (err: any) {
        // Network errors (TypeError: Failed to fetch) - silently continue
        // Don't log network-level errors, they're transient and not actionable
        if (err?.name === "AbortError") {
          console.debug("[fetchAirdropWindows] Request aborted");
        }
        // For all other errors including network errors, silently set empty state
        setAirdropWindows(new Map());
      }
    };

    fetchAirdropWindows();
  }, []);


  // Temporarily deactivated betaAllowlist check
  // if (betaAllowlist !== true) {
  //   return (
  //     <section className="container mx-auto px-4 py-16">
  //       <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
  //         Platform is invitation only. Log in and enter your invite code to
  //         join.
  //       </div>
  //     </section>
  //   );
  // }

  return (
    <section className="container mx-auto px-4 py-6 nightmode_nocards">
      <div className="w-full mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F05b48101c3264e39abf9122f11ad5e24"
          alt="Reward banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <h1 className="mb-2 text-center uppercase font-sans text-[40px] leading-none text-slate-800">
        EARN
      </h1>
      <style>{`
        /* LOCKED STYLES - DO NOT OVERRIDE */
        /* These styles are manually set and should not be modified by style guides or design tools */
        .earn-subheader {
          margin-bottom: 32px !important;
        }
        @media (max-width: 640px) {
          .earn-subheader {
            margin-bottom: 4px !important;
          }
        }
        .earn-grid {
          gap: 0px !important;
        }
        @media (max-width: 640px) {
          .earn-grid {
            gap: 8px !important;
          }
        }
        .earn-rank-text {
          text-shadow: none;
        }
        @media (max-width: 640px) {
          .earn-rank-text {
            text-shadow: 1px 1px 3px rgba(155, 155, 155, 1) !important;
          }
        }
        @media (max-width: 991px) {
          .earn-countdown {
            text-shadow: 1px 1px 3px rgba(155, 155, 155, 1) !important;
          }
        }
      `}</style>
      {airdropWindows.size > 0 &&
        Array.from(airdropWindows.entries()).map(([teamName, window]) => {
          const mintedData = window.drop_week
            ? mintedDataByDropWeek.get(window.drop_week)
            : null;

          return (
            <AirdropWindowDisplay
              key={teamName}
              teamName={teamName}
              window={window}
              mintedData={mintedData}
              countdown={countdown}
              activeListings={activeListings}
              activeAuctions={activeAuctions}
            />
          );
        })}

      <p className="earn-subheader text-center text-slate-600 text-lg font-medium">
        Team Leaderboards
      </p>

      <div
        className="earn-grid grid grid-cols-5 md:grid-cols-10 lg:grid-cols-20 gap-0 justify-items-center"
        style={{ gap: "0px" }}
      >
        {teams
          .sort((a, b) => a.team_name.localeCompare(b.team_name))
          .map((team) => {
            const teamLeaderboard = leaderboardData.get(team.team_name) ?? [];
            const walletRecord = connectedWallet
              ? teamLeaderboard.find(
                  (r) => r.wallet_address.toLowerCase() === connectedWallet,
                )
              : undefined;
            const stakedRank = walletRecord?.staked_rank ?? null;
            const teamRank = walletRecord?.team_rank ?? 0;
            const stakedRmv = walletRecord?.staked_rmv ?? 0;
            const rmv = walletRecord?.rmv ?? 0;

            // Calculate progress as staked_rank / team_rank (treating null staked_rank as 0)
            const effectiveStakedRank = stakedRank ?? 0;
            const progress =
              teamRank > 0 ? (effectiveStakedRank / teamRank) * 100 : 0;

            return (
              <button
                key={team.team_name}
                onClick={() =>
                  navigate(`/reward/${teamNameToSlug(team.team_name)}`)
                }
                className="flex flex-col items-center gap-0 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ gap: "0px" }}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 lg:w-24 lg:h-24 rounded-lg overflow-hidden border border-slate-200 hover:border-slate-400 transition-colors flex items-center justify-center bg-slate-50">
                  <img
                    src={team.crest_image}
                    alt={team.team_name}
                    className="w-full h-full object-contain p-2"
                  />
                </div>
                <span className="text-xs md:text-sm font-medium text-slate-700 text-center">
                  {team.team_name}
                </span>
                {walletRecord ? (
                  <div className="mt-1 w-full px-1">
                    <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-blue-600 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                      {stakedRank !== null && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-white leading-none earn-rank-text">
                            #{stakedRank}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </button>
            );
          })}
      </div>
    </section>
  );
}
