import { getTeamCrest } from "@/lib/teams";
import type { NewBidEvent } from "@/hooks/useNewBidEvents";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel";

interface BidHistoryCardProps {
  bids: NewBidEvent[];
}

export default function BidHistoryCard({ bids }: BidHistoryCardProps) {
  console.log("[BidHistoryCard] Received bids:", bids);

  if (!bids || bids.length === 0) {
    console.log("[BidHistoryCard] No bids, returning null");
    return null;
  }

  // If 4 or fewer bids, center them; if 5+, fit 5 per screen
  const shouldCenter = bids.length < 4;
  const itemSizeClass = shouldCenter ? "basis-full sm:basis-auto" : "basis-1/5";

  return (
    <>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
        Bid History
      </h3>
      <Carousel
        className="w-auto sm:w-full self-center sm:self-auto"
        opts={{
          align: shouldCenter ? "center" : "start",
        }}
      >
        <CarouselContent className={shouldCenter ? "-ml-0" : "-ml-2 sm:-ml-4"}>
          {bids.map((bid, index) => {
            const teamCrestUrl = bid.favoriteTeam
              ? getTeamCrest(bid.favoriteTeam)
              : null;
            const bidAmount = (Number(BigInt(bid.bid_amount)) / 1e18).toFixed(
              2,
            );

            return (
              <CarouselItem
                key={index}
                className={`basis-auto pl-1 sm:pl-2 flex justify-center ${shouldCenter ? "sm:basis-auto" : "sm:basis-1/5"}`}
              >
                <div className="flex flex-col items-center gap-1 sm:gap-2 w-auto sm:w-[50px]">
                  <div className="w-[25px] h-[25px] rounded bg-slate-300 dark:bg-slate-600 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img
                      src={teamCrestUrl || "/images/teams/wfl_crest.png"}
                      alt={bid.favoriteTeam || "World Futbol League"}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <p className="text-[8px] sm:text-[10px] text-slate-600 dark:text-slate-400 text-center truncate max-w-[45px] sm:max-w-[60px]">
                    {bid.username || "Unknown"}
                  </p>
                  <p className="text-[9px] sm:text-xs font-semibold text-slate-900 dark:text-white text-center">
                    ${bidAmount}
                  </p>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        {bids.length > 4 && (
          <>
            <CarouselPrevious className="hidden sm:flex -left-8" />
            <CarouselNext className="hidden sm:flex -right-8" />
          </>
        )}
      </Carousel>
    </>
  );
}
