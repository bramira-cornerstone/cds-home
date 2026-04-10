import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useMarketplace } from "@/hooks/useMarketplace";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useToast } from "@/hooks/use-toast";

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default function MakeOfferPage() {
  const navigate = useNavigate();
  const params = useParams<{ editionId?: string; serial?: string }>();
  const account = useActiveAccount();
  const { contract } = useMarketplace();
  const { listings: activeListings, loading: listingsLoading } = useActiveListings();
  const { toast } = useToast();

  const [offerAmount, setOfferAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const editionId = useMemo(
    () => (params.editionId ? parseInt(params.editionId, 10) : null),
    [params.editionId],
  );

  const serial = useMemo(
    () => (params.serial ? parseInt(params.serial, 10) : null),
    [params.serial],
  );

  const activeListing = useMemo(() => {
    if (!editionId || serial === null || activeListings.length === 0) {
      return null;
    }

    return activeListings.find(
      (listing) => listing.editionId === editionId && listing.serial === serial,
    );
  }, [editionId, serial, activeListings]);

  const listingPrice = useMemo(() => {
    if (!activeListing) return 0;
    return Number(BigInt(activeListing.pricePerToken)) / 1e18;
  }, [activeListing]);

  const handleMakeOffer = async () => {
    try {
      if (!account) {
        toast({
          title: "Error",
          description: "Please connect your wallet first",
          variant: "destructive",
        });
        return;
      }

      if (!contract || !activeListing) {
        toast({
          title: "Error",
          description: "Listing not found",
          variant: "destructive",
        });
        return;
      }

      const amount = parseFloat(offerAmount);
      if (isNaN(amount) || amount <= 0) {
        toast({
          title: "Error",
          description: "Please enter a valid offer amount",
          variant: "destructive",
        });
        return;
      }

      if (amount >= listingPrice) {
        toast({
          title: "Error",
          description:
            "Offer amount must be less than the asking price. Use Buy Now instead.",
          variant: "destructive",
        });
        return;
      }

      setIsProcessing(true);

      const offerAmountInWei = BigInt(Math.floor(amount * 1e18));

      const transaction = prepareContractCall({
        contract,
        method:
          "function makeOffer(uint256 listingId, uint256 quantityWantedInBaseTokens, address currency, uint256 pricePerToken) returns (bool)",
        params: [
          BigInt(activeListing.listingId),
          1n,
          NATIVE_TOKEN_ADDRESS,
          offerAmountInWei,
        ],
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      toast({
        title: "Success",
        description: "Offer created successfully!",
      });

      navigate(`/edition/${editionId}/serial/${serial}`);
    } catch (error) {
      console.error("[MakeOffer] Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create offer",
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  if (!account) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Connect Wallet</h1>
          <p className="text-slate-600">Please connect your wallet to continue</p>
        </div>
      </div>
    );
  }

  // Show loading spinner while fetching listings
  if (listingsLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="animate-spin">
              <div className="h-12 w-12 border-4 border-orange-300 border-t-orange-600 rounded-full"></div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Loading listing...</h2>
        </div>
      </div>
    );
  }

  if (!activeListing) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Listing Not Found</h1>
          <p className="text-slate-600">This listing is not available</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h1 className="text-2xl font-bold mb-6">Make Offer</h1>

        <div className="space-y-4 mb-6">
          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Edition
            </label>
            <p className="text-lg font-semibold">#{editionId}</p>
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Serial
            </label>
            <p className="text-lg font-semibold">#{serial}</p>
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Asking Price
            </label>
            <p className="text-lg font-semibold text-slate-900 dark:text-white">
              ${listingPrice.toFixed(2)}
            </p>
          </div>

          <div>
            <label className="text-sm text-slate-600 dark:text-slate-300">
              Seller
            </label>
            <p className="text-sm font-mono break-all">
              {activeListing.sellerUsername || activeListing.sellerAddress}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="offerAmount" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Offer Amount (ETH)
            </label>
            <input
              id="offerAmount"
              type="number"
              step="0.01"
              min="0"
              value={offerAmount}
              onChange={(e) => setOfferAmount(e.target.value)}
              placeholder={`Less than ${listingPrice.toFixed(2)}`}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isProcessing}
            />
            {offerAmount && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                {Number(offerAmount) >= listingPrice
                  ? "Offer amount must be less than asking price"
                  : `Offer: $${Number(offerAmount).toFixed(2)}`}
              </p>
            )}
          </div>

          <button
            onClick={handleMakeOffer}
            disabled={isProcessing || !offerAmount}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded transition"
          >
            {isProcessing ? "Creating Offer..." : "Make Offer"}
          </button>

          <button
            onClick={() => navigate(-1)}
            className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
