import { useState, useEffect } from "react";
import { fetchFollowees, type Followee } from "@/lib/followeesService";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";

interface FolloweesListProps {
  walletAddress: string | null | undefined;
  onFolloweeSelect?: (followee: Followee) => void;
}

export function FolloweesList({
  walletAddress,
  onFolloweeSelect,
}: FolloweesListProps) {
  const [followees, setFollowees] = useState<Followee[]>([]);
  const [loading, setLoading] = useState(true);
  const [rmvData, setRmvData] = useState<RMVPerOwnerRecord[]>([]);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        if (!walletAddress) {
          setFollowees([]);
          return;
        }
        const fetchedFollowees = await fetchFollowees(walletAddress);
        const rmvRecords = await fetchRMVPerOwner();
        if (!ctrl.signal.aborted) {
          setFollowees(fetchedFollowees);
          setRmvData(rmvRecords);
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("Error loading followees:", err);
        }
        if (!ctrl.signal.aborted) {
          setFollowees([]);
          setRmvData([]);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => ctrl.abort();
  }, [walletAddress]);

  if (loading) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400 p-2">
        Loading followees...
      </div>
    );
  }

  if (followees.length === 0) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400 p-2">
        You are not following anyone yet.
      </div>
    );
  }

  const getRankBadgeImage = (rankLevel: string): string | null => {
    switch (rankLevel) {
      case "Diamond":
        return "/images/diamondbadge.png";
      case "Epic":
        return "/images/epicbadge.png";
      case "Rare":
        return "/images/rarebadge.png";
      case "Basic":
        return "/images/basicbadge.png";
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0 overflow-x-auto overflow-y-auto followees-list-container">
        {followees.map((followee) => {
          const rmvRecord = findRMVByOwner(rmvData, followee.followeeAddress);
          const rankLevel = calculateRankLevel(rmvRecord?.Percentile);
          const rankBadgeImage = getRankBadgeImage(rankLevel);

          return (
            <div
              key={followee.followeeAddress}
              onClick={() => onFolloweeSelect?.(followee)}
              className="flex items-center transition-colors cursor-pointer hover:bg-white/40 dark:hover:bg-slate-700/50 px-1 sm:px-2"
              style={{
                gap: "1px",
              }}
            >
              <div className="flex items-center justify-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap text-[9px] flex-shrink-0">
                <span className="truncate">
                  {followee.username ||
                    followee.followeeAddress.slice(0, 8) + "..."}
                </span>
              </div>
              {rankBadgeImage && (
                <img
                  src={rankBadgeImage}
                  alt={`${rankLevel} rank badge`}
                  className="w-6 h-6 flex-shrink-0 rounded object-contain"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
