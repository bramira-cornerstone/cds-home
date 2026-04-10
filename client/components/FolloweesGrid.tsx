import { useEffect, useState } from "react";
import {
  fetchFollowees,
  getTeamCrestPath,
  type Followee,
} from "@/lib/followeesService";

interface FolloweesGridProps {
  followerAddress?: string;
}

export default function FolloweesGrid({ followerAddress }: FolloweesGridProps) {
  const [followees, setFollowees] = useState<Followee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!followerAddress) {
      setIsLoading(false);
      return;
    }

    const loadFollowees = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFollowees(followerAddress);
        setFollowees(data);
      } catch (err) {
        console.error("Failed to load followees:", err);
        setError("Failed to load followees");
      } finally {
        setIsLoading(false);
      }
    };

    loadFollowees();
  }, [followerAddress]);

  if (isLoading) {
    return (
      <div className="text-center py-8 text-slate-600">
        Loading followees...
      </div>
    );
  }

  if (error) {
    return <div className="text-center py-8 text-red-600">{error}</div>;
  }

  if (followees.length === 0) {
    return (
      <div className="text-center py-8 text-slate-600">
        Not following anyone yet
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {followees.map((followee) => (
        <div
          key={followee.followeeAddress}
          className="bg-white rounded-lg border border-slate-200 p-4 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow"
        >
          {/* Username */}
          <h3 className="text-sm font-semibold text-slate-900 mb-2 line-clamp-2">
            {followee.username}
          </h3>

          {/* RMV Held */}
          <p className="text-xs text-slate-600 mb-3">
            {followee.rmvHeld ?? ""} RMV held
          </p>

          {/* Team Crest */}
          <div className="flex-1 flex items-center justify-center mb-3">
            <img
              src={getTeamCrestPath(followee.favoriteTeam)}
              alt={followee.favoriteTeam || "World Futbol League"}
              className="h-16 w-16 object-contain"
              onError={(e) => {
                // Fallback to WFL crest if team crest not found
                (e.target as HTMLImageElement).src =
                  "/images/teams/wfl_crest.png";
              }}
            />
          </div>

          {/* Optional: Favorite Team Name */}
          {followee.favoriteTeam && (
            <p className="text-xs text-slate-500 capitalize">
              {followee.favoriteTeam}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
