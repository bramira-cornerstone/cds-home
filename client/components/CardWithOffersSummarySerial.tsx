import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CollectionSerialCard from "@/components/CollectionSerialCard";
import { fetchSerialData } from "@/lib/marketplaceEvents";
import { getUsernameForWallet } from "@/lib/profiles";
import type { ActiveOffer } from "@/lib/activeOffers";
import type { ActiveListing } from "@/lib/activeListings";
import type { SerialData } from "@/lib/marketplaceEvents";

interface CardWithOffersSummarySerialProps {
  tokenId: string | number | null | undefined;
  offer: ActiveOffer;
  listingsForEdition?: ActiveListing[];
}

export function CardWithOffersSummarySerial({
  tokenId,
  offer,
  listingsForEdition = [],
}: CardWithOffersSummarySerialProps) {
  const navigate = useNavigate();
  const [serialData, setSerialData] = useState<SerialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [offerorUsername, setOfferorUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!tokenId || !offer) {
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

        // Fetch offeror username
        if (offer.offeror) {
          const username = await getUsernameForWallet(offer.offeror);
          setOfferorUsername(username || null);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tokenId, offer]);

  const handleClick = () => {
    if (serialData?.id && serialData?.serial != null) {
      navigate(`/edition/${serialData.id}/serial/${serialData.serial}`);
    }
  };

  const formatExpirationTime = (unixTimestamp: number): string => {
    try {
      const date = new Date(unixTimestamp * 1000);
      return date.toLocaleString();
    } catch {
      return "Unknown";
    }
  };

  if (!serialData || loading) {
    return null;
  }

  return (
    <div
      className="w-full h-auto flex flex-col cursor-pointer"
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
      <div className="flex-shrink-0 w-full">
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
      <div className="flex-shrink-0 pt-2 pb-2 w-full">
        <div className="text-center text-[11px] text-slate-600 dark:text-slate-400 space-y-0.5">
          <div className="font-medium text-[14px] leading-[14px]">${(Number(offer.totalPrice) / 1e18).toFixed(2)}</div>
          <div className="truncate px-1">From {offerorUsername || offer.offeror.slice(0, 6) + "..." + offer.offeror.slice(-4)}</div>
          <div className="text-[10px] leading-tight px-1">
            <div>Expires:</div>
            <div className="line-clamp-2">{formatExpirationTime(offer.expirationTimestamp)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
