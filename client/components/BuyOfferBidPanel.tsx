import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { TbEyeSearch } from "react-icons/tb";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import { useSharedCountdownBreakdown } from "@/hooks/useSharedCountdown";
import {
  prepareContractCall,
  sendAndConfirmTransaction,
  getContract,
  readContract,
} from "thirdweb";
import { useToast } from "@/hooks/use-toast";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import {
  getTokenDecimals,
  convertToTokenWei,
  checkERC20Allowance,
  approveERC20,
} from "@/lib/tokenUtils";
import { formatOfferPrice } from "@/lib/activeOffers";
import AuctionBidCard from "@/components/AuctionBidCard";
import { getUsernameForWalletAddress } from "@/lib/followeesService";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const OFFER_CURRENCY = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";
const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

interface BuyOfferBidPanelProps {
  editionId: number;
  serial: number;
  viewerCount?: number;
}

export default function BuyOfferBidPanel({
  editionId,
  serial,
  viewerCount = 0,
}: BuyOfferBidPanelProps) {
  const navigate = useNavigate();
  const account = useActiveAccount();
  const { contract } = useMarketplace();
  const { listings: activeListings, loading: listingsLoading } = useActiveListings();
  const { auctions: activeAuctions, loading: auctionsLoading } = useActiveAuctions();
  const { offers } = useActiveOffers();
  const { toast } = useToast();
  const { data: auctionBids = [] } = useAuctionBids(null);
  const { mutateAsync: sendTransaction } = useSendTransaction();

  const [offerAmount, setOfferAmount] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [isBuyProcessing, setIsBuyProcessing] = useState(false);
  const [isOfferProcessing, setIsOfferProcessing] = useState(false);
  const [isBidProcessing, setIsBidProcessing] = useState(false);
  const [isBidApproving, setIsBidApproving] = useState(false);
  const [isCancelingAuction, setIsCancelingAuction] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [bidError, setBidError] = useState<string | null>(null);
  const [cancelAuctionError, setCancelAuctionError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [currentHighBid, setCurrentHighBid] = useState<string | null>(null);
  const [bidderAddress, setBidderAddress] = useState<string | null>(null);
  const [bidderUsername, setBidderUsername] = useState<string | null>(null);
  const [countdownTime, setCountdownTime] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [offerorUsernames, setOfferorUsernames] = useState<Record<string, string | null>>({});

  const activeListing = useMemo(() => {
    if (!activeListings || activeListings.length === 0) return null;
    return activeListings.find((l) => l.editionId === editionId && l.serial === serial) || null;
  }, [editionId, serial, activeListings]);

  const activeAuction = useMemo(() => {
    if (!activeAuctions || activeAuctions.length === 0) return null;
    return (
      activeAuctions.find(
        (a) =>
          a.editionId === editionId &&
          a.serial === serial &&
          a.status === "active"
      ) || null
    );
  }, [editionId, serial, activeAuctions]);

  const isAuctionCreator = useMemo(() => {
    if (!account || !activeAuction) return false;
    return (
      account.address.toLowerCase() === activeAuction.auctionCreator.toLowerCase()
    );
  }, [account, activeAuction]);

  const listingPrice = useMemo(() => {
    if (!activeListing) return 0;
    return Number(BigInt(activeListing.pricePerToken)) / 1e18;
  }, [activeListing]);

  const sortedOffers = useMemo(() => {
    return offers
      .filter((o) => o.editionId === editionId && o.serial === serial)
      .sort((a, b) => {
        const priceA = BigInt(a.totalPrice);
        const priceB = BigInt(b.totalPrice);
        return priceA > priceB ? -1 : 1;
      });
  }, [offers, editionId, serial]);

  // Fetch winning bid
  useEffect(() => {
    const fetchWinningBid = async () => {
      if (!activeAuction) {
        setCurrentHighBid(null);
        return;
      }

      try {
        const marketplaceContract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const winningBid = await readContract({
          contract: marketplaceContract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(activeAuction.auctionId)],
        });

        if (
          winningBid &&
          Array.isArray(winningBid) &&
          winningBid.length >= 3 &&
          winningBid[2]
        ) {
          setCurrentHighBid(String(winningBid[2]));
          setBidderAddress(String(winningBid[0]));
        } else {
          setCurrentHighBid(null);
          setBidderAddress(null);
        }
      } catch (err) {
        console.error("Error fetching winning bid:", err);
        setCurrentHighBid(null);
      }
    };

    fetchWinningBid();
  }, [activeAuction?.auctionId]);

  // Fetch bidder username
  useEffect(() => {
    const fetchBidderUsername = async () => {
      if (!bidderAddress) {
        setBidderUsername(null);
        return;
      }

      try {
        const username = await getUsernameForWalletAddress(bidderAddress);
        setBidderUsername(username || null);
      } catch (err) {
        console.error("Error fetching bidder username:", err);
        setBidderUsername(null);
      }
    };

    fetchBidderUsername();
  }, [bidderAddress]);

  // Update countdown timer using shared countdown hook
  const countdownBreakdown = useSharedCountdownBreakdown(
    activeAuction?.endTimestamp ? activeAuction.endTimestamp * 1000 : 0,
  );

  useEffect(() => {
    setCountdownTime(countdownBreakdown);
  }, [countdownBreakdown]);

  // Fetch offeror usernames
  useEffect(() => {
    const fetchOfferorUsernames = async () => {
      if (sortedOffers.length === 0) {
        setOfferorUsernames({});
        return;
      }

      const usernames: Record<string, string | null> = {};

      for (const offer of sortedOffers) {
        try {
          const username = await getUsernameForWalletAddress(offer.offeror);
          usernames[offer.offeror] = username || null;
        } catch (err) {
          usernames[offer.offeror] = null;
        }
      }

      setOfferorUsernames(usernames);
    };

    fetchOfferorUsernames();
  }, [sortedOffers]);

  const handleBuyNow = async () => {
    if (!account || !contract || !activeListing) return;

    setIsBuyProcessing(true);
    setBuyError(null);

    try {
      const listingCurrency = activeListing.currency || NATIVE_TOKEN_ADDRESS;
      const listingPrice_BigInt = BigInt(activeListing.pricePerToken);
      const listingPrice = Number(listingPrice_BigInt) / 1e18;

      // Check balance before attempting transaction
      if (listingCurrency !== NATIVE_TOKEN_ADDRESS) {
        const buyCurrencyContract = getContract({
          address: listingCurrency,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const balance = await readContract({
          contract: buyCurrencyContract,
          method: "function balanceOf(address account) view returns (uint256)",
          params: [account.address],
        });

        const balanceInTokens = Number(balance) / 1e18;
        if (balanceInTokens < listingPrice) {
          throw new Error(
            `Insufficient balance. You have $${balanceInTokens.toFixed(2)} but need $${listingPrice.toFixed(2)} to buy this listing. Please add more to your wallet to complete this transaction.`,
          );
        }
      }

      // Check and request approval for ERC-20 tokens
      if (listingCurrency !== NATIVE_TOKEN_ADDRESS) {
        const currentAllowance = await checkERC20Allowance(
          listingCurrency,
          account.address,
          MARKETPLACE_ADDRESS,
          THIRDWEB_CLIENT_ID,
        );

        if (currentAllowance < listingPrice_BigInt) {
          // Approve for 2x the price for convenience
          const approvalAmount = listingPrice_BigInt * 2n;

          await approveERC20(
            listingCurrency,
            MARKETPLACE_ADDRESS,
            approvalAmount,
            account,
            THIRDWEB_CLIENT_ID,
          );
        }
      }

      const transaction = prepareContractCall({
        contract,
        method: "function buyFromListing(uint256 _listingId, address _buyFor, uint256 _quantity, address _currency, uint256 _expectedTotalPrice) payable",
        params: [
          BigInt(activeListing.listingId),
          account.address,
          1n,
          listingCurrency,
          listingPrice_BigInt,
        ],
      });

      await sendTransaction(transaction);

      toast({
        title: "Success!",
        description: "Purchase completed successfully!",
      });

      setBuySuccess(true);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to buy listing";
      setBuyError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsBuyProcessing(false);
    }
  };

  const handlePlaceBid = async () => {
    console.log("[BuyOfferBidPanel] handlePlaceBid called", {
      account: account?.address,
      contract: !!contract,
      activeAuction: activeAuction?.auctionId,
      bidAmount
    });

    if (!account || !contract || !activeAuction || !bidAmount) {
      console.log("[BuyOfferBidPanel] Missing required fields for bid", {
        account: !!account,
        contract: !!contract,
        activeAuction: !!activeAuction,
        bidAmount: !!bidAmount
      });
      return;
    }

    setIsBidProcessing(true);
    setIsBidApproving(true);
    setBidError(null);

    try {
      console.log("[BuyOfferBidPanel] Starting bid process");
      const bidInWei = BigInt(Math.floor(parseFloat(bidAmount) * 1e18));
      console.log("[BuyOfferBidPanel] Bid amount in wei:", bidInWei.toString());

      // Check and approve if needed
      console.log("[BuyOfferBidPanel] Checking ERC20 allowance");
      const allowance = await checkERC20Allowance(
        OFFER_CURRENCY,
        account.address,
        MARKETPLACE_ADDRESS,
        THIRDWEB_CLIENT_ID,
      );
      console.log("[BuyOfferBidPanel] Current allowance:", allowance.toString());

      if (allowance < bidInWei) {
        console.log("[BuyOfferBidPanel] Approving ERC20 tokens");
        // Approve for 2x the amount for convenience
        const approvalAmount = bidInWei * 2n;

        await approveERC20(
          OFFER_CURRENCY,
          MARKETPLACE_ADDRESS,
          approvalAmount,
          account,
          THIRDWEB_CLIENT_ID,
        );
        console.log("[BuyOfferBidPanel] ERC20 approval completed");
      } else {
        console.log("[BuyOfferBidPanel] Sufficient allowance, skipping approval");
      }

      setIsBidApproving(false);

      console.log("[BuyOfferBidPanel] Preparing contract call for bidInAuction");
      const transaction = prepareContractCall({
        contract,
        method: "function bidInAuction(uint256 _auctionId, uint256 _bidAmount) payable",
        params: [BigInt(activeAuction.auctionId), bidInWei],
      });
      console.log("[BuyOfferBidPanel] Transaction prepared:", {
        auctionId: activeAuction.auctionId,
        bidAmount: bidInWei.toString()
      });

      console.log("[BuyOfferBidPanel] Sending transaction via sendTransaction");
      const txResult = await sendTransaction(transaction);
      console.log("[BuyOfferBidPanel] Transaction sent successfully:", txResult);

      setBidAmount("");
      console.log("[BuyOfferBidPanel] Bid amount cleared, showing success toast");
      toast({
        title: "Success!",
        description: "Bid placed successfully!",
      });

      setTimeout(() => {
        console.log("[BuyOfferBidPanel] Reloading page");
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("[BuyOfferBidPanel] Error in handlePlaceBid:", err);
      setIsBidApproving(false);
      const errorMsg = err instanceof Error ? err.message : "Failed to place bid";
      console.log("[BuyOfferBidPanel] Error message:", errorMsg);
      setBidError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      console.log("[BuyOfferBidPanel] Finally block: clearing processing states");
      setIsBidProcessing(false);
      setIsBidApproving(false);
    }
  };

  const handleCancelAuction = async () => {
    if (!account || !contract || !activeAuction) return;

    setIsCancelingAuction(true);
    setCancelAuctionError(null);

    try {
      const transaction = prepareContractCall({
        contract,
        method: "function cancelAuction(uint256 _auctionId)",
        params: [BigInt(activeAuction.auctionId)],
      });

      await sendTransaction(transaction);

      toast({
        title: "Success!",
        description: "Auction cancelled successfully!",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to cancel auction";
      setCancelAuctionError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsCancelingAuction(false);
    }
  };

  const handleMakeOffer = async () => {
    if (!account || !contract || !offerAmount || !expirationDate) return;

    setIsOfferProcessing(true);
    setOfferError(null);

    try {
      const offerInWei = BigInt(Math.floor(parseFloat(offerAmount) * 1e18));
      const expirationSeconds = Math.floor(new Date(expirationDate).getTime() / 1000);

      // Check and approve if needed
      const allowance = await checkERC20Allowance(
        OFFER_CURRENCY,
        account.address,
        MARKETPLACE_ADDRESS,
        THIRDWEB_CLIENT_ID,
      );

      if (allowance < offerInWei) {
        // Approve for 2x the amount for convenience
        const approvalAmount = offerInWei * 2n;

        await approveERC20(
          OFFER_CURRENCY,
          MARKETPLACE_ADDRESS,
          approvalAmount,
          account,
          THIRDWEB_CLIENT_ID,
        );
      }

      const transaction = prepareContractCall({
        contract,
        method:
          "function makeOffer((address,uint256,uint256,address,uint256,uint256)) returns (uint256)",
        params: [
          [
            ERC721_ADDRESS,
            BigInt(activeListing?.tokenId || 0),
            1n,
            OFFER_CURRENCY,
            offerInWei,
            BigInt(expirationSeconds),
          ],
        ],
      });

      await sendTransaction(transaction);

      setOfferAmount("");
      setExpirationDate("");

      toast({
        title: "Success!",
        description: "Offer made successfully!",
      });

      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to make offer";
      setOfferError(errorMsg);
      toast({
        title: "Error",
        description: errorMsg,
        variant: "destructive",
      });
    } finally {
      setIsOfferProcessing(false);
    }
  };

  // Show loading spinner while fetching listings and auctions
  if (listingsLoading || auctionsLoading) {
    return (
      <div className="w-full flex items-center justify-center py-12">
        <div className="text-center">
          <div className="inline-block mb-4">
            <div className="animate-spin">
              <div className="h-12 w-12 border-4 border-orange-300 border-t-orange-600 rounded-full"></div>
            </div>
          </div>
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">
            Loading listing...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 mb-6">
        <div className="w-full text-center">
          {activeAuction ? (
            <>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <p>{currentHighBid ? "Current High Bid" : "Minimum Bid"}</p>
              </label>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                $
                {(
                  Number(
                    BigInt(currentHighBid || activeAuction.minimumBidAmount)
                  ) / 1e18
                ).toFixed(2)}
              </p>
              {bidderUsername && (
                <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1">
                  by {bidderUsername}
                </p>
              )}
              <label className="text-sm text-slate-600 dark:text-slate-300 mt-2 block">
                <p>Buyout Price</p>
              </label>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">
                $
                {(
                  Number(BigInt(activeAuction.buyoutBidAmount)) / 1e18
                ).toFixed(2)}
              </p>
              {activeAuction.endTimestamp && (
                <>
                  <label className="text-sm text-slate-600 dark:text-slate-300 mt-2 block">
                    <p>Auction Ends In</p>
                  </label>
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-mono">
                    {countdownTime
                      ? `${countdownTime.days}d ${countdownTime.hours.toString().padStart(2, "0")}h ${countdownTime.minutes.toString().padStart(2, "0")}m ${countdownTime.seconds.toString().padStart(2, "0")}s`
                      : "Calculating..."}
                  </p>
                </>
              )}
              {auctionBids.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                    Auction Bids
                  </h3>
                  <div className="flex flex-wrap gap-4">
                    {auctionBids.map((bid, index) => (
                      <AuctionBidCard key={index} bid={bid} />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <label className="text-sm text-slate-600 dark:text-slate-300">
                <p>Asking Price</p>
              </label>
              <div className="relative flex items-center justify-end py-6" style={{ zIndex: 1 }}>
                <p
                  className="text-lg font-semibold text-slate-900 dark:text-white"
                  style={{
                    position: "absolute",
                    left: "50%",
                    transform: "translateX(-50%)",
                  }}
                >
                  ${listingPrice.toFixed(2)}
                </p>
                {viewerCount > 0 && (
                  <div className="flex items-center gap-2">
                    <TbEyeSearch
                      size={30}
                      className="text-slate-600 dark:text-slate-400"
                    />
                    <span
                      className="text-sm text-slate-700 dark:text-slate-300"
                      style={{ fontWeight: "300" }}
                    >
                      {viewerCount}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {activeAuction ? (
          isAuctionCreator ? (
            <>
              {cancelAuctionError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                  {cancelAuctionError}
                </div>
              )}
              <button
                onClick={handleCancelAuction}
                disabled={isCancelingAuction}
                className="w-full px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-medium rounded transition"
              >
                {isCancelingAuction ? "Submitting..." : "Cancel Auction"}
              </button>
            </>
          ) : (
            <>
              {bidError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                  {bidError}
                </div>
              )}
              <div>
                <label
                  htmlFor="bidAmount"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  <p>Bid Amount</p>
                </label>
                <input
                  id="bidAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  placeholder={
                    currentHighBid
                      ? `Higher Than: ${(Number(BigInt(currentHighBid)) / 1e18).toFixed(2)}`
                      : `Minimum: ${(Number(BigInt(activeAuction.minimumBidAmount)) / 1e18).toFixed(2)}`
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isBidProcessing}
                />
              </div>
              <button
                onClick={handlePlaceBid}
                disabled={isBidProcessing || isBidApproving || !bidAmount}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded transition"
              >
                {isBidApproving
                  ? "Approving Token..."
                  : isBidProcessing
                    ? "Placing Bid..."
                    : "Place Bid"}
              </button>
            </>
          )
        ) : buySuccess ? (
          <div className="text-center py-6">
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              Congratulations! Your purchase succeeded.
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Check your Collection page for your new relic.
            </p>
            <button
              onClick={() => navigate('/collection')}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded transition"
            >
              Collection
            </button>
          </div>
        ) : (
          <>
            {buyError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                {buyError}
              </div>
            )}
            <button
              onClick={handleBuyNow}
              disabled={isBuyProcessing}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded transition"
            >
              {isBuyProcessing ? "Processing..." : "Buy"}
            </button>

            {sortedOffers.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                  Current Offers
                </h3>
                <div className="flex flex-wrap gap-4">
                  {sortedOffers.map((offer) => {
                    const formattedPrice = formatOfferPrice(
                      offer.totalPrice,
                      offer.currency,
                      18
                    );
                    const username = offerorUsernames[offer.offeror];
                    return (
                      <div
                        key={offer.offerId}
                        className="flex flex-col items-center gap-1 w-[40px]"
                      >
                        <div className="w-[40px] h-[40px] rounded bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                        <p className="text-xs font-semibold text-slate-900 dark:text-white text-center">
                          {formattedPrice}
                        </p>
                        <p className="text-[10px] text-slate-600 dark:text-slate-400 text-center truncate max-w-[40px]">
                          {username || "Unknown"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-4">
              <div>
                <label
                  htmlFor="offerAmount"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  <p>Offer Amount</p>
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
                  disabled={isOfferProcessing}
                />
                {offerAmount && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    {Number(offerAmount) >= listingPrice
                      ? "Offer amount must be less than asking price"
                      : `Offer: $${Number(offerAmount).toFixed(2)}`}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  Offer Expiration
                </label>
                <input
                  id="expirationDate"
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isOfferProcessing}
                />
              </div>

              {offerError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                  {offerError}
                </div>
              )}

              <FilterStyleButton
                onClick={handleMakeOffer}
                disabled={isOfferProcessing || !offerAmount || !expirationDate}
                className="w-full px-3 py-1.5 text-sm"
              >
                {isOfferProcessing ? "Sending Offer..." : "Make Offer"}
              </FilterStyleButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
