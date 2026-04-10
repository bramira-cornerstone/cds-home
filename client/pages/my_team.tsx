import { useEffect, useState } from "react";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import TeamEventsChart from "@/components/TeamEventsChart";
import TeamRMVCarousel from "@/components/TeamRMVCarousel";
import DropWeekCalendar from "@/components/DropWeekCalendar";
import ClubhouseChat from "@/components/ClubhouseChat";
import { getTeamCrest, getAllTeams } from "@/lib/teams";

import { toast } from "sonner";
import { getFavoriteTeam, updateFavoriteTeam } from "@/lib/favoriteTeamService";

export default function MyTeamPage() {
  const betaAllowlist = useBetaAllowlist();
  const account = useActiveAccount();
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadFavoriteTeam = async () => {
      if (!account?.address) {
        setFavoriteTeam(null);
        setLoading(false);
        return;
      }

      try {
        const team = await getFavoriteTeam(account.address);
        setFavoriteTeam(team);
      } catch (err) {
        console.debug("[MyTeamPage] Error loading favorite team:", err);
        setFavoriteTeam(null);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteTeam();
  }, [account?.address]);

  if (betaAllowlist !== true) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
          Log In above to connect with other fans of your favorite team.
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white dark:bg-slate-900 text-black dark:text-white p-6 text-center text-base">
          Loading...
        </div>
      </section>
    );
  }

  const teamCrestUrl = favoriteTeam ? getTeamCrest(favoriteTeam) : null;

  const handleSelectTeam = async (teamName: string) => {
    if (!account?.address) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = await updateFavoriteTeam(account.address, teamName);

      if (!result.success) {
        throw new Error(result.error || "Failed to update favorite team");
      }

      toast({
        title: "Success",
        description: `${teamName} set as your favorite team`,
      });

      // Refresh the favorite team state
      const team = await getFavoriteTeam(account.address);
      setFavoriteTeam(team);
    } catch (err) {
      console.error("Error updating favorite team:", err);
      toast({
        title: "Error",
        description: "Failed to update favorite team",
        variant: "destructive",
      });
    }
  };

  return (
    <section className="container mx-auto px-4 py-6 nightmode_cards sm:pt-3">
      <div className="w-full mb-4">
        <img
          src="https://cdn.builder.io/api/v1/file/assets%2F1fc926a98c3145c69dfab54fa66e93f8%2F2d1795197965494086ce2478213e8cfd"
          alt="My Club banner"
          className="w-full h-auto object-cover rounded-md"
        />
      </div>
      <div className="max-w-7xl mx-auto flex flex-col gap-6 max-lg:gap-3">
        {favoriteTeam ? (
          <>
            <div className="flex items-center justify-center gap-4 max-sm:gap-0.5">
              {teamCrestUrl && (
                <img
                  src={teamCrestUrl}
                  alt={`${favoriteTeam} crest`}
                  className="h-16 w-16 object-contain max-sm:w-auto max-sm:flex-grow"
                />
              )}
              <h1 className="text-center uppercase font-sans max-sm:text-[30px] sm:text-[35px] lg:text-[40px] leading-none text-slate-800 dark:text-white">
                {`${favoriteTeam} Fan Clubhouse`}
              </h1>
            </div>
            <TeamRMVCarousel team={favoriteTeam} />
            {/* Calendar - visible on mobile/tablet only */}
            <div className="lg:hidden">
              <DropWeekCalendar />
            </div>
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <ClubhouseChat team={favoriteTeam} title="Fan Chat" />
              </div>
              <div className="flex-1">
                {/* Calendar - visible on desktop only */}
                <div className="hidden lg:block mb-4">
                  <DropWeekCalendar />
                </div>
                <TeamEventsChart />
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-center uppercase font-sans max-sm:text-[30px] sm:text-[35px] lg:text-[40px] leading-none text-slate-800 dark:text-white">
              Choose a favorite team
            </h1>
            <div className="flex flex-wrap gap-4 justify-center">
              {getAllTeams().map((team) => {
                const crestUrl = getTeamCrest(team.team_name);
                return (
                  <button
                    key={team.team_name}
                    onClick={() => handleSelectTeam(team.team_name)}
                    className="hover:opacity-80 transition-opacity"
                    title={team.team_name}
                  >
                    {crestUrl && (
                      <img
                        src={crestUrl}
                        alt={`${team.team_name} crest`}
                        className="h-10 w-10 object-contain"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
