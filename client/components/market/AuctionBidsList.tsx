import React from "react";
import { useAuctionBids } from "@/hooks/useAuctionBids";

export default function AuctionBidsList({
  auctionId,
  className = "",
}: {
  auctionId: string | number | null;
  className?: string;
}) {
  const { data: bids, isLoading } = useAuctionBids(auctionId);

  // Don't render if no bids or loading
  if (isLoading || !bids || bids.length === 0) {
    return null;
  }

  return (
    <div className={`w-full ${className}`}>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Recent Bids
      </h3>
      <div className="space-y-2">
        {bids.map((bid, index) => (
          <div
            key={`${bid.walletAddress}-${index}`}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700"
          >
            {/* Square placeholder avatar */}
            <div className="w-10 h-10 rounded bg-gradient-to-br from-blue-400 to-purple-500 flex-shrink-0 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {bid.username?.charAt(0)?.toUpperCase() ||
                  bid.walletAddress.slice(2, 4).toUpperCase()}
              </span>
            </div>

            {/* Username and bid amount */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {bid.username || `${bid.walletAddress.slice(0, 6)}...${bid.walletAddress.slice(-4)}`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ${bid.bidAmount.toFixed(2)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
