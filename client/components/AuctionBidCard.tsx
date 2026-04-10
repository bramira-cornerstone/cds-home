import { getTeamCrest } from "@/lib/teams";
import type { AuctionBid } from "@/hooks/useAuctionBids";

interface AuctionBidCardProps {
  bid: AuctionBid;
}

export default function AuctionBidCard({ bid }: AuctionBidCardProps) {
  const teamCrestUrl = bid.favoriteTeam
    ? getTeamCrest(bid.favoriteTeam)
    : null;

  return (
    <div className="flex flex-col items-center gap-[1px] sm:gap-2 w-[40px]">
      <div className="w-[25px] h-[25px] rounded bg-slate-300 dark:bg-slate-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
        {teamCrestUrl && (
          <img
            src={teamCrestUrl}
            alt={bid.favoriteTeam || "Team crest"}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      <p className="text-xs font-semibold text-slate-900 dark:text-white text-center">
        ${bid.bidAmount.toFixed(2)}
      </p>
      <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 text-center truncate max-w-[40px]">
        {bid.username || "Unknown"}
      </p>
    </div>
  );
}
