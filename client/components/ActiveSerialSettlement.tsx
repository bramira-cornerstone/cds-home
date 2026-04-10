import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { checkAuctionClosed } from "@/lib/marketplaceEvents";
import { isAuctionExpired } from "@/lib/activeAuctionsFromEvents";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";

interface ActiveSerialSettlementProps {
  auction: ActiveAuction | null;
  currentHighBid: string | null;
  className?: string;
}

export default function ActiveSerialSettlement({
  auction,
  currentHighBid,
  className = "",
}: ActiveSerialSettlementProps) {
  const navigate = useNavigate();
  const [isSettlementNeeded, setIsSettlementNeeded] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  useEffect(() => {
    if (!auction) {
      setIsSettlementNeeded(false);
      setIsClosed(false);
      return;
    }

    let cancelled = false;

    const checkSettlement = async () => {
      const expired = isAuctionExpired(auction);
      const closed = await checkAuctionClosed(auction.auctionId);

      if (!cancelled) {
        setIsClosed(closed);
        setIsSettlementNeeded(expired && !closed);
      }
    };

    checkSettlement();

    return () => {
      cancelled = true;
    };
  }, [auction]);

  if (!auction || !isSettlementNeeded) {
    return null;
  }

  const displayBid = currentHighBid || auction.minimumBidAmount || "0";
  const bidInTokens = Number(BigInt(displayBid)) / 1e18;

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white dark:bg-slate-700 dark:border-white/10 dark:text-white ${className}`}
    >
      <div className="px-3 py-2 grid grid-cols-2 gap-3 items-center">
        <div className="flex-1">
          <div className="mb-2">
            <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              Winning Bid
            </div>
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              ${bidInTokens.toFixed(2)}
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => navigate(`/settle-auction/${auction.auctionId}`)}
            className="px-2 py-1 rounded bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            Settle Auction
          </button>
        </div>
      </div>
    </div>
  );
}
