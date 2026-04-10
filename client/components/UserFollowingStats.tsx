import { useEffect, useState } from "react";
import MiniCarousel from "@/components/MiniCarousel";
import {
  fetchFollowees,
  getTeamCrestPath,
  type Followee,
} from "@/lib/followeesService";

interface UserFollowingStatsProps {
  followerAddress?: string;
}

export function UserFollowingStats({
  followerAddress,
}: UserFollowingStatsProps) {
  const [followees, setFollowees] = useState<Followee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (!followerAddress) {
      setIsLoading(false);
      return;
    }

    const loadFollowees = async () => {
      setIsLoading(true);
      try {
        const data = await fetchFollowees(followerAddress);
        setFollowees(data);
      } catch (error) {
        setFollowees([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadFollowees();
  }, [followerAddress]);

  if (isLoading || followees.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div
        className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow"
        style={{
          boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
          padding: "4px 12px 8px",
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left hover:opacity-75 transition-opacity"
          style={{ marginBottom: "2px" }}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Following
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{isExpanded ? "⌃" : "⌄"}</span>
            <p className="text-4xl font-bold text-slate-800 dark:text-white">
              {followees.length}
            </p>
          </div>
        </button>
        {isExpanded && followees.length > 0 && (
          <div className="h-auto flex-grow-0 sm:flex-1 sm:min-h-0">
            <MiniCarousel
              count={followees.length}
              itemWidthClass="w-[95px] md:w-[119px]"
              itemContainerClass="flex h-full shrink-0 flex-col self-stretch w-[95px] md:w-[119px]"
              itemFrameClass="relative w-full flex-1 rounded-md border border-slate-200 bg-slate-100 shadow-inner overflow-hidden max-sm:min-h-[94px] max-sm:max-h-[200px]"
              containerPaddingClass="px-0"
              gapClass="gap-0"
              imageClass="h-auto"
              renderItemForIndex={(index) => {
                const followee = followees[index];
                if (!followee) return null;
                return (
                  <div className="h-full w-full flex flex-col items-center justify-center p-2 bg-white rounded-md border border-slate-200">
                    {/* Username */}
                    <h4 className="text-xs font-semibold text-slate-900 text-center line-clamp-2 mb-1">
                      {followee.username}
                    </h4>

                    {/* Team Crest */}
                    <div className="flex-1 flex items-center justify-center mb-1">
                      <img
                        src={getTeamCrestPath(followee.favoriteTeam)}
                        alt={followee.favoriteTeam || "World Futbol League"}
                        className="h-8 w-8 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src =
                            "/images/teams/wfl_crest.png";
                        }}
                      />
                    </div>

                    {/* RMV Held */}
                    <p className="text-[9px] text-slate-600 text-center">
                      {followee.rmvHeld ?? ""} RMV held
                    </p>
                  </div>
                );
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
