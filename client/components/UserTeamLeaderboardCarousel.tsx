import { useState, useEffect } from "react";
import MiniCarousel from "@/components/MiniCarousel";
import StakedHeldBar from "@/components/StakedHeldBar";
import { getTeamCrest } from "@/lib/teams";
import {
  fetchUserTeamLeaderboards,
  type UserTeamLeaderboardRecord,
} from "@/lib/userTeamLeaderboards";

interface UserTeamLeaderboardCarouselProps {
  walletAddress: string | null | undefined;
}

export default function UserTeamLeaderboardCarousel({
  walletAddress,
}: UserTeamLeaderboardCarouselProps) {
  const [data, setData] = useState<UserTeamLeaderboardRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        if (!walletAddress) {
          setData([]);
          return;
        }
        const carouselData = await fetchUserTeamLeaderboards(walletAddress);
        setData(carouselData);
      } catch (err) {
        console.error("[UserTeamLeaderboardCarousel] Error loading data:", err);
        setError("Failed to load team leaderboard data");
      } finally {
        setLoading(false);
      }
    };

    if (walletAddress) {
      loadData();
    }
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress) return;

    const pollInterval = setInterval(async () => {
      try {
        const carouselData = await fetchUserTeamLeaderboards(walletAddress);
        setData(carouselData);
      } catch (err) {
        console.error("[UserTeamLeaderboardCarousel] Polling error:", err);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [walletAddress]);

  // Don't render anything if there's an error, loading without data, or no data
  if (error || (loading && data.length === 0) || (!loading && data.length === 0)) {
    return null;
  }

  // Calculate max values for the bar visualization
  const maxRmv = Math.max(0, ...data.map((r) => r.rmv || 0));
  const stakedRmvValues = data
    .map((r) => r.staked_rmv || 0)
    .filter((v) => v > 0);

  return (
    <div
      className="rounded-md team-leaderboards-card"
      style={{
        marginTop: "12px",
        padding: "4px 12px 8px",
      }}
    >
      <div
        style={{
          color: "rgb(100, 116, 139)",
          fontSize: "12px",
          fontWeight: "400",
          letterSpacing: "0.3px",
          lineHeight: "16px",
          textTransform: "uppercase",
        }}
      >
        <p>Team Leaderboards</p>
      </div>
      <div
        className="rounded-md px-0 overflow-x-auto"
        style={{ paddingBottom: "8px" }}
      >
        <MiniCarousel
          count={data.length}
          itemWidthClass="w-[120px]"
          itemContainerClass="flex h-[170px] max-lg:h-[170px] w-[120px] shrink-0 flex-col"
          itemFrameClass="relative w-full flex-1 rounded-md border border-slate-200 bg-white dark:bg-slate-800 overflow-hidden p-2 flex flex-col justify-between"
          renderItemForIndex={(index) => {
            const item = data[index];
            if (!item) return null;

            return (
              <div
                className="absolute inset-0 py-1 px-0.5 flex flex-col justify-between bg-white rounded shadow-md overflow-hidden m-0.5"
                style={{
                  boxShadow: "1px 1px 3px 1px rgba(74, 74, 74, 0.5)",
                  margin: "2px",
                }}
              >
                <div className="flex flex-col gap-1">
                  <div className="text-base font-semibold text-slate-700 dark:text-slate-300 mx-auto flex">
                    <div className="max-lg:text-[18px]">#</div>
                    <div className="max-lg:text-[18px]">{item.team_rank}</div>
                  </div>
                  <div className="text-[11px] max-lg:text-[14px] font-medium max-lg:font-normal text-slate-600 dark:text-slate-400 truncate mx-auto">
                    {item.team}
                  </div>
                </div>

                <div className="flex flex-col gap-1 items-center">
                  {getTeamCrest(item.team) && (
                    <img
                      src={getTeamCrest(item.team) || ""}
                      alt={item.team}
                      style={{
                        width: "60px",
                        height: "60px",
                        objectFit: "contain",
                      }}
                    />
                  )}
                </div>

                <div className="w-full">
                  <StakedHeldBar
                    rmv={item.rmv || 0}
                    stakedRmv={item.staked_rmv || 0}
                    teamMaxRmv={maxRmv}
                    teamStakedRmvValues={stakedRmvValues}
                  />
                </div>
              </div>
            );
          }}
          containerPaddingClass="px-0"
          gapClass="gap-[2px]"
        />
      </div>
    </div>
  );
}
