import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useMarketplace } from "@/hooks/useMarketplace";
import {
  getListing,
  getAuction,
  type Listing,
} from "@/hooks/useMarketplaceListings";
import { prepareContractCall, sendAndConfirmTransaction } from "thirdweb";

const CUSTOM_ERC20_ADDRESS = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";

export default function ListingDetailPage() {
  const { listingId } = useParams<{ listingId: string }>();
  const navigate = useNavigate();
  const account = useActiveAccount();
  const {
    contract,
    loading: contractLoading,
    error: contractError,
  } = useMarketplace();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!contract || !listingId) return;

    async function fetchListing() {
      try {
        setLoading(true);
        setError(null);

        let listingData: Listing | null = null;

        try {
          listingData = await getListing(contract, listingId);
        } catch {
          try {
            listingData = await getAuction(contract, listingId);
          } catch {
            listingData = null;
          }
        }

        setListing(listingData);
        if (!listingData) {
          setError("Listing not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load listing");
      } finally {
        setLoading(false);
      }
    }

    fetchListing();
  }, [contract, listingId]);

  if (contractLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <p className="text-slate-600 dark:text-slate-400">Loading...</p>
      </div>
    );
  }

  if (contractError || !contract) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <p className="text-red-600">
          Error: {contractError || "Marketplace not available"}
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <p className="text-slate-600 dark:text-slate-400">Loading listing...</p>
      </div>
    );
  }

  if (error || !listing) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <p className="text-red-600 mb-4">{error || "Listing not found"}</p>
        <button
          onClick={() => navigate("/market")}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          Back to Marketplace
        </button>
      </div>
    );
  }

  async function handleBidOrOffer() {
    if (!account || !contract || !listing || !bidAmount) {
      setError("Please enter a bid amount");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const bidInWei = BigInt(Math.floor(parseFloat(bidAmount) * 1e18));

      if (listing.listingType === "direct") {
        const transaction = prepareContractCall({
          contract,
          method:
            "function makeOffer(uint256 listingId, uint256 quantityWantedInBaseTokens, address currency, uint256 pricePerToken) returns (bool)",
          params: [
            BigInt(listing.listingId),
            1n,
            CUSTOM_ERC20_ADDRESS,
            bidInWei,
          ],
        });

        await sendAndConfirmTransaction({
          transaction,
          account,
        });
      } else {
        const transaction = prepareContractCall({
          contract,
          method:
            "function bidInAuction(uint256 auctionId, uint256 bidAmount) returns (bool)",
          params: [BigInt(listing.listingId), bidInWei],
        });

        await sendAndConfirmTransaction({
          transaction,
          account,
        });
      }

      alert("Bid/Offer submitted successfully!");
      setBidAmount("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to submit bid/offer",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleBuyout() {
    if (!account || !contract || !listing) {
      setError("Please connect your wallet");
      return;
    }

    try {
      setIsProcessing(true);
      setError(null);

      const transaction = prepareContractCall({
        contract,
        method:
          "function buyFromListing(uint256 listingId, address buyFor, uint256 quantity, address currency, uint256 expectedTotalPrice) returns (bool)",
        params: [
          BigInt(listing.listingId),
          account.address,
          1n,
          CUSTOM_ERC20_ADDRESS,
          BigInt(listing.pricePerToken),
        ],
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      alert("NFT purchased successfully!");
      navigate("/market");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete purchase",
      );
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900">
      <div className="max-w-6xl mx-auto p-8">
        <button
          onClick={() => navigate("/market")}
          className="text-blue-600 hover:text-blue-700 dark:text-blue-400 mb-6"
        >
          ← Back to Marketplace
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg" />

          {/* Details */}
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              {listing.listingType === "direct" ? "Direct Listing" : "Auction"}
            </p>
            <h1 className="text-4xl font-bold mt-2 dark:text-white">
              Token #{listing.tokenId}
            </h1>

            <div className="mt-8 space-y-4">
              <div>
                <p className="text-slate-600 dark:text-slate-400">Seller</p>
                <p className="font-mono text-sm dark:text-white">
                  {listing.seller}
                </p>
              </div>

              <div>
                <p className="text-slate-600 dark:text-slate-400">Contract</p>
                <p className="font-mono text-sm dark:text-white">
                  {listing.assetContract}
                </p>
              </div>

              <div>
                <p className="text-slate-600 dark:text-slate-400">
                  {listing.listingType === "direct" ? "Price" : "Minimum Bid"}
                </p>
                <p className="text-2xl font-bold dark:text-white">
                  {(BigInt(listing.pricePerToken) / BigInt(1e18)).toString()}{" "}
                  Tokens
                </p>
              </div>

              {listing.listingType === "auction" &&
                listing.buyoutPricePerToken && (
                  <div>
                    <p className="text-slate-600 dark:text-slate-400">
                      Buyout Price
                    </p>
                    <p className="text-2xl font-bold dark:text-white">
                      {(
                        BigInt(listing.buyoutPricePerToken) / BigInt(1e18)
                      ).toString()}{" "}
                      Tokens
                    </p>
                  </div>
                )}

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded">
                  {error}
                </div>
              )}

              {!account ? (
                <p className="text-slate-600 dark:text-slate-400">
                  Please connect your wallet to place a bid or make an offer.
                </p>
              ) : listing.listingType === "direct" ? (
                <div className="space-y-4">
                  <button
                    onClick={handleBuyout}
                    disabled={isProcessing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-3 px-4 rounded transition"
                  >
                    {isProcessing ? "Processing..." : "Buy Now"}
                  </button>

                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      Make an Offer
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Amount in MATIC"
                        className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                      />
                      <button
                        onClick={handleBidOrOffer}
                        disabled={isProcessing || !bidAmount}
                        className="bg-slate-600 hover:bg-slate-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition"
                      >
                        {isProcessing ? "..." : "Offer"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      Place a Bid
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(e.target.value)}
                        placeholder="Amount in MATIC"
                        className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                      />
                      <button
                        onClick={handleBidOrOffer}
                        disabled={isProcessing || !bidAmount}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition"
                      >
                        {isProcessing ? "..." : "Bid"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
