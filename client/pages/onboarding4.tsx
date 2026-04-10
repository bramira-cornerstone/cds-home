import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "@/hooks/use-toast";
import { useCookieConsent } from "@/contexts/CookieConsentContext";
import { getTeamCrest, getAllTeams } from "@/lib/teams";
import { getFavoriteTeam, updateFavoriteTeam } from "@/lib/favoriteTeamService";

export default function Onboarding4() {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { openCookieConsent } = useCookieConsent();
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
        console.debug("[Onboarding4] Error loading favorite team:", err);
        setFavoriteTeam(null);
      } finally {
        setLoading(false);
      }
    };

    loadFavoriteTeam();
  }, [account?.address]);

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

      // Navigate after 1 second delay
      setTimeout(() => {
        navigate("/box/0");
      }, 1000);
    } catch (err) {
      console.error("Error updating favorite team:", err);
      toast({
        title: "Error",
        description: "Failed to update favorite team",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-start min-h-screen bg-white px-4 my-6">
      <div className="flex flex-col items-center gap-3 max-w-2xl">
        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-black">
          Select Your Team
        </h1>

        {/* Subtitle */}
        <p className="text-center text-slate-600">
          Choose a favorite team to get started.
          <br />
          They're not real teams. Just pick one for fun in the alpha test to simulate being a fan of one when this uses real teams.
        </p>

        {/* Team Crests Grid */}
        <div className="flex flex-wrap gap-4 justify-center">
          {getAllTeams()
            .sort((a, b) => a.team_name.localeCompare(b.team_name))
            .map((team) => {
            const crestUrl = getTeamCrest(team.team_name);
            return (
              <button
                key={team.team_name}
                onClick={() => handleSelectTeam(team.team_name)}
                className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity p-3"
                style={{ boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)" }}
                title={team.team_name}
              >
                {crestUrl && (
                  <img
                    src={crestUrl}
                    alt={`${team.team_name} crest`}
                    className="h-20 w-20 object-contain"
                  />
                )}
                <span className="text-sm text-center text-slate-700 dark:text-slate-300">
                  {team.team_name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Skip Button */}
        <button
          onClick={() => {
            navigate("/box/0");
            openCookieConsent();
          }}
          className="w-full text-white font-medium rounded transition-colors max-w-md mt-8"
          style={{
            backgroundColor: "rgba(0, 79, 255, 1)",
            padding: "12px 16px",
            lineHeight: "20px",
            fontSize: "16px",
          }}
        >
          <p>Move on without a favorite team</p>
        </button>
      </div>
    </div>
  );
}
