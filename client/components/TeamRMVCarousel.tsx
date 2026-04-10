import { useState, useEffect } from "react";
import MiniCarousel from "@/components/MiniCarousel";
import StakedHeldBar from "@/components/StakedHeldBar";
import {
  fetchTeamRMVChartData,
  type TeamRMVChartRecord,
} from "@/lib/teamRmvChartData";

interface TeamRMVCarouselProps {
  team: string;
}

export default function TeamRMVCarousel({ team }: TeamRMVCarouselProps) {
  const [data, setData] = useState<TeamRMVChartRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComingSoonModal, setShowComingSoonModal] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const carouselData = await fetchTeamRMVChartData(team);
        setData(carouselData);
        setRetryCount(0); // Reset retry count on success
      } catch (err) {
        console.error("[TeamRMVCarousel] Error loading data:", err);
        setError("Failed to load team data");
      } finally {
        setLoading(false);
      }
    };

    if (team) {
      loadData();
    }
  }, [team]);

  // Retry logic: retry quickly on error, then slower polling
  useEffect(() => {
    if (!team || !error || retryCount >= 3) return;

    // Retry after 5 seconds, increasing the delay with each retry
    const retryDelay = Math.min(5000 * Math.pow(2, retryCount), 20000);
    const retryTimer = setTimeout(() => {
      setRetryCount((prev) => prev + 1);
      setLoading(true);
      setError(null);
      fetchTeamRMVChartData(team)
        .then((carouselData) => {
          setData(carouselData);
          setRetryCount(0);
        })
        .catch((err) => {
          console.error("[TeamRMVCarousel] Retry error:", err);
          setError("Failed to load team data");
        })
        .finally(() => {
          setLoading(false);
        });
    }, retryDelay);

    return () => clearTimeout(retryTimer);
  }, [team, error, retryCount]);

  useEffect(() => {
    if (!team || loading || error) return;

    // Poll for updates every 30 seconds when data is loaded successfully
    const pollInterval = setInterval(async () => {
      try {
        const carouselData = await fetchTeamRMVChartData(team);
        setData(carouselData);
      } catch (err) {
        console.error("[TeamRMVCarousel] Polling error:", err);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [team, loading, error]);

  if (loading && data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-0">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 px-2">
          Team RMV Rankings
        </h2>
        <div className="h-[180px] flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-400">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-0">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 px-2">
          Team RMV Rankings
        </h2>
        <div className="h-[180px] flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-400">{error}</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-0">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4 px-2">
          Team RMV Rankings
        </h2>
        <div className="h-[180px] flex items-center justify-center">
          <span className="text-slate-600 dark:text-slate-400">
            Collect {team} relics to be the first on the rankings
          </span>
        </div>
      </div>
    );
  }

  // Calculate team max rmv and staked rmv values for the bar visualization
  const teamMaxRmv = Math.max(0, ...data.map((r) => r.rmv || 0));
  const teamStakedRmvValues = data
    .map((r) => r.staked_rmv || 0)
    .filter((v) => v > 0);

  return (
    <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 px-0">
      <div className="flex items-center justify-between m-1.5 px-2">
        <div className="text-lg font-semibold text-slate-800 dark:text-white">
          <p>RMV Rankings</p>
        </div>
        <button
          onClick={() => setShowComingSoonModal(true)}
          className="bg-[#004FFF] text-white font-semibold rounded-md py-1 px-2 text-[14px] sm:text-[16px] lg:text-[18px] hover:opacity-90 transition-opacity cursor-pointer"
        >
          <p>Stake to Earn</p>
        </button>
      </div>
      <div className="bg-white rounded-md px-0 py-2 overflow-x-auto">
        <MiniCarousel
          count={data.length}
          itemWidthClass="w-[120px]"
          itemContainerClass="flex h-[170px] max-lg:h-[170px] w-[120px] shrink-0 flex-col"
          itemFrameClass="relative w-full flex-1 rounded-md border border-slate-200 bg-white dark:bg-slate-800 overflow-hidden p-2 flex flex-col justify-between"
          itemHrefForIndex={(index) => {
            const item = data[index];
            return item ? `/collection/${item.username}` : undefined;
          }}
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
                    {item.username}
                  </div>
                </div>

                <div className="flex flex-col gap-1 items-center">
                  <img
                    src={`/images/${item.badge_image}`}
                    alt={item.rank_level}
                    className="h-10 w-10 object-contain"
                  />
                </div>

                <div className="w-full">
                  <StakedHeldBar
                    rmv={item.rmv || 0}
                    stakedRmv={item.staked_rmv || 0}
                    teamMaxRmv={teamMaxRmv}
                    teamStakedRmvValues={teamStakedRmvValues}
                  />
                </div>
              </div>
            );
          }}
          containerPaddingClass="px-0"
          gapClass="gap-[2px]"
        />
      </div>

      {/* Coming Soon Modal */}
      {showComingSoonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-lg p-6 max-w-sm w-11/12 shadow-lg">
            <h3 className="text-xl font-semibold text-slate-800 dark:text-white mb-4">
              Coming Soon
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              This feature will be available very soon. Stay tuned!
            </p>
            <button
              onClick={() => setShowComingSoonModal(false)}
              className="w-full bg-[#004FFF] text-white font-semibold rounded-md py-2 px-4 hover:opacity-90 transition-opacity"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
