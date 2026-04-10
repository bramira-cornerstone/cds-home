import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useMarketplace } from "@/hooks/useMarketplace";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useToast } from "@/hooks/use-toast";

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

export default function BuyListingPage() {
  const navigate = useNavigate();
  const params = useParams<{ editionId?: string; serial?: string }>();
  const account = useActiveAccount();
  const { contract } = useMarketplace();
  const { listings: activeListings, loading: listingsLoading } = useActiveListings();
  const { toast } = useToast();

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

  const handleBuyNow = async () => {
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

      setIsProcessing(true);

      const transaction = prepareContractCall({
        contract,
        method:
          "function buyFromListing(uint256 listingId, address buyFor, uint256 quantity, address currency, uint256 expectedTotalPrice) returns (bool)",
        params: [
          BigInt(activeListing.listingId),
          account.address,
          1n,
          NATIVE_TOKEN_ADDRESS,
          BigInt(activeListing.pricePerToken),
        ],
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      toast({
        title: "Success",
        description: "NFT purchased successfully!",
      });

      navigate(`/edition/${editionId}/serial/${serial}`);
    } catch (error) {
      console.error("[BuyListing] Error:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to buy NFT",
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
          <p className="text-slate-600">
            Please connect your wallet to continue
          </p>
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

  const priceInTokens = Number(BigInt(activeListing.pricePerToken)) / 1e18;

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
        <h1 className="text-2xl font-bold mb-6">Buy NFT</h1>

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
              Price
            </label>
            <p className="text-2xl font-bold" style={{ color: "#004FFF" }}>
              ${priceInTokens.toFixed(2)}
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

        <button
          onClick={handleBuyNow}
          disabled={isProcessing}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded transition"
        >
          {isProcessing ? "Processing..." : "Buy Now"}
        </button>

        <button
          onClick={() => navigate(-1)}
          className="w-full mt-2 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
