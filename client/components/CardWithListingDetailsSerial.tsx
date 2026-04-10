import { useNavigate } from "react-router-dom";
import { useMemo, useEffect, useState } from "react";
import CollectionSerialCard from "@/components/CollectionSerialCard";
import { fetchSerialData } from "@/lib/marketplaceEvents";
import { useWinningBid } from "@/hooks/useWinningBid";
import type { ActiveOffer } from "@/lib/activeOffers";
import type { ActiveListing } from "@/lib/activeListings";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import type { SerialData } from "@/lib/marketplaceEvents";

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

interface CardWithListingDetailsSerialProps {
  tokenId: string | number | null | undefined;
  listing: ActiveListing | ActiveAuction;
  offersForToken?: ActiveOffer[];
  allListingsForEdition?: ActiveListing[];
}

export function CardWithListingDetailsSerial({
  tokenId,
  listing,
  offersForToken = [],
  allListingsForEdition = [],
}: CardWithListingDetailsSerialProps) {
  const navigate = useNavigate();
  const [serialData, setSerialData] = useState<SerialData | null>(null);
  const [loading, setLoading] = useState(true);

  const handleClick = () => {
    if (serialData?.id && serialData?.serial != null) {
      navigate(`/edition/${serialData.id}/serial/${serialData.serial}`);
    }
  };

  const isAuction = useMemo(() => {
    return "auctionId" in listing;
  }, [listing]);

  const auctionId = useMemo(() => {
    return isAuction ? (listing as ActiveAuction).auctionId : null;
  }, [isAuction, listing]);

  const { data: winningBid } = useWinningBid(auctionId);

  useEffect(() => {
    const fetchData = async () => {
      if (!tokenId) {
        setLoading(false);
        return;
      }

      try {
        const tokenIdNum =
          typeof tokenId === "string" ? parseInt(tokenId, 10) : Number(tokenId);
        if (!Number.isFinite(tokenIdNum)) {
          setLoading(false);
          return;
        }

        const data = await fetchSerialData(tokenIdNum);
        setSerialData(data);
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tokenId]);

  const summaryData = useMemo<SummaryData>(() => {
    if (isAuction) {
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

  if (!serialData || loading) {
    return null;
  }

  return (
    <div
      className="w-full flex flex-col cursor-pointer"
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
      <div className="flex-1 min-h-0 w-full">
        <CollectionSerialCard
          id={serialData.id}
          name={serialData.name}
          thumb={serialData.thumb}
          tier={serialData.tier}
          serial={serialData.serial}
          minted={serialData.minted}
          gameDate={serialData.gameDate}
          createDate={serialData.createDate}
          setName={serialData.setName}
          badge={serialData.badge}
          badge2={serialData.badge2}
          badge3={serialData.badge3}
          team={serialData.team}
          disableBadgeTooltips={true}
          isUserMarketplaceStatsCarousel={true}
        />
      </div>
      <div className="text-[9px] text-slate-600 dark:text-slate-400 flex-shrink-0 pt-1 max-sm:h-[50px]">
        {summaryData.type === "auction" ? (
          <div className="text-center mb-0.5 leading-tight">
            <div
              className="font-semibold max-sm:mt-[6px]"
              style={{ fontSize: "12px", lineHeight: "12px" }}
            >
              {summaryData.currentHighBid !== null &&
              summaryData.currentHighBid > 0
                ? `High Bid: $${summaryData.currentHighBid.toFixed(2)}`
                : `Min Bid: $${summaryData.minimumBid.toFixed(2)}`}
            </div>
            <div
              className="font-semibold text-slate-500"
              style={{
                fontSize: "12px",
                lineHeight: "12px",
                paddingTop: "4px",
              }}
            >
              Ends: {summaryData.endTime}
            </div>
          </div>
        ) : (
          <div className="text-center mb-0.5 leading-tight">
            <div
              className="font-semibold max-sm:mt-[6px]"
              style={{ fontSize: "12px", lineHeight: "12px" }}
            >
              Listing: $
              <span className="font-semibold sm:font-semibold max-sm:font-normal">
                {summaryData.listingPrice.toFixed(2)}
              </span>
            </div>
          </div>
        )}
        {summaryData.type === "direct" && summaryData.topOffers.length > 0 && (
          <div className="text-center leading-tight">
            <div
              className="font-semibold mb-0.5 text-[8px] max-sm:text-[12px]"
              style={{ lineHeight: "10px" }}
            >
              Offers:
            </div>
            {summaryData.topOffers.map((offer, idx) => (
              <div
                key={idx}
                className="text-[7px] max-sm:text-[12px]"
                style={{ lineHeight: "9px" }}
              >
                ${(Number(offer.totalPrice) / 1e18).toFixed(2)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
