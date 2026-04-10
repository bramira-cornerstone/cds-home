import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllTeams, type Team } from "@/lib/teams";
import { updateFavoriteTeam } from "@/lib/favoriteTeamService";
import { useToast } from "@/components/ui/use-toast";

interface TeamSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  walletAddress: string | null | undefined;
  onTeamSelected?: (team: Team) => void;
}

export function TeamSelectionModal({
  open,
  onOpenChange,
  walletAddress,
  onTeamSelected,
}: TeamSelectionModalProps) {
  const { toast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);
  const teams = getAllTeams().sort((a, b) =>
    a.team_name.localeCompare(b.team_name),
  );

  const handleTeamSelect = async (team: Team) => {
    if (!walletAddress) {
      toast({
        title: "Error",
        description: "Wallet address not found",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);
    try {
      const result = await updateFavoriteTeam(walletAddress, team.team_name);

      if (result.success) {
        toast({
          title: "Success",
          description: `Favorite team set to ${team.team_name}`,
        });
        onTeamSelected?.(team);
        onOpenChange(false);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update favorite team",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error selecting team:", error);
      toast({
        title: "Error",
        description: "Failed to update favorite team",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Select Your Favorite Team</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-4">
          {teams.map((team) => (
            <button
              key={team.team_name}
              onClick={() => handleTeamSelect(team)}
              disabled={isUpdating}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <img
                src={team.crest_image}
                alt={team.team_name}
                className="w-12 h-12 object-contain"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center line-clamp-2">
                {team.team_name}
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
