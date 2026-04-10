import { useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { EditionCardMiniWithData } from "@/components/EditionCardMiniWithData";
import { useWinningBid } from "@/hooks/useWinningBid";
import type { ActiveOffer } from "@/lib/activeOffers";
import type { ActiveListing } from "@/lib/activeListings";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";

interface AuctionSummaryData {
  type: "auction";
  minimumBid: number;
  buyoutPrice: number;
  endTime: string;
  currentHighBid: number | null;
}

interface DirectListingSummaryData {
  type: "direct";
  listingPrice: number;
  lowAskPrice: number | null;
  topOffers: ActiveOffer[];
}

type SummaryData = AuctionSummaryData | DirectListingSummaryData;

interface CardWithListingDetailsProps {
  editionId: number | null;
  listing: ActiveListing | ActiveAuction;
  offersForToken?: ActiveOffer[];
  allListingsForEdition?: ActiveListing[];
}

export function CardWithListingDetails({
  editionId,
  listing,
  offersForToken = [],
  allListingsForEdition = [],
}: CardWithListingDetailsProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (editionId && listing.serial !== null) {
      navigate(`/edition/${editionId}/serial/${listing.serial}`);
    }
  };

  const isAuction = useMemo(() => {
    return "auctionId" in listing;
  }, [listing]);

  const auctionId = useMemo(() => {
    return isAuction ? (listing as ActiveAuction).auctionId : null;
  }, [isAuction, listing]);

  const { data: winningBid } = useWinningBid(auctionId);

  const summaryData = useMemo<SummaryData>(() => {
    if (isAuction) {
      // For auctions, show minimum bid and buyout price
      const auction = listing as ActiveAuction;
      const minimumBid = Number(auction.minimumBidAmount) / 1e18;
      const buyoutPrice = Number(auction.buyoutBidAmount) / 1e18;
      const endTime = new Date(
        auction.endTimestamp * 1000,
      ).toLocaleDateString();

      return {
        type: "auction",
        minimumBid,
        buyoutPrice,
        endTime,
        currentHighBid: winningBid ?? null,
      };
    } else {
      // For direct listings, show price and low ask
      const directListing = listing as ActiveListing;
      const listingPrice = Number(directListing.pricePerToken) / 1e18;

      const lowAskPrice =
        allListingsForEdition.length > 0
          ? allListingsForEdition[0].low_ask
            ? Number(allListingsForEdition[0].low_ask) / 1e18
            : Number(allListingsForEdition[0].pricePerToken) / 1e18
          : null;

      const sortedOffers = [...offersForToken].sort((a, b) => {
        const priceA = BigInt(a.totalPrice);
        const priceB = BigInt(b.totalPrice);
        if (priceA !== priceB) {
          return priceB > priceA ? 1 : -1;
        }
        const idA = BigInt(a.offerId);
        const idB = BigInt(b.offerId);
        return idA > idB ? 1 : -1;
      });

      return {
        type: "direct",
        listingPrice,
        lowAskPrice,
        topOffers: sortedOffers.slice(0, 3),
      };
    }
  }, [listing, offersForToken, allListingsForEdition, isAuction, winningBid]);

  if (!editionId) return null;

  return (
    <div
      className="w-full h-full flex flex-col gap-1 cursor-pointer"
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <div className="flex-shrink-0">
        <EditionCardMiniWithData editionId={editionId} />
      </div>
      <div className="text-[9px] text-slate-600 dark:text-slate-400 flex-shrink-0">
        {summaryData.type === "auction" ? (
          <div className="text-center mb-0.5 leading-tight">
            <div className="font-semibold text-[8px]">
              {summaryData.currentHighBid !== null
                ? `High Bid: $${summaryData.currentHighBid.toFixed(2)}`
                : `Min Bid: $${summaryData.minimumBid.toFixed(2)}`}
            </div>
            <div className="font-semibold text-[8px]">
              Min Bid: ${summaryData.minimumBid.toFixed(2)}
            </div>
            <div className="font-semibold text-[8px] text-slate-500">
              Ends: {summaryData.endTime}
            </div>
          </div>
        ) : (
          <div className="text-center mb-0.5 leading-tight">
            <div className="font-semibold text-[8px]">
              Listing Price: ${summaryData.listingPrice.toFixed(2)}
            </div>
            <div className="font-semibold text-[8px]">
              {summaryData.lowAskPrice !== null
                ? `Low Ask: $${summaryData.lowAskPrice.toFixed(2)}`
                : "—"}
            </div>
          </div>
        )}
        {summaryData.type === "direct" && summaryData.topOffers.length > 0 && (
          <div className="text-center leading-tight">
            <div className="font-semibold text-[8px] mb-0.5">Offers:</div>
            {summaryData.topOffers.map((offer, idx) => (
              <div key={idx} className="text-[7px]">
                ${(Number(offer.totalPrice) / 1e18).toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
