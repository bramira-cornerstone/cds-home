import { useState, useEffect, useRef, useMemo } from "react";
import { RedemptionModal } from "./RedemptionModal";
import EditionSplineScene from "./EditionSplineScene";
import { RewardStructureTable } from "./RewardStructureTable";
import { RedemptionRewardStructureTable } from "./RedemptionRewardStructureTable";
import { useRedemptionPosition } from "@/hooks/useRedemptionPosition";
import { useRedemptionCountdown } from "@/hooks/useRedemptionCountdown";
import {
  getRedemptionLeaderboard,
  type AggregatedRedemptionLeaderboard,
} from "@/lib/supabaseRedemptionEvents";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

interface RedemptionsCardProps {
  team?: string | null;
  editionId?: number | null;
  minted?: number | null;
  airdropWindow?: {
    id: number;
    team_airdrop: string;
    airdrops_close: string;
    drop_week?: string;
  } | null;
  countdown?: {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null;
  fanFavoriteMintedData?: any | null;
}

export function RedemptionsCard({
  team,
  editionId,
  minted,
  airdropWindow,
  countdown,
  fanFavoriteMintedData,
}: RedemptionsCardProps) {
  const teamName = team || "relics";
  const [isRedemptionModalOpen, setIsRedemptionModalOpen] = useState(false);
  const [leaderboardRefreshTrigger, setLeaderboardRefreshTrigger] = useState(0);
  const { position, loading: positionLoading } =
    useRedemptionPosition(editionId);
  const { days, hours, minutes, seconds, isExpired, deadline, isComingSoon } =
    useRedemptionCountdown(editionId ?? null);
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  const formatDeadlineDate = (date: Date | null): string => {
    if (!date) return "";
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    };
    return date.toLocaleDateString("en-US", options);
  };

  const formatRedemptionDate = (timestamp: string | null): string => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const [leaderboardData, setLeaderboardData] = useState<
    AggregatedRedemptionLeaderboard[]
  >([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const ROWS_PER_PAGE = 5;
  const totalPages = Math.ceil(leaderboardData.length / ROWS_PER_PAGE);
  const paginatedData = leaderboardData.slice(
    currentPage * ROWS_PER_PAGE,
    (currentPage + 1) * ROWS_PER_PAGE,
  );

  const activeListingsCount = useMemo(() => {
    if (!editionId) return 0;
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
  }, [editionId, activeListings, activeAuctions]);

  useEffect(() => {
    if (!editionId) {
      setStakedCount(0);
      return;
    }

    const fetchStakedCount = async () => {
      try {
        const count = await countStakedTokensByEditionId(editionId);
        setStakedCount(count ?? 0);
      } catch (error) {
        setStakedCount(0);
      }
    };

    fetchStakedCount();
  }, [editionId]);

  useEffect(() => {
    if (!editionId) {
      setInPacksCount(0);
      return;
    }

    const fetchInPacksCount = async () => {
      try {
        const count = await countInPackTokensByEditionId(editionId);
        setInPacksCount(count ?? 0);
      } catch (error) {
        setInPacksCount(0);
      }
    };

    fetchInPacksCount();
  }, [editionId]);

  useEffect(() => {
    if (!editionId) {
      setRedeemedCount(0);
      return;
    }

    const fetchRedeemedCount = async () => {
      try {
        const count = await countRedeemedTokensByEditionId(editionId);
        setRedeemedCount(count ?? 0);
      } catch (error) {
        setRedeemedCount(0);
      }
    };

    fetchRedeemedCount();
  }, [editionId]);

  useEffect(() => {
    if (!editionId) {
      setLeaderboardData([]);
      setLeaderboardLoading(false);
      setCurrentPage(0);
      return;
    }

    const fetchLeaderboard = async () => {
      setLeaderboardLoading(true);
      setCurrentPage(0);
      try {
        const data = await getRedemptionLeaderboard(editionId);
        setLeaderboardData(data);
      } catch (err) {
        setLeaderboardData([]);
      } finally {
        setLeaderboardLoading(false);
      }
    };

    fetchLeaderboard();
  }, [editionId, leaderboardRefreshTrigger]);

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    // Swipe left (next page)
    if (diff > 50 && currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
    // Swipe right (prev page)
    else if (diff < -50 && currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }

    setTouchStart(null);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 card-shadow dark:bg-slate-900 dark:border-slate-700 redemptions-card-mobile m-0.5 flex flex-col">
      {/* Title */}
      <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2 text-center">
        Stake your {teamName} relics. Earn team rewards for free.
      </h2>

      {/* Airdrop/Redemption Window Info */}
      <div className="mt-6 text-center w-full">
        <p className="text-slate-600 text-sm mb-0">
          Free 'Fan Favorite' relic for top 50 ranked users on:
        </p>
        <p />
        {airdropWindow ? (
          <div>
            <p className="text-slate-600 text-sm">
              {
                new Date(airdropWindow.airdrops_close)
                  .toISOString()
                  .split("T")[0]
              }{" "}
              5pm EST
            </p>
            {countdown && (
              <p
                style={{
                  color: "rgba(255, 99, 0, 1)",
                  fontSize: "40px",
                  lineHeight: "40px",
                  marginTop: "8px",
                  textShadow: "2px 2px 5px rgba(155, 155, 155, 1)",
                }}
              >
                {countdown.days}d {countdown.hours}h {countdown.minutes}m{" "}
                {countdown.seconds}s
              </p>
            )}
          </div>
        ) : (
          <div>
            {/* Handle redemption deadline from hook (on /redeem/Redeem{id} pages) */}
            {isComingSoon ? (
              <p
                style={{
                  color: "rgba(255, 99, 0, 1)",
                  fontSize: "40px",
                  lineHeight: "40px",
                  textShadow: "2px 2px 5px rgba(155, 155, 155, 1)",
                }}
              >
                Announcing Soon
              </p>
            ) : deadline ? (
              <div>
                <p className="text-slate-600 text-sm">
                  {formatDeadlineDate(deadline)} at 5pm EST
                </p>
                <p
                  style={{
                    color: "rgba(255, 99, 0, 1)",
                    fontSize: "40px",
                    lineHeight: "40px",
                    marginTop: "8px",
                    textShadow: "2px 2px 5px rgba(155, 155, 155, 1)",
                  }}
                >
                  {days}d {hours}h {minutes}m {seconds}s
                </p>
              </div>
            ) : (
              <p
                style={{
                  color: "rgba(255, 99, 0, 1)",
                  fontSize: "40px",
                  lineHeight: "40px",
                  textShadow: "2px 2px 5px rgba(155, 155, 155, 1)",
                }}
              >
                Announcing Soon
              </p>
            )}
          </div>
        )}
      </div>

      {/* Edition Scene */}
      {fanFavoriteMintedData && (
        <div className="flex justify-center" style={{ marginTop: "6px" }}>
          <div className="w-full h-96">
            <EditionSplineScene
              edition_id={fanFavoriteMintedData.edition_id ?? null}
              overlayUrl={
                fanFavoriteMintedData?.video_location
                  ? `https://stream.mux.com/${String(fanFavoriteMintedData.video_location).trim()}.m3u8`
                  : undefined
              }
              minted={fanFavoriteMintedData.Minted ?? null}
              playerName={fanFavoriteMintedData.PlayerName ?? null}
              seriesName={fanFavoriteMintedData.SeriesName ?? null}
              tierValue={fanFavoriteMintedData.TierValue ?? null}
              productName={fanFavoriteMintedData.ProductName ?? null}
              playDescription={fanFavoriteMintedData.PlayDescription ?? null}
              setName={fanFavoriteMintedData.SetName ?? null}
              finalScore={fanFavoriteMintedData.FinalScore ?? null}
              gameDate={fanFavoriteMintedData.GameDate ?? null}
              statValue1={fanFavoriteMintedData.PlayerStatValue1 ?? null}
              statValue2={fanFavoriteMintedData.PlayerStatValue2 ?? null}
              statValue3={fanFavoriteMintedData.PlayerStatValue3 ?? null}
              statValue4={fanFavoriteMintedData.PlayerStatValue4 ?? null}
              statValue5={fanFavoriteMintedData.PlayerStatValue5 ?? null}
              statName1={fanFavoriteMintedData.PlayerStat1 ?? null}
              statName2={fanFavoriteMintedData.PlayerStat2 ?? null}
              statName3={fanFavoriteMintedData.PlayerStat3 ?? null}
              statName4={fanFavoriteMintedData.PlayerStat4 ?? null}
              statName5={fanFavoriteMintedData.PlayerStat5 ?? null}
              badge1={fanFavoriteMintedData.Badge1 ?? null}
              badge2={fanFavoriteMintedData.Badge2 ?? null}
              badge3={fanFavoriteMintedData.Badge3 ?? null}
              team={fanFavoriteMintedData.team ?? null}
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

      {/* Subtitle */}
      <div
        className="text-sm text-slate-700 dark:text-slate-300 font-medium text-center"
        style={{ margin: "24px 0 4px" }}
      >
        <p>
          The highest leaderboard ranks at the snapshot earn the lowest serials
          for rewards
        </p>
      </div>

      {/* Description */}
      <div className="text-xs text-slate-600 dark:text-slate-400 mb-0.5 text-center">
        <p>Ranked by rolling median value of relics staked</p>
        <p>Ties broken by earliest submitted</p>
      </div>

      {/* Reward Structure Table - Separate implementations for each page type */}
      {airdropWindow ? (
        <RewardStructureTable />
      ) : (
        <RedemptionRewardStructureTable minted={minted} />
      )}

      {/* Join Redemption Button */}
      {!isComingSoon && editionId && (
        <div className="mb-6 max-sm:mb-3">
          <button
            onClick={() => setIsRedemptionModalOpen(true)}
            className="w-full px-4 py-2 text-white font-medium rounded-lg transition-colors"
            style={{ backgroundColor: "rgba(0, 79, 255, 1)" }}
          >
            Join Redemption Leaderboard
          </button>
        </div>
      )}

      {/* Position Display - Above Leaderboard Section */}
      {position !== null && !positionLoading && (
        <p
          style={{
            color: "rgba(255, 99, 0, 1)",
            fontSize: "14px",
            fontWeight: "500",
            lineHeight: "20px",
            margin: "0 auto 12px",
          }}
          className="bg-white max-sm:bg-orange-600/25"
        >
          <span style={{ fontSize: "18px", display: "inline" }}>
            Your current position is #
          </span>
          <span
            style={{ display: "inline", fontWeight: "500", fontSize: "18px" }}
          >
            {position}
          </span>
        </p>
      )}

      {/* Leaderboard Section */}
      {!isComingSoon && editionId && (
        <div className="mb-6 max-sm:mb-3 flex flex-col">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-0.5 mx-auto">
            Redemption Leaderboard
          </h3>

          {leaderboardLoading ? (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center text-slate-600 dark:text-slate-400">
              Loading leaderboard...
            </div>
          ) : leaderboardData.length === 0 ? (
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center text-slate-600 dark:text-slate-400">
              Be the first to redeem
            </div>
          ) : (
            <div
              className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden"
              ref={tableContainerRef}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">
                      Rank
                    </th>
                    <th className="px-4 py-2 text-left text-slate-700 dark:text-slate-300 font-semibold">
                      User
                    </th>
                    <th className="px-4 py-2 text-right text-slate-700 dark:text-slate-300 font-semibold">
                      Total RMV
                    </th>
                    <th className="px-4 py-2 text-right text-slate-700 dark:text-slate-300 font-semibold">
                      <p>Updated</p>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {paginatedData.map((entry, idx) => (
                    <tr
                      key={`${entry.edition_id_reward}-${entry.username}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <td className="px-4 py-2 text-slate-700 dark:text-slate-300 font-medium">
                        #{currentPage * ROWS_PER_PAGE + idx + 1}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400 truncate">
                        {entry.username}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-right">
                        {entry.total_rmv_redeemed?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-4 py-2 text-slate-600 dark:text-slate-400 text-right">
                        {formatRedemptionDate(entry.last_redeemed_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 0}
                    className="p-1 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-slate-900 dark:hover:text-white"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Page {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages - 1}
                    className="p-1 text-slate-600 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed hover:text-slate-900 dark:hover:text-white"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Redemption Modal */}
      <RedemptionModal
        isOpen={isRedemptionModalOpen}
        onClose={() => setIsRedemptionModalOpen(false)}
        onRedemptionSuccess={() =>
          setLeaderboardRefreshTrigger((prev) => prev + 1)
        }
        team={team}
        editionId={editionId}
      />
    </div>
  );
}
