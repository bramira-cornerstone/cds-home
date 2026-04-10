import { useState } from "react";

import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useMarketplace } from "@/hooks/useMarketplace";
import { formatOfferPrice } from "@/lib/activeOffers";
import type { ActiveOffer } from "@/lib/activeOffers";

export type ManageOfferFormProps = {
  editionId?: number | null;
  serial?: number | null;
  offer: ActiveOffer;
  onCancel?: () => void;
};

export default function ManageOfferForm({
  editionId = null,
  serial = null,
  offer,
  onCancel,
}: ManageOfferFormProps) {
  const account = useActiveAccount();
  const { contract } = useMarketplace();
  const { refetch: refetchOffers } = useActiveOffers();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const handleCancelOffer = async () => {
    if (!account || !contract || !offer) {
      setSubmitError("Missing account or contract information");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);

    try {
      const cancelCall = prepareContractCall({
        contract,
        method: "function cancelOffer(uint256 _offerId)",
        params: [BigInt(offer.offerId)],
      });

      await sendAndConfirmTransaction({
        transaction: cancelCall,
        account,
      });

      setSubmitSuccess(true);
      await refetchOffers();

      // Close panel after 2 seconds
      setTimeout(() => {
        onCancel?.();
      }, 2000);
    } catch (err: any) {
      console.error("Failed to cancel offer:", err);
      setSubmitError(
        err?.message || "Failed to cancel offer. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!offer) {
    return <div className="text-slate-600">No offer data available</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Manage Your Offer</h3>

        <div className="space-y-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-md">
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Offer Amount
            </label>
            <p className="text-lg font-semibold text-slate-800 dark:text-white">
              {formatOfferPrice(offer.totalPrice, offer.currency)}
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Offer ID
            </label>
            <p className="text-sm font-mono text-slate-700 dark:text-slate-300 break-all">
              {offer.offerId}
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Edition ID
            </label>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {editionId}
            </p>
          </div>

          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Serial
            </label>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {serial}
            </p>
          </div>
        </div>
      </div>

      {submitError && (
        <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 rounded p-3">
          <p className="text-sm text-red-700 dark:text-red-200">{submitError}</p>
        </div>
      )}

      {submitSuccess && (
        <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 rounded p-3">
          <p className="text-sm text-green-700 dark:text-green-200">
            Offer cancelled successfully. Reloading...
          </p>
        </div>
      )}

      <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-600">
        <button
          type="button"
          onClick={handleCancelOffer}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-400 transition-colors font-medium text-sm"
        >
          {isSubmitting ? "Cancelling..." : "Cancel Offer"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-slate-300 dark:bg-slate-600 text-slate-800 dark:text-white rounded hover:bg-slate-400 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors font-medium text-sm"
        >
          Close
        </button>
      </div>
    </div>
  );
}
