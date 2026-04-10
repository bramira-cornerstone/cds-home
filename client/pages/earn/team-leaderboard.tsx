import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { getTeam, getTeamCrest } from "@/lib/teams";
import { getUsernameForWallet } from "@/lib/profiles";
import { calculateRankLevel } from "@/lib/rmvPerOwner";
import TeamLeaderboardStakedBar from "@/components/TeamLeaderboardStakedBar";
import { StakingModal } from "@/components/StakingModal";
import { RedemptionsCard } from "@/components/RedemptionsCard";
import { fetchMintedByDropWeek } from "@/lib/supabaseMinted";

interface LeaderboardRow {
  wallet_address: string;
  team: string;
  rmv: number;
  staked_rmv: number;
  team_rank: number;
  staked_rank: number | null;
  percentile: number;
  last_buy: string | null;
  last_stake: string | null;
}

interface RMVPerOwnerRecord {
  current_owner: string;
  Percentile: number | null;
}

interface AirdropWindow {
  id: number;
  team_airdrop: string;
  airdrops_close: string;
  drop_week?: string;
}

function slugToTeamName(slug: string): string {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TeamLeaderboardPage() {
  const { team: teamSlug } = useParams<{ team: string }>();
  const navigate = useNavigate();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [usernameMap, setUsernameMap] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [rmvPerOwnerMap, setRmvPerOwnerMap] = useState<
    Map<string, RMVPerOwnerRecord>
  >(new Map());
  const [airdropWindow, setAirdropWindow] = useState<AirdropWindow | null>(
    null,
  );
  const [countdown, setCountdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [fanFavoriteMintedData, setFanFavoriteMintedData] = useState<any>(null);
  const [isStakingModalOpen, setIsStakingModalOpen] = useState(false);

  const teamName = teamSlug ? slugToTeamName(teamSlug) : null;
  const team = teamName ? getTeam(teamName) : null;
  const crestImage = team ? getTeamCrest(team.team_name) : null;

  useEffect(() => {
    if (!teamName) {
      setLoading(false);
      return;
    }

    const fetchLeaderboard = async () => {
      try {
        const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!baseUrl || !anonKey) {
          setLeaderboardData([]);
          setLoading(false);
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/team_rmv_per_owner?team=eq.${encodeURIComponent(
          teamName,
        )}&staked_rank=not.is.null&select=*&order=staked_rank.asc`;

        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
          mode: "cors",
        });

        if (res.ok) {
          const data = (await res.json()) as LeaderboardRow[];
          setLeaderboardData(data);
        } else {
          setLeaderboardData([]);
        }
      } catch (err) {
        console.error("Failed to fetch leaderboard data:", err);
        setLeaderboardData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, [teamName]);

  // Fetch usernames and RMV per owner data for all wallet addresses in the leaderboard
  useEffect(() => {
    const fetchUsernamesAndRMV = async () => {
      const usernames = new Map<string, string | null>();
      const rmvPerOwner = new Map<string, RMVPerOwnerRecord>();

      // Fetch all RMV per owner data
      const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.SUPABASE_ANON_KEY as
        | string
        | undefined;

      if (baseUrl && anonKey) {
        try {
          const root = baseUrl.replace(/\/$/, "");
          const url = `${root}/rest/v1/rmv_per_owner?select=current_owner,Percentile`;

          const res = await fetch(url, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
            mode: "cors",
          });

          if (res.ok) {
            const data = (await res.json()) as RMVPerOwnerRecord[];
            for (const record of data) {
              rmvPerOwner.set(record.current_owner.toLowerCase(), record);
            }
          }
        } catch (err) {
          console.error("Failed to fetch RMV per owner data:", err);
        }
      }

      for (const row of leaderboardData) {
        const username = await getUsernameForWallet(row.wallet_address);
        usernames.set(row.wallet_address.toLowerCase(), username);
      }
      setUsernameMap(usernames);
      setRmvPerOwnerMap(rmvPerOwner);
    };

    if (leaderboardData.length > 0) {
      fetchUsernamesAndRMV();
    }
  }, [leaderboardData]);

  // Fetch airdrop window data
  useEffect(() => {
    if (!teamName) {
      setAirdropWindow(null);
      return;
    }

    const fetchAirdropWindow = async () => {
      try {
        const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!baseUrl || !anonKey) {
          setAirdropWindow(null);
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/drop_week_windows?team_airdrop=eq.${encodeURIComponent(
          teamName,
        )}&select=*`;

        const res = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
          mode: "cors",
        });

        if (res.ok) {
          const data = (await res.json()) as AirdropWindow[];
          if (data.length > 0) {
            const window = data[0];
            const closeTime = new Date(window.airdrops_close);
            const now = new Date();

            // Check if close time is >= now
            if (closeTime >= now) {
              setAirdropWindow(window);

              // Fetch Fan Favorite Minted data if drop_week is available
              if (window.drop_week) {
                const mintedData = await fetchMintedByDropWeek(
                  window.drop_week,
                );
                if (mintedData && mintedData.SetName === "Fan Favorite") {
                  setFanFavoriteMintedData(mintedData);
                } else {
                  setFanFavoriteMintedData(null);
                }
              }
            } else {
              setAirdropWindow(null);
              setFanFavoriteMintedData(null);
            }
          } else {
            setAirdropWindow(null);
            setFanFavoriteMintedData(null);
          }
        }
      } catch (err) {
        console.error("Failed to fetch airdrop window data:", err);
        setAirdropWindow(null);
      }
    };

    fetchAirdropWindow();
  }, [teamName]);

  // Countdown timer effect
  useEffect(() => {
    if (!airdropWindow) {
      setCountdown(null);
      return;
    }

    const updateCountdown = () => {
      const closeTime = new Date(airdropWindow.airdrops_close);
      const now = new Date();
      const diffMs = closeTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        setCountdown(null);
        return;
      }

      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [airdropWindow]);

  if (!team) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">
            Team not found
          </h1>
          <button
            onClick={() => navigate("/reward")}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Back to Reward
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-6">
      <style>{`
        /* Countdown timer styling - all responsive widths */
        .countdown-timer {
          font-size: 40px !important;
          line-height: 40px !important;
          color: rgba(255, 99, 0, 1) !important;
          background-color: rgba(255, 255, 255, 1) !important;
        }

        /* Mobile background styling for leaderboard table */
        @media (max-width: 640px) {
          .team-leaderboard-table {
            background-color: rgb(255, 255, 255) !important;
          }
          .team-leaderboard-table td {
            padding: 12px 2px !important;
          }
        }
        @media (max-width: 991px) {
          .team-leaderboard-table tbody {
            background-color: rgb(255, 255, 255) !important;
          }
          .team-leaderboard-rank {
            width: auto !important;
            align-self: center !important;
            padding: 0 2px !important;
          }
          .team-leaderboard-wallet {
            padding: 0 2px !important;
            flex-wrap: wrap !important;
          }
          .team-leaderboard-bars {
            padding: 0 2px !important;
          }
          .team-leaderboard-date {
            width: auto !important;
            align-self: center !important;
            padding: 0 2px !important;
          }
          .airdrop-announcement {
            color: rgba(0, 0, 0, 1) !important;
          }
        }
      `}</style>
      <button
        onClick={() => navigate("/reward")}
        className="mb-4 text-blue-600 hover:text-blue-700 text-sm font-medium"
      >
        ← Back to Teams
      </button>
      {/* Header with team crest */}
      <div className="mb-8 flex flex-col items-center">
        {crestImage && (
          <div className="w-32 h-32 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center bg-slate-50 mb-4">
            <img
              src={crestImage}
              alt={team.team_name}
              className="w-full h-full object-contain p-4"
            />
          </div>
        )}
        <h1 className="text-4xl font-bold text-slate-800 mb-2 text-center">
          {team.team_name} Leaderboard
        </h1>
      </div>

      {/* Two-column layout: RedemptionsCard (left) and Leaderboard (right) */}
      <div className="gap-5 flex max-lg:flex-col max-lg:gap-6">
        {/* Left column: RedemptionsCard */}
        <div className="w-1/2 max-lg:w-full">
          <RedemptionsCard
            team={team?.team_name ?? null}
            editionId={fanFavoriteMintedData?.edition_id ?? null}
            airdropWindow={airdropWindow}
            countdown={countdown}
            fanFavoriteMintedData={fanFavoriteMintedData}
          />
        </div>

        {/* Right column: Join button + Leaderboard table */}
        <div className="w-1/2 max-lg:w-full">
          {/* Join the Leaderboard button */}
          <div className="flex justify-center w-full mb-6">
            <button
              onClick={() => setIsStakingModalOpen(true)}
              className="w-full px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              Join the Leaderboard
            </button>
          </div>

          {/* Leaderboard table */}
          {loading ? (
            <div className="text-center py-8">
              <p className="text-slate-600">Loading leaderboard...</p>
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600">
                Be the first to stake your collectibles
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm md:text-base team-leaderboard-table">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Rank
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      <p>Collector</p>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Staked / Held
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Calculate max rmv and staked_rmv values for the team
                    const teamMaxRmv = Math.max(
                      0,
                      ...leaderboardData.map((r) => r.rmv || 0),
                    );
                    const teamStakedRmvValues = leaderboardData
                      .map((r) => r.staked_rmv || 0)
                      .filter((v) => v > 0);

                    return leaderboardData.map((row, idx) => (
                      <tr
                        key={idx}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors bg-white"
                      >
                        <td className="px-4 py-3 font-semibold text-slate-800 team-leaderboard-rank">
                          #{row.staked_rank ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs md:text-sm team-leaderboard-wallet">
                          <div className="flex items-center gap-2">
                            <span className="truncate">
                              {usernameMap.get(
                                row.wallet_address.toLowerCase(),
                              ) || "Unknown User"}
                            </span>
                            {(() => {
                              const rmvRecord = rmvPerOwnerMap.get(
                                row.wallet_address.toLowerCase(),
                              );
                              if (
                                rmvRecord?.Percentile !== null &&
                                rmvRecord?.Percentile !== undefined
                              ) {
                                const rankLevel = calculateRankLevel(
                                  rmvRecord.Percentile,
                                );
                                const badgeFileName = `${rankLevel.toLowerCase()}badge.png`;
                                return (
                                  <img
                                    src={`/images/${badgeFileName}`}
                                    alt={rankLevel}
                                    className="flex-shrink-0 object-contain"
                                    style={{ width: "25px", height: "25px" }}
                                  />
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 team-leaderboard-bars">
                          <TeamLeaderboardStakedBar
                            rmv={row.rmv || 0}
                            stakedRmv={row.staked_rmv || 0}
                            teamMaxRmv={teamMaxRmv}
                            teamStakedRmvValues={teamStakedRmvValues}
                          />
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 text-xs md:text-sm team-leaderboard-date">
                          {row.last_stake
                            ? new Date(row.last_stake).toLocaleString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })
                            : "—"}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Staking Modal */}
      <StakingModal
        isOpen={isStakingModalOpen}
        onClose={() => setIsStakingModalOpen(false)}
        team={team?.team_name}
      />
    </section>
  );
}
