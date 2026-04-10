import { useEffect, useState } from "react";
import { fetchFollowees, type Followee } from "@/lib/followeesService";
import { getTeamCrest } from "@/lib/teams";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";
import { getFavoriteTeam } from "@/lib/favoriteTeamService";
import {
  fetchTeamRMVChartData,
  type TeamRMVChartRecord,
} from "@/lib/teamRmvChartData";


interface FolloweeCarouselCardProps {
  followerAddress?: string;
}

export default function FolloweeCarouselCard({
  followerAddress,
}: FolloweeCarouselCardProps) {
  const account = useActiveAccount();
  const [teamMembers, setTeamMembers] = useState<TeamRMVChartRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);

  const currentMember = teamMembers[currentIndex];

  // Load team members
  useEffect(() => {
    const loadTeamMembers = async () => {
      setIsLoading(true);
      try {
        if (!account?.address) {
          console.log("[FolloweeCarouselCard] No account address");
          setFavoriteTeam(null);
          setTeamMembers([]);
          return;
        }

        console.log("[FolloweeCarouselCard] Fetching favorite team for", account.address);
        const team = await getFavoriteTeam(account.address);
        console.log("[FolloweeCarouselCard] Favorite team:", team);
        setFavoriteTeam(team);

        if (!team) {
          console.log("[FolloweeCarouselCard] No favorite team found");
          setTeamMembers([]);
          return;
        }

        console.log("[FolloweeCarouselCard] Fetching team RMV data for", team);
        const allTeamData = await fetchTeamRMVChartData(team);
        console.log("[FolloweeCarouselCard] Team data loaded:", allTeamData.length, "members");
        // Take only the top 10
        setTeamMembers(allTeamData.slice(0, 10));
      } catch (error) {
        console.error("[FolloweeCarouselCard] Error loading team members:", error);
        setFavoriteTeam(null);
        setTeamMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamMembers();
  }, [account?.address]);

  // Cycle through team members every 5 seconds
  useEffect(() => {
    if (!teamMembers || teamMembers.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % teamMembers.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [teamMembers]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!teamMembers || teamMembers.length === 0) {
    // If a team is selected, show "Collect relics" message with team crest
    if (favoriteTeam) {
      const crestUrl = getTeamCrest(favoriteTeam);
      return (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center flex flex-col items-center justify-center gap-0.5 h-auto self-stretch">
            <p className="text-xs text-slate-600 px-2">
              Collect {favoriteTeam} relics to show your ranking to all their fans
            </p>
            {crestUrl && (
              <img
                src={crestUrl}
                alt={`${favoriteTeam} crest`}
                className="object-contain"
                style={{ height: "60px", width: "60px" }}
              />
            )}
          </div>
        </div>
      );
    }

    // If no team is selected, show the original message
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-slate-600">
            Set a favorite team on the My Team page
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ gap: "2px", padding: "2px" }}
    >
      {/* Rank */}
      <div className="text-center min-h-[1.5rem] flex items-center w-full px-1 min-w-0 mt-2">
        <h3 className="text-sm font-semibold text-slate-800 mx-auto">
          #<span style={{ fontSize: "18px" }}>{currentMember?.team_rank}</span>
        </h3>
      </div>

      {/* Username */}
      <div className="text-center mb-1 min-h-[1rem] flex items-center w-full px-1 min-w-0">
        <div className="text-[11px] font-medium text-slate-600 truncate w-full">
          {currentMember?.username}
        </div>
      </div>

      {/* Badge */}
      <div className="flex-1 flex items-center justify-center mb-1 min-h-0">
        <img
          key={`badge-${currentIndex}`}
          src={`/images/${currentMember?.badge_image}`}
          alt={currentMember?.rank_level}
          className="h-[50px] w-[50px] object-contain transition-all duration-300"
        />
      </div>

      {/* RMV Held */}
      {currentMember?.rmv ? (
        <div className="text-center mb-2">
          <p className="text-[9px] text-slate-600">
            <span style={{ fontWeight: "700" }}>
              {currentMember.rmv.toFixed(0)}
            </span>{" "}
            RMV held
          </p>
        </div>
      ) : null}
    </div>
  );
}
