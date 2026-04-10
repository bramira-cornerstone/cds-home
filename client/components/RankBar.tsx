import { useEffect, useRef, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateUserDropTier,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";

function interpolateColor(percentile: number): string {
  const orange = { r: 255, g: 99, b: 0 };
  const blue = { r: 0, g: 79, b: 255 };

  const r = Math.round(orange.r + (blue.r - orange.r) * percentile);
  const g = Math.round(orange.g + (blue.g - orange.g) * percentile);
  const b = Math.round(orange.b + (blue.b - orange.b) * percentile);

  return `rgb(${r}, ${g}, ${b})`;
}

export default function RankBar() {
  const account = useActiveAccount();
  const addr = account?.address ?? null;

  const [loading, setLoading] = useState(false);
  const [matchedData, setMatchedData] = useState<RMVPerOwnerRecord | null>(
    null,
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [entered, setEntered] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const previousLeagueRankRef = useRef<number | string | null>(null);
  const previousRankLevelRef = useRef<string | null>(null);
  const [rankChangeDisplay, setRankChangeDisplay] = useState<string | null>(
    null,
  );
  const [showRankChange, setShowRankChange] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const rankChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const loadRMVData = async () => {
    try {
      setLoading(true);
      const data = await fetchRMVPerOwner();

      if (addr) {
        const matched = findRMVByOwner(data, addr);

        if (matched) {
          const currentRankLevel = calculateRankLevel(matched.Percentile);
          const currentLeagueRank = matched.league_rank;

          // Check for rank level change
          if (
            previousRankLevelRef.current !== null &&
            previousRankLevelRef.current !== currentRankLevel
          ) {
            // Rank level changed - show toast notification
            toast.success(`You've just moved to the ${currentRankLevel} tier`);
          }

          // Check for league rank change
          if (
            previousLeagueRankRef.current !== null &&
            previousLeagueRankRef.current !== currentLeagueRank
          ) {
            const prevRank = Number(previousLeagueRankRef.current);
            const currRank = Number(currentLeagueRank);
            const rankDiff = prevRank - currRank; // positive = moved up (better)

            if (rankDiff !== 0) {
              const displayText = rankDiff > 0 ? `+${rankDiff}` : `${rankDiff}`;
              setRankChangeDisplay(displayText);
              setShowRankChange(true);

              // Clear previous timeout
              if (rankChangeTimeoutRef.current) {
                clearTimeout(rankChangeTimeoutRef.current);
              }

              // Hide after 4 seconds
              rankChangeTimeoutRef.current = setTimeout(() => {
                setShowRankChange(false);
                setRankChangeDisplay(null);
              }, 4000);
            }
          }

          // Update previous values
          previousLeagueRankRef.current = currentLeagueRank;
          previousRankLevelRef.current = currentRankLevel;

          setMatchedData(matched);
        } else {
          setMatchedData(null);
        }
      } else {
        setMatchedData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    if (addr) {
      loadRMVData();
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (rankChangeTimeoutRef.current) {
        clearTimeout(rankChangeTimeoutRef.current);
      }
    };
  }, [addr]);

  // Set up 5-minute polling
  useEffect(() => {
    if (!addr) return;

    // Poll every 5 minutes (300000 ms)
    pollIntervalRef.current = setInterval(() => {
      loadRMVData();
    }, 300000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
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

  const leagueRank = matchedData?.league_rank;
  const percentile = matchedData?.Percentile;
  const percentilePercent = percentile
    ? (Number(percentile) * 100).toFixed(0)
    : "—";
  const totalRollingMedianSale = matchedData?.total_rolling_median_sale;
  const userDropTier = calculateUserDropTier(percentile);
  const rankLevel = calculateRankLevel(percentile);
  const shouldShowBadge =
    rankLevel && rankLevel !== "Spectator" && rankLevel !== "Beginner";
  const badgeImageUrl = shouldShowBadge
    ? rankLevel === "Diamond"
      ? "/images/diamondbadge.png"
      : rankLevel === "Epic"
        ? "/images/epicbadge.png"
        : rankLevel === "Rare"
          ? "/images/rarebadge.png"
          : rankLevel === "Basic"
            ? "/images/basicbadge.png"
            : ""
    : "";

  const fillWidth = percentile ? Math.max(1, Number(percentile) * 100) : 0;
  const barColor = percentile
    ? interpolateColor(Number(percentile))
    : "rgb(255, 99, 0)";

  return (
    <>
      <div className="flex-1 flex items-center justify-center">
        <button
          ref={buttonRef}
          onClick={() => setModalOpen(!modalOpen)}
          className="relative px-2 py-1 sm:px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm overflow-hidden hover:border-slate-400 dark:hover:border-slate-500 transition-colors cursor-pointer"
          style={{ width: "100%", margin: "0 auto", minHeight: "48px" }}
          title={
            !matchedData
              ? "Unranked"
              : `Rank #${leagueRank ?? "—"} - Top ${percentilePercent}%`
          }
        >
          <div
            className="absolute inset-0 rounded-md transition-all"
            style={{
              width: `${fillWidth}%`,
              backgroundColor: barColor,
              opacity: 0.15,
              minWidth: "1%",
            }}
          />
          <div className="relative z-10 flex items-center gap-0.5 sm:gap-2">
            <span
              className="leading-5 sm:leading-normal px-1 sm:px-0"
              style={{ width: "100%", margin: "0 auto" }}
            >
              {loading ? (
                <span className="text-xs">Loading...</span>
              ) : !matchedData ? (
                <span className="font-medium">Unranked</span>
              ) : showRankChange && rankChangeDisplay ? (
                <span className="font-medium text-base transition-all">
                  {rankChangeDisplay}
                </span>
              ) : (
                <div className="flex flex-col text-sm leading-4 sm:text-xs sm:leading-[14px] lg:flex-row lg:justify-between lg:text-sm lg:leading-normal lg:w-full">
                  <span className="font-medium whitespace-nowrap">
                    #{leagueRank ?? "—"}
                  </span>
                  <p className="m-0 lg:hidden" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    <span>{percentilePercent}</span>%
                  </span>
                </div>
              )}
            </span>
            {shouldShowBadge && badgeImageUrl && (
              <img
                src={badgeImageUrl}
                alt={`${rankLevel} badge`}
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
                  Your Collector Rank
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
              <div className="flex flex-col text-sm text-slate-700 dark:text-slate-300">
                <div className="flex flex-col">
                  <p className="mx-auto">
                    You hold{" "}
                    <span className="font-semibold">
                      {totalRollingMedianSale ?? "0"}
                    </span>{" "}
                    in relic value
                  </p>
                </div>
                <div className="flex flex-col mt-3">
                  <p className="mx-auto">
                    {!matchedData ? (
                      <>
                        You collection ranks you higher than{" "}
                        <span className="font-semibold">0</span> collectors
                      </>
                    ) : (
                      <>
                        Your collection ranks you{" "}
                        <span className="font-semibold">
                          #{leagueRank ?? "—"}
                        </span>
                        , higher than{" "}
                        <span className="font-semibold">
                          {percentilePercent}%
                        </span>{" "}
                        of all collectors.
                      </>
                    )}
                  </p>
                </div>
                <div className="flex flex-col mt-3">
                  <p className="mx-auto">
                    {!matchedData ? (
                      <>
                        Holding this spot entitles you to only{" "}
                        <span className="font-semibold">public allowlist</span>{" "}
                        Box Drops
                      </>
                    ) : (
                      <>
                        Holding this spot entitles you to{" "}
                        <span className="font-semibold">{userDropTier}</span>{" "}
                        Box Drop allowlists
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
