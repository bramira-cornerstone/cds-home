import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";

import {
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from "thirdweb";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import CountdownDisplay from "@/components/CountdownDisplay";
import type { Listing } from "@/hooks/useMarketplaceListings";

interface ListingCardProps {
  listing: Listing;
  onCancelSuccess?: () => void;
  onClose?: () => void;
  editionIdProp?: number;
  serialProp?: number;
}

export function ListingCard({
  listing,
  onCancelSuccess,
  onClose,
  editionIdProp,
  serialProp,
}: ListingCardProps) {
  const navigate = useNavigate();
  const { metadata } = useTokenMetadata(listing.tokenId);
  const account = useActiveAccount();
  const redirectScheduledRef = useRef(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [editionId, setEditionId] = useState<number | null>(
    editionIdProp || null,
  );
  const [serialNum, setSerialNum] = useState<number | null>(serialProp || null);

  const isOwned = useMemo(() => {
    if (!account) return false;
    const sellerAddr = (listing as any).sellerAddress || listing.seller;
    if (!sellerAddr) return false;
    return account.address.toLowerCase() === sellerAddr.toLowerCase();
  }, [account, listing]);

  useEffect(() => {
    if (editionIdProp !== null && editionIdProp !== undefined) {
      setEditionId(editionIdProp);
    } else if (
      (listing as any).editionId !== null &&
      (listing as any).editionId !== undefined
    ) {
      setEditionId((listing as any).editionId);
    } else if (
      metadata.edition_id !== null &&
      metadata.edition_id !== undefined
    ) {
      setEditionId(metadata.edition_id);
    }
  }, [editionIdProp, metadata.edition_id, listing]);

  useEffect(() => {
    if (serialProp !== null && serialProp !== undefined) {
      setSerialNum(serialProp);
    } else if (
      (listing as any).serial !== null &&
      (listing as any).serial !== undefined
    ) {
      setSerialNum((listing as any).serial);
    } else if (metadata.serial !== null && metadata.serial !== undefined) {
      setSerialNum(metadata.serial);
    }
  }, [serialProp, metadata.serial, listing]);

  useEffect(() => {
    if (cancelSuccess) {
      if (redirectScheduledRef.current) {
        return;
      }

      redirectScheduledRef.current = true;
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [cancelSuccess]);

  const handleCancelListing = async () => {
    try {
      setCancelError(null);
      setIsCanceling(true);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      const MARKETPLACE_ADDRESS =
        import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
      const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const contract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract,
        method: "function cancelListing(uint256 _listingId)",
        params: [BigInt(listing.listingId)],
      });

      const transactionResult = await sendAndConfirmTransaction({
        account,
        transaction,
      });

      setCancelSuccess(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel listing";
      setCancelError(errorMessage);
    } finally {
      setIsCanceling(false);
    }
  };

  if (cancelSuccess) {
    return (
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center justify-center min-h-32">
        <p className="text-lg font-medium text-slate-800 dark:text-white text-center">
          Success! Your relic is off the market
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow card-shadow">
      <div className="space-y-3 mb-6">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Price
          </p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">
            ${(Number(BigInt(listing.pricePerToken)) / 1e18).toFixed(2)}
          </p>
        </div>

        {listing.startTimestamp && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Listed
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {new Date(listing.startTimestamp * 1000).toLocaleString()}
            </p>
          </div>
        )}

        {listing.endTimestamp &&
          listing.startTimestamp &&
          (() => {
            const startSeconds = listing.startTimestamp;
            const endSeconds = listing.endTimestamp;
            const diffSeconds = endSeconds - startSeconds;
            const oneHundredYearsInSeconds = 100 * 365.25 * 24 * 60 * 60;
            const isApproximatelyOneHundredYears =
              Math.abs(diffSeconds - oneHundredYearsInSeconds) <
              365 * 24 * 60 * 60;

            return !isApproximatelyOneHundredYears ? (
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Expires
                </p>
                <CountdownDisplay
                  endTimestampSeconds={listing.endTimestamp}
                  className="text-sm text-slate-700 dark:text-slate-300"
                  showLabel={false}
                />
              </div>
            ) : null;
          })()}
      </div>

      {cancelError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded mb-4 text-sm">
          {cancelError}
        </div>
      )}

      <div className="flex gap-2">
        {listing.listingType === "direct" ? (
          isOwned ? (
            editionId !== null && serialNum !== null ? (
              <>
                <button
                  onClick={handleCancelListing}
                  disabled={isCanceling || cancelSuccess}
                  className="flex-1 text-center bg-orange-500 hover:bg-orange-600 disabled:bg-orange-400 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
                >
                  {cancelSuccess
                    ? "Success!"
                    : isCanceling
                      ? "Canceling..."
                      : "Cancel Listing"}
                </button>
                {onClose && (
                  <button
                    onClick={onClose}
                    className="flex-1 text-center bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white text-slate-900 font-medium py-2 px-4 rounded transition sm:text-sm"
                  >
                    Close
                  </button>
                )}
              </>
            ) : null
          ) : editionId !== null && serialNum !== null ? (
            <button
              onClick={() =>
                navigate(
                  `/edition/${editionId}/serial/${serialNum}/buy-offer-bid`,
                )
              }
              className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
            >
              Buy or Manage Offers
            </button>
          ) : null
        ) : (
          <>
            <button
              onClick={handleCancelListing}
              disabled={isCanceling || cancelSuccess}
              className="flex-1 text-center bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
            >
              {cancelSuccess
                ? "Success!"
                : isCanceling
                  ? "Canceling..."
                  : "Cancel Active Listing"}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 text-center bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white text-slate-900 font-medium py-2 px-4 rounded transition sm:text-sm"
              >
                Close
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
