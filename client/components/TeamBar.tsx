import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  fetchTeamRMVPerOwner,
  fetchTeamRMVPerOwnerByWallet,
  findTeamRMVByWallet,
  type TeamRMVPerOwnerRecord,
} from "@/lib/teamRmvPerOwner";
import { getTeamCrest } from "@/lib/teams";

function interpolateColor(percentile: number): string {
  const orange = { r: 255, g: 99, b: 0 };
  const blue = { r: 0, g: 79, b: 255 };

  const r = Math.round(orange.r + (blue.r - orange.r) * percentile);
  const g = Math.round(orange.g + (blue.g - orange.g) * percentile);
  const b = Math.round(orange.b + (blue.b - orange.b) * percentile);

  return `rgb(${r}, ${g}, ${b})`;
}

export default function TeamBar() {
  const account = useActiveAccount();
  const addr = account?.address ?? null;

  const [loading, setLoading] = useState(false);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [matchedData, setMatchedData] = useState<TeamRMVPerOwnerRecord | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // Fetch profile and team RMV data
  useEffect(() => {
    const loadProfileAndTeamData = async () => {
      try {
        setLoading(true);

        // Fetch profile to get favorite_team
        if (!addr) {
          setFavoriteTeam(null);
          setMatchedData(null);
          return;
        }

        const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!supabaseUrl || !anonKey) {
          return;
        }

        const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;

        // Fetch profile - use case-insensitive lookup
        const normalizedAddr = addr.toLowerCase();
        console.log("[TeamBar] Looking up profile for:", normalizedAddr);
        const profileUrl = `${baseUrl}/profiles?wallet_address=ilike.${encodeURIComponent(normalizedAddr)}&select=favorite_team`;
        const profileRes = await fetch(profileUrl, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        let favorite = null;
        if (profileRes.ok) {
          const profiles = await profileRes.json();
          if (Array.isArray(profiles) && profiles.length > 0) {
            favorite = profiles[0].favorite_team;
            console.log("[TeamBar] Found favorite team:", favorite);
            setFavoriteTeam(favorite);
          } else {
            console.log("[TeamBar] No profile found");
          }
        } else {
          console.log("[TeamBar] Profile fetch failed:", profileRes.status);
        }

        // Fetch team RMV data for this wallet (wallet-filtered is more efficient)
        if (favorite) {
          const teamRmvData = await fetchTeamRMVPerOwnerByWallet(addr);
          console.debug("[TeamBar] fetchTeamRMVPerOwnerByWallet returned:", teamRmvData);
          console.debug("[TeamBar] favorite team:", favorite);

          // Normalize team names for comparison (case-insensitive)
          const normalizeTeamName = (name: string | null | undefined) =>
            name?.toLowerCase().trim().replace(/\s+/g, " ") || "";

          // Find matching team record for this wallet
          const matched = teamRmvData.find(
            (record) => normalizeTeamName(record.team) === normalizeTeamName(favorite)
          );
          console.debug("[TeamBar] Matched record:", matched);

          // Verify the matched data is for the favorite team
          if (matched) {
            setMatchedData(matched);
            console.debug("[TeamBar] Team match successful, setting matched data");
          } else {
            console.debug("[TeamBar] No matching team found for:", favorite);
            setMatchedData(null);
          }
        } else {
          setMatchedData(null);
        }
      } catch (err) {
        // Silently handle fetch errors (network issues, etc.)
        console.debug("[TeamBar] Error loading profile or team data:", err);
        setFavoriteTeam(null);
        setMatchedData(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndTeamData();
  }, [addr]);

  useEffect(() => {
    if (!modalOpen) {
      setEntered(false);
      return;
    }
    const t = setTimeout(() => setEntered(true), 0);
    return () => clearTimeout(t);
  }, [modalOpen]);

  useEffect(() => {
    const onPointer = (e: Event) => {
      const t = e.target as Node | null;
      const insidePanel = !!(
        panelRef.current &&
        t &&
        panelRef.current.contains(t)
      );
      const insideButton = !!(
        buttonRef.current &&
        t &&
        buttonRef.current.contains(t)
      );
      if (!insidePanel && !insideButton) setModalOpen(false);
    };

    if (modalOpen) {
      document.addEventListener("pointerdown", onPointer);
      return () => {
        document.removeEventListener("pointerdown", onPointer);
      };
    }
  }, [modalOpen]);

  if (!addr) {
    return null;
  }

  const hasTeam = !!favoriteTeam;
  const teamRank = matchedData?.team_rank;
  const percentile = matchedData?.percentile;
  const percentilePercent = percentile
    ? (Number(percentile) * 100).toFixed(0)
    : "—";
  const rmvValue = matchedData?.rmv;
  const isNotRanked =
    !teamRank || teamRank === null || percentile === null;
  const teamCrestUrl = hasTeam
    ? getTeamCrest(favoriteTeam!) || "/images/teams/wfl_crest.png"
    : null;

  const fillWidth = percentile
    ? Math.max(1, Number(percentile) * 100)
    : 0;
  const barColor = percentile
    ? interpolateColor(Number(percentile))
    : "rgb(255, 99, 0)";

  return (
    <>
      <div className="flex-1 flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={() => setModalOpen(!modalOpen)}
          className="relative px-2 py-1 sm:px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm overflow-hidden hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer min-h-[38px] sm:min-h-12"
          style={{ width: "100%", margin: "0 auto" }}
          title={
            !hasTeam
              ? "No favorite team selected"
              : isNotRanked
                ? "Not Ranked"
                : `Team Rank #${teamRank} - Top ${percentilePercent}%`
          }
        >
          <div
            className="absolute inset-0 rounded-md transition-all"
            style={{
              width: `${fillWidth}%`,
              backgroundColor: barColor,
              opacity: 0.15,
              minWidth: "2%",
            }}
          />
          <div className="relative z-10 flex items-center gap-0.5 sm:gap-2">
            <span
              className="leading-5 sm:leading-normal px-1 sm:px-0"
              style={{ width: "100%", margin: "0 auto" }}
            >
              {loading ? (
                <span className="text-xs">Loading...</span>
              ) : !hasTeam || !matchedData || isNotRanked ? (
                <span className="font-medium text-slate-500 dark:text-slate-400">
                  Not Ranked
                </span>
              ) : (
                <div className="flex flex-col text-sm leading-4 sm:text-xs sm:leading-[14px] lg:flex-row lg:justify-between lg:text-sm lg:leading-normal lg:w-full">
                  <span className="font-medium whitespace-nowrap">
                    #{teamRank}
                  </span>
                  <p className="m-0 lg:hidden" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    <span>{percentilePercent}</span>%
                  </span>
                </div>
              )}
            </span>
            {teamCrestUrl && (
              <img
                src={teamCrestUrl}
                alt={`${favoriteTeam} crest`}
                className="h-[30px] w-[30px] sm:h-10 sm:w-10 object-contain flex-shrink-0"
                style={{ margin: "0 auto" }}
              />
            )}
          </div>
        </button>
      </div>

      {modalOpen && (
        <div
          className={`fixed left-0 right-0 bottom-16 z-30 transform transition-all duration-200 ${entered ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"}`}
          ref={panelRef}
        >
          <div className="mx-auto w-full px-3 flex flex-col">
            <div className="flex w-full flex-col gap-4 rounded-b-md border-b border-black/10 bg-white/95 p-4 backdrop-blur dark:border-white/10 dark:bg-black/80 mx-auto">
              <div className="flex w-full justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex-1 text-center">
                  {!hasTeam || !matchedData
                    ? "Team Rank"
                    : `${favoriteTeam} Team Rank`}
                </h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 flex-shrink-0"
                  aria-label="Close"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6 6 18"></path>
                    <path d="m6 6 12 12"></path>
                  </svg>
                </button>
              </div>
              {!hasTeam ? (
                <div className="flex flex-col text-sm text-slate-700 dark:text-slate-300 gap-4">
                  <p className="mx-auto">
                    No favorite team selected
                  </p>
                  <p className="mx-auto">
                    Select a favorite team in the{" "}
                    <Link
                      to="/my_club"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      "My Club"
                    </Link>{" "}
                    page or the{" "}
                    <Link
                      to="/collection"
                      className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      "Collection"
                    </Link>{" "}
                    page
                  </p>
                </div>
              ) : !matchedData ? (
                <div className="flex flex-col text-sm text-slate-700 dark:text-slate-300 gap-4">
                  <p className="mx-auto">
                    You currently hold 0 in value for your favorite team.
                    Start collecting to rise the ranks
                  </p>
                </div>
              ) : (
                <div className="flex flex-col text-sm text-slate-700 dark:text-slate-300">
                  <div className="flex flex-col">
                    {matchedData?.staked_rank !== null &&
                    matchedData?.staked_rank !== undefined ? (
                      <p className="mx-auto">
                        You currently rank{" "}
                        <span className="font-semibold">
                          #{matchedData.staked_rank}
                        </span>{" "}
                        on the {favoriteTeam} leaderboard with{" "}
                        <span className="font-semibold">
                          {matchedData.staked_rmv
                            ? String(matchedData.staked_rmv).substring(0, 8)
                            : "0"}
                        </span>{" "}
                        staked
                      </p>
                    ) : (
                      <p className="mx-auto">
                        Staking leaderboard ranking coming soon.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col mt-3">
                    <p className="mx-auto">
                      Your {favoriteTeam} collection ranks{" "}
                      <span className="font-semibold">#{teamRank ?? "—"}</span>{" "}
                      with{" "}
                      <span className="font-semibold">
                        {rmvValue ? String(rmvValue).substring(0, 8) : "0"}
                      </span>{" "}
                      RMV, higher than{" "}
                      <span className="font-semibold">
                        {percentilePercent}%
                      </span>{" "}
                      of all collectors
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
