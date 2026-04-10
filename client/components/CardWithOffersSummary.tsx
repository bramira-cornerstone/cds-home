import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { EditionCardMiniWithData } from "@/components/EditionCardMiniWithData";
import type { ActiveOffer } from "@/lib/activeOffers";
import type { ActiveListing } from "@/lib/activeListings";

interface CardWithOffersSummaryProps {
  editionId: number | null;
  serial: number | null;
  offersForToken?: ActiveOffer[];
  listingsForEdition?: ActiveListing[];
}

export function CardWithOffersSummary({
  editionId,
  serial,
  offersForToken = [],
  listingsForEdition = [],
}: CardWithOffersSummaryProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (editionId && serial !== null) {
      navigate(`/edition/${editionId}/serial/${serial}`);
    }
  };

  const summaryData = useMemo(() => {
    const lowAskPrice =
      listingsForEdition.length > 0
        ? listingsForEdition[0].low_ask || listingsForEdition[0].pricePerToken
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
      lowAskPrice,
      topOffers: sortedOffers.slice(0, 3),
    };
  }, [offersForToken, listingsForEdition]);

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
        {serial !== null && (
          <div className="text-center mb-0.5 leading-tight">
            <div className="font-semibold">#{serial}</div>
            {summaryData.lowAskPrice && (
              <div className="text-[8px]">
                Low Ask: ${(Number(summaryData.lowAskPrice) / 1e18).toFixed(2)}
              </div>
            )}
          </div>
        )}
        {summaryData.topOffers.length > 0 && (
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
