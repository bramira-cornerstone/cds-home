import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from "thirdweb";
import { polygon } from "thirdweb/chains";
import { useTokenMetadata } from "@/hooks/useTokenMetadata";
import { useProfileUsername } from "@/hooks/useProfileUsername";
import CountdownDisplay from "@/components/CountdownDisplay";
import type { ActiveOffer } from "@/lib/activeOffers";

interface OfferCardProps {
  offer: ActiveOffer;
  onAcceptSuccess?: () => void;
}

export function OfferCard({ offer, onAcceptSuccess }: OfferCardProps) {
  const navigate = useNavigate();
  const { metadata } = useTokenMetadata(offer.tokenId);
  const { username: offerorUsername } = useProfileUsername(offer.offeror);
  const account = useActiveAccount();
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptSuccess, setAcceptSuccess] = useState(false);

  const isOfferor = useMemo(() => {
    if (!account || !offer.offeror) return false;
    return account.address.toLowerCase() === offer.offeror.toLowerCase();
  }, [account, offer.offeror]);

  const handleAcceptOffer = async () => {
    try {
      setAcceptError(null);
      setIsAccepting(true);

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
        method: "function acceptOffer(uint256 _offerId)",
        params: [BigInt(offer.offerId)],
      });

      const transactionResult = await sendAndConfirmTransaction({
        account,
        transaction,
      });

      console.log("Offer accepted successfully:", transactionResult);
      setAcceptSuccess(true);
      setIsAccepting(false);

      if (onAcceptSuccess) {
        onAcceptSuccess();
      }

      // Redirect to collection after 5 seconds
      setTimeout(() => {
        navigate("/collection");
      }, 5000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to accept offer";
      setAcceptError(errorMessage);
      console.error("Error accepting offer:", err);
      setIsAccepting(false);
    }
  };

  const handleCancelOffer = async () => {
    try {
      setAcceptError(null);
      setIsAccepting(true);

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
        method: "function cancelOffer(uint256 _offerId)",
        params: [BigInt(offer.offerId)],
      });

      const transactionResult = await sendAndConfirmTransaction({
        account,
        transaction,
      });

      console.log("Offer canceled successfully:", transactionResult);
      if (onAcceptSuccess) {
        onAcceptSuccess();
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to cancel offer";
      setAcceptError(errorMessage);
      console.error("Error canceling offer:", err);
    } finally {
      setIsAccepting(false);
    }
  };

  if (acceptSuccess) {
    return (
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow" style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <div className="mb-4 text-4xl">✓</div>
            <p className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
              Offer accepted!
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Proceeds going to your account shortly.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
              Redirecting to your collection...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow" style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }}>
      <div className="space-y-3 mb-6">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Price
          </p>
          <p className="text-xl font-bold text-slate-800 dark:text-white">
            ${(Number(BigInt(offer.totalPrice)) / 1e18).toFixed(2)}
          </p>
        </div>


        {offer.expirationTimestamp && (
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Expires
            </p>
            <CountdownDisplay
              endTimestampSeconds={offer.expirationTimestamp}
              className="text-sm text-slate-700 dark:text-slate-300"
              showLabel={false}
            />
          </div>
        )}

        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Offer From
          </p>
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {offerorUsername ||
              `${offer.offeror.slice(0, 6)}...${offer.offeror.slice(-4)}`}
          </p>
        </div>
      </div>

      {acceptError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded mb-4 text-sm">
          {acceptError}
        </div>
      )}

      <div className="flex gap-2">
        {isOfferor ? (
          <button
            onClick={handleCancelOffer}
            disabled={isAccepting}
            className="flex-1 text-center bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
          >
            {isAccepting ? "Canceling..." : "Cancel Offer"}
          </button>
        ) : metadata.edition_id !== null && metadata.serial !== null ? (
          <button
            onClick={handleAcceptOffer}
            disabled={isAccepting}
            className="flex-1 text-center bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition sm:text-sm"
          >
            {isAccepting ? "Accepting..." : "Accept Offer"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
