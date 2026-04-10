import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { useActiveAccount } from "@/hooks/useThirdwebStubs";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import { useToast } from "@/hooks/use-toast";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import {
  getTokenDecimals,
  convertToTokenWei,
  checkERC20Allowance,
  approveERC20,
} from "@/lib/tokenUtils";
import { formatOfferPrice } from "@/lib/activeOffers";
import SerialCardMiniWrapper from "@/components/SerialCardMiniWrapper";
import { useEditionMetadata } from "@/hooks/useEditionMetadata";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { useAuctionBids } from "@/hooks/useAuctionBids";
import AuctionBidCard from "@/components/AuctionBidCard";
import { getUsernameForWalletAddress } from "@/lib/followeesService";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const OFFER_CURRENCY = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";
const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

export default function BuyOfferBidPage() {
  const navigate = useNavigate();
  const params = useParams<{ editionId?: string; serial?: string }>();
  const account = useActiveAccount();
  const { contract } = useMarketplace();
  const { listings: activeListings, loading: listingsLoading } =
    useActiveListings();
  const { auctions: activeAuctions, loading: auctionsLoading } =
    useActiveAuctions();
  const { toast } = useToast();

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
  const [cancelAuctionError, setCancelAuctionError] = useState<string | null>(
    null,
  );
  const [buySuccess, setBuySuccess] = useState(false);
  const [offerSuccess, setOfferSuccess] = useState(false);
  const [bidSuccess, setBidSuccess] = useState(false);
  const [cancelAuctionSuccess, setCancelAuctionSuccess] = useState(false);
  const [bidAmount, setBidAmount] = useState("");
  const [tokenDecimals, setTokenDecimals] = useState(18);
  const [offerorUsernames, setOfferorUsernames] = useState<
    Record<string, string | null>
  >({});
  const [cancelingOfferId, setCancelingOfferId] = useState<string | null>(null);
  const [cancelErrors, setCancelErrors] = useState<Record<string, string>>({});
  const [currentHighBid, setCurrentHighBid] = useState<string | null>(null);
  const [bidderAddress, setBidderAddress] = useState<string | null>(null);
  const [bidderUsername, setBidderUsername] = useState<string | null>(null);
  const [countdownTime, setCountdownTime] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);
  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);
  const [tokenIdFromSerial, setTokenIdFromSerial] = useState<string | null>(
    null,
  );

  const editionId = useMemo(
    () => (params.editionId ? parseInt(params.editionId, 10) : null),
    [params.editionId],
  );

  const serial = useMemo(
    () => (params.serial ? parseInt(params.serial, 10) : null),
    [params.serial],
  );

  const activeAuction = useMemo(() => {
    if (!editionId || serial === null || activeAuctions.length === 0) {
      return null;
    }

    return (
      activeAuctions.find(
        (auction) =>
          auction.editionId === editionId &&
          auction.serial === serial &&
          auction.status === "active",
      ) || null
    );
  }, [editionId, serial, activeAuctions]);

  const isAuctionCreator = useMemo(() => {
    if (!account || !activeAuction) {
      return false;
    }
    return (
      account.address.toLowerCase() ===
      activeAuction.auctionCreator.toLowerCase()
    );
  }, [account, activeAuction]);

  const { metadata: editionMetadata } = useEditionMetadata(editionId);

  useEffect(() => {
    if (!params.editionId) {
      setEditionData(null);
      setTokenIdFromSerial(null);
      return;
    }

    const editionIdNum = parseInt(params.editionId, 10);
    if (!Number.isFinite(editionIdNum)) {
      setEditionData(null);
      setTokenIdFromSerial(null);
      return;
    }

    const loadEditionData = async () => {
      try {
        const data = await fetchMintedByEditionId(editionIdNum);
        setEditionData(data);

        // Also fetch token_id from RelicSerialsJoined
        if (params.serial) {
          const serialNum = parseInt(params.serial, 10);
          if (Number.isFinite(serialNum)) {
            try {
              const serialData = await fetchRelicSerialByEditionAndSerial(
                editionIdNum,
                serialNum,
              );
              if (serialData?.token_id) {
                setTokenIdFromSerial(String(serialData.token_id));
              } else if (serialData?.tokenId) {
                setTokenIdFromSerial(String(serialData.tokenId));
              }
            } catch (err) {
            }
          }
        }
      } catch (err) {
        setEditionData(null);
      }
    };

    loadEditionData();
  }, [params.editionId, params.serial]);

  const currentTokenId = useMemo(() => {
    const fromListing = activeListings.find(
      (l) => l.editionId === editionId && l.serial === serial,
    )?.tokenId;
    return fromListing || tokenIdFromSerial;
  }, [editionId, serial, activeListings, tokenIdFromSerial]);

  const { offers, formattedHighestOffer } = useActiveOffers(currentTokenId);

  const { data: auctionBids = [] } = useAuctionBids(
    activeAuction?.auctionId ?? null,
  );

  const sortedOffers = useMemo(() => {
    if (!currentTokenId) return [];

    const tokenOffers = offers.filter(
      (offer) => offer.tokenId === currentTokenId,
    );

    return tokenOffers.sort((a, b) => {
      const priceCompare = BigInt(b.totalPrice) - BigInt(a.totalPrice);
      if (priceCompare !== 0n) return Number(priceCompare > 0n ? 1 : -1);
      return Number(BigInt(a.offerId) - BigInt(b.offerId));
    });
  }, [offers, currentTokenId]);

  const activeListing = useMemo(() => {
    if (!editionId || serial === null || activeListings.length === 0) {
      return null;
    }

    return activeListings.find(
      (listing) => listing.editionId === editionId && listing.serial === serial,
    );
  }, [editionId, serial, activeListings]);

  // Fetch token decimals when listing or auction currency changes
  useEffect(() => {
    const currency =
      activeAuction?.currency || activeListing?.currency || OFFER_CURRENCY;

    const tokenCurrency = currency || NATIVE_TOKEN_ADDRESS;

    async function fetchDecimals() {
      if (tokenCurrency === NATIVE_TOKEN_ADDRESS) {
        setTokenDecimals(18);
        return;
      }

      try {
        const decimals = await getTokenDecimals(tokenCurrency);
        setTokenDecimals(decimals);
      } catch (error) {
        console.error("Failed to fetch token decimals:", error);
        setTokenDecimals(18);
      }
    }

    fetchDecimals();
  }, [activeAuction?.currency, activeListing?.currency]);

  // Fetch winning bid when auction changes
  useEffect(() => {
    const fetchWinningBid = async () => {
      if (!activeAuction) {
        setCurrentHighBid(null);
        return;
      }

      try {
        console.log(
          "[fetchWinningBid] Attempting to fetch winning bid for auction:",
          activeAuction.auctionId,
        );

        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const winningBid = await readContract({
          contract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(activeAuction.auctionId)],
        });

        console.log("[fetchWinningBid] Response:", winningBid);

        if (
          winningBid &&
          Array.isArray(winningBid) &&
          winningBid.length >= 3 &&
          winningBid[2]
        ) {
          console.log(
            "[fetchWinningBid] Setting current high bid:",
            String(winningBid[2]),
          );
          console.log("[fetchWinningBid] Bidder address:", winningBid[0]);
          setCurrentHighBid(String(winningBid[2]));
          setBidderAddress(String(winningBid[0]));
        } else {
          console.log("[fetchWinningBid] No valid winning bid found");
          setCurrentHighBid(null);
          setBidderAddress(null);
        }
      } catch (err) {
        console.error("[fetchWinningBid] Error:", err);
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
        const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
        const anonKey =
          (import.meta.env.SUPABASE_ANON_KEY as string) || "";

        if (!baseUrl || !anonKey) {
          return;
        }

        const root = baseUrl.replace(/\/$/, "");
        const url = `${root}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(bidderAddress)}&select=username`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (response.ok) {
          const data = (await response.json()) as Array<{ username?: string }>;
          const username = data[0]?.username || null;
          console.log("[fetchBidderUsername]", bidderAddress, ":", username);
          setBidderUsername(username);
        } else {
          console.error(
            `[fetchBidderUsername] Failed to fetch ${bidderAddress}: ${response.status}`,
          );
          setBidderUsername(null);
        }
      } catch (err) {
        console.error("[fetchBidderUsername] Error:", err);
        setBidderUsername(null);
      }
    };

    fetchBidderUsername();
  }, [bidderAddress]);

  // Update countdown timer
  useEffect(() => {
    if (!activeAuction || !activeAuction.endTimestamp) {
      setCountdownTime(null);
      return;
    }

    const updateCountdown = () => {
      const now = Date.now();
      const endTime = activeAuction.endTimestamp * 1000;
      const diff = endTime - now;

      if (diff <= 0) {
        setCountdownTime({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdownTime({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [activeAuction?.endTimestamp]);

  // Fetch usernames for all offerors
  useEffect(() => {
    const fetchOfferorUsernames = async () => {
      if (sortedOffers.length === 0) {
        setOfferorUsernames({});
        return;
      }

      const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
      const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

      if (!baseUrl || !anonKey) {
        return;
      }

      const usernames: Record<string, string | null> = {};
      const root = baseUrl.replace(/\/$/, "");

      for (const offer of sortedOffers) {
        try {
          const url = `${root}/rest/v1/profiles?wallet_address=eq.${encodeURIComponent(offer.offeror)}&select=username`;
          const response = await fetch(url, {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
          });

          if (response.ok) {
            const data = (await response.json()) as Array<{
              username?: string;
            }>;
            usernames[offer.offeror] = data[0]?.username || null;
            console.log(
              `[fetchOfferorUsernames] ${offer.offeror}:`,
              data[0]?.username || null,
            );
          } else {
            console.error(
              `[fetchOfferorUsernames] Failed to fetch ${offer.offeror}: ${response.status}`,
            );
            usernames[offer.offeror] = null;
          }
        } catch (error) {
          console.error(
            `Failed to fetch username for ${offer.offeror}:`,
            error,
          );
          usernames[offer.offeror] = null;
        }
      }

      setOfferorUsernames(usernames);
    };

    fetchOfferorUsernames();
  }, [sortedOffers]);

  const listingPrice = useMemo(() => {
    if (!activeListing) return 0;
    const divisor = 10 ** tokenDecimals;
    return Number(BigInt(activeListing.pricePerToken)) / divisor;
  }, [activeListing, tokenDecimals]);

  // Redirect after success
  useEffect(() => {
    if (buySuccess) {
      const timer = setTimeout(async () => {
        if (account) {
          // Fetch username for wallet address, fall back to address if not found
          const username = await getUsernameForWalletAddress(account.address);
          navigate(
            `/collection/${encodeURIComponent(username || account.address)}`,
          );
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [buySuccess, account, navigate]);

  useEffect(() => {
    if (offerSuccess) {
      const timer = setTimeout(() => {
        navigate(`/edition/${editionId}/serial/${serial}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [offerSuccess, editionId, serial, navigate]);

  useEffect(() => {
    if (bidSuccess) {
      const timer = setTimeout(() => {
        navigate(`/edition/${editionId}/serial/${serial}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [bidSuccess, editionId, serial, navigate]);

  useEffect(() => {
    if (cancelAuctionSuccess) {
      const timer = setTimeout(() => {
        navigate(`/edition/${editionId}/serial/${serial}`);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [cancelAuctionSuccess, editionId, serial, navigate]);

  const handleBuyNow = async () => {
    try {
      setBuyError(null);
      setIsBuyProcessing(true);

      if (!account) {
        throw new Error("Please connect your wallet first");
      }

      if (!contract || !activeListing) {
        throw new Error("Listing not found");
      }

      const listingCurrency = activeListing.currency || NATIVE_TOKEN_ADDRESS;
      const listingPrice_BigInt = BigInt(activeListing.pricePerToken);
      const listingPrice = Number(listingPrice_BigInt) / 1e18;

      console.log("[BuyNow] Debug info:", {
        listingId: activeListing.listingId,
        buyFor: account.address,
        quantity: 1,
        currency: listingCurrency,
        expectedTotalPrice: activeListing.pricePerToken,
      });

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
        console.log(
          "[BuyNow] Checking approval for ERC-20 token:",
          listingCurrency,
        );

        const currentAllowance = await checkERC20Allowance(
          listingCurrency,
          account.address,
          MARKETPLACE_ADDRESS,
          THIRDWEB_CLIENT_ID,
        );

        console.log(
          "[BuyNow] Current allowance:",
          currentAllowance.toString(),
          "Required:",
          listingPrice_BigInt.toString(),
        );

        if (currentAllowance < listingPrice_BigInt) {
          console.log("[BuyNow] Requesting approval from user...");
          setBuyError(null);

          // Request approval for the amount (with a small buffer)
          const approvalAmount = listingPrice_BigInt * 2n; // Approve for 2x the price for convenience

          await approveERC20(
            listingCurrency,
            MARKETPLACE_ADDRESS,
            approvalAmount,
            account,
            THIRDWEB_CLIENT_ID,
          );

          console.log("[BuyNow] Approval granted. Proceeding with purchase...");
        }
      }

      const transaction = prepareContractCall({
        contract,
        method:
          "function buyFromListing(uint256 _listingId, address _buyFor, uint256 _quantity, address _currency, uint256 _expectedTotalPrice) payable",
        params: [
          BigInt(activeListing.listingId),
          account.address,
          1n,
          listingCurrency,
          listingPrice_BigInt,
        ],
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      setBuySuccess(true);
    } catch (error) {
      console.error("[BuyOfferBid] Buy Error:", error);
      let errorMessage = "Failed to buy NFT. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more helpful error messages (but preserve specific balance checks)
        if (
          errorMessage.includes("AA21") ||
          errorMessage.includes("didn't pay prefund") ||
          errorMessage.includes("prefund")
        ) {
          errorMessage =
            "Insufficient gas funds. Your account needs more MATIC to cover gas fees. Please add MATIC to your wallet and try again.";
        } else if (
          errorMessage.includes("insufficient") ||
          errorMessage.includes("balance")
        ) {
          // If this fallback is hit, it means a transaction failed due to balance
          // Our pre-check should have caught this, but provide a helpful message anyway
          if (!errorMessage.includes("Insufficient balance")) {
            errorMessage = `Insufficient balance. You need $${listingPrice.toFixed(2)} to buy this listing. Please add more to your wallet to complete this transaction.`;
          }
        } else if (
          errorMessage.includes("approval") ||
          errorMessage.includes("approved")
        ) {
          errorMessage =
            "Please approve the marketplace to spend your tokens first.";
        }
      }

      setBuyError(errorMessage);
      setIsBuyProcessing(false);
    }
  };

  const handleMakeOffer = async () => {
    try {
      setOfferError(null);
      setIsOfferProcessing(true);

      if (!account) {
        throw new Error("Please connect your wallet first");
      }

      if (!contract) {
        throw new Error("Marketplace not initialized");
      }

      if (!editionId || serial === null) {
        throw new Error("Edition or serial information is missing");
      }

      const amount = parseFloat(offerAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid offer amount");
      }

      // Only check against listing price if there's an active listing
      if (activeListing && amount >= listingPrice) {
        throw new Error(
          "Offer amount must be less than the asking price. Use Buy instead.",
        );
      }

      if (!expirationDate) {
        throw new Error("Please select an expiration date for your offer");
      }

      const expirationTimestamp = Math.floor(
        new Date(expirationDate).getTime() / 1000,
      );
      const now = Math.floor(Date.now() / 1000);

      if (expirationTimestamp <= now) {
        throw new Error("Expiration date must be in the future");
      }

      // Use the token ID from the active listing if available, otherwise from RelicSerialsJoined
      let listingTokenId: bigint;
      if (activeListing) {
        listingTokenId = BigInt(activeListing.tokenId);
      } else if (tokenIdFromSerial) {
        listingTokenId = BigInt(tokenIdFromSerial);
      } else {
        throw new Error(
          "Token ID not found. Cannot create offer for this relic.",
        );
      }

      // Use the currency from active listing if available, otherwise use the default offer currency for Polygon
      const listingCurrency = activeListing?.currency || OFFER_CURRENCY;

      // Use the token decimals we already fetched
      const offerAmountInWei = convertToTokenWei(amount, tokenDecimals);

      console.log("[MakeOffer] Debug info:", {
        assetContract: ERC721_ADDRESS,
        tokenId: listingTokenId.toString(),
        quantity: 1,
        currency: listingCurrency,
        decimals: tokenDecimals,
        offerAmount: amount,
        totalPrice: offerAmountInWei.toString(),
        expirationTimestamp: expirationTimestamp,
      });

      // Check balance before attempting transaction
      if (listingCurrency !== NATIVE_TOKEN_ADDRESS) {
        const offerCurrencyContract = getContract({
          address: listingCurrency,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const balance = await readContract({
          contract: offerCurrencyContract,
          method: "function balanceOf(address account) view returns (uint256)",
          params: [account.address],
        });

        const balanceInTokens = Number(balance) / 1e18;
        if (balanceInTokens < amount) {
          throw new Error(
            `Insufficient balance. You have $${balanceInTokens.toFixed(2)} but need $${amount.toFixed(2)} to make this offer. Please add more to your wallet to complete this transaction.`,
          );
        }
      }

      // Check and request approval for ERC-20 tokens
      if (listingCurrency !== NATIVE_TOKEN_ADDRESS) {
        console.log(
          "[MakeOffer] Checking approval for ERC-20 token:",
          listingCurrency,
        );

        const currentAllowance = await checkERC20Allowance(
          listingCurrency,
          account.address,
          MARKETPLACE_ADDRESS,
          THIRDWEB_CLIENT_ID,
        );

        console.log(
          "[MakeOffer] Current allowance:",
          currentAllowance.toString(),
          "Required:",
          offerAmountInWei.toString(),
        );

        if (currentAllowance < offerAmountInWei) {
          console.log("[MakeOffer] Requesting approval from user...");
          setOfferError(null);

          // Request approval for the amount (with a small buffer)
          const approvalAmount = offerAmountInWei * 2n; // Approve for 2x the offer amount for convenience

          await approveERC20(
            listingCurrency,
            MARKETPLACE_ADDRESS,
            approvalAmount,
            account,
            THIRDWEB_CLIENT_ID,
          );

          console.log("[MakeOffer] Approval granted. Proceeding with offer...");
        }
      }

      const transaction = prepareContractCall({
        contract,
        method:
          "function makeOffer((address,uint256,uint256,address,uint256,uint256)) returns (uint256)",
        params: [
          [
            ERC721_ADDRESS,
            listingTokenId,
            1n,
            listingCurrency,
            offerAmountInWei,
            BigInt(expirationTimestamp),
          ],
        ],
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      setOfferSuccess(true);
    } catch (error) {
      console.error("[BuyOfferBid] Offer Error:", error);
      let errorMessage = "Failed to create offer. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more helpful error messages (but preserve specific balance checks)
        if (
          errorMessage.includes("AA21") ||
          errorMessage.includes("didn't pay prefund") ||
          errorMessage.includes("prefund")
        ) {
          errorMessage =
            "Insufficient gas funds. Your account needs more MATIC to cover gas fees. Please add MATIC to your wallet and try again.";
        } else if (
          errorMessage.includes("insufficient") ||
          errorMessage.includes("balance")
        ) {
          // If this fallback is hit, it means a transaction failed due to balance
          // Our pre-check should have caught this, but provide a helpful message anyway
          if (!errorMessage.includes("Insufficient balance")) {
            errorMessage = `Insufficient balance. You need $${offerAmount.toFixed(2)} to make this offer. Please add more to your wallet to complete this transaction.`;
          }
        } else if (
          errorMessage.includes("approval") ||
          errorMessage.includes("approved")
        ) {
          errorMessage =
            "Please approve the marketplace to spend your tokens first.";
        }
      }

      setOfferError(errorMessage);
      setIsOfferProcessing(false);
    }
  };

  const handleCancelOffer = async (offerId: string) => {
    try {
      setCancelErrors((prev) => ({ ...prev, [offerId]: "" }));
      setCancelingOfferId(offerId);

      if (!account) {
        throw new Error("Wallet not connected");
      }

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const marketplaceContract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract: marketplaceContract,
        method: "function cancelOffer(uint256 _offerId)",
        params: [BigInt(offerId)],
      });

      const transactionResult = await sendAndConfirmTransaction({
        account,
        transaction,
      });

      console.log("Offer canceled successfully:", transactionResult);

      // Show success message
      toast({
        title: "Success",
        description: "Offer canceled successfully",
      });

      // Refetch offers by triggering a page reload or state update
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      let errorMessage =
        err instanceof Error ? err.message : "Failed to cancel offer";

      if (err instanceof Error) {
        if (
          errorMessage.includes("AA21") ||
          errorMessage.includes("didn't pay prefund") ||
          errorMessage.includes("prefund")
        ) {
          errorMessage =
            "Insufficient gas funds. Your account needs more MATIC to cover gas fees. Please add MATIC to your wallet and try again.";
        }
      }

      setCancelErrors((prev) => ({ ...prev, [offerId]: errorMessage }));
      console.error("Error canceling offer:", err);
    } finally {
      setCancelingOfferId(null);
    }
  };

  const handlePlaceBid = async () => {
    try {
      setBidError(null);
      setIsBidProcessing(true);

      if (!account) {
        throw new Error("Please connect your wallet first");
      }

      if (!contract || !activeAuction) {
        console.error("[PlaceBid] Missing contract or auction:", {
          contractExists: !!contract,
          auctionExists: !!activeAuction,
          contractAddress: contract?.getAddress?.(),
        });
        throw new Error("Auction not found");
      }

      console.log("[PlaceBid] Auction details:", {
        auctionId: activeAuction.auctionId,
        editionId: activeAuction.editionId,
        serial: activeAuction.serial,
        status: activeAuction.status,
        currency: activeAuction.currency,
      });

      const amount = parseFloat(bidAmount);
      if (isNaN(amount) || amount <= 0) {
        throw new Error("Please enter a valid bid amount");
      }

      const minimumBid = Number(BigInt(activeAuction.minimumBidAmount)) / 1e18;

      // Determine the minimum bid requirement based on whether there's a current high bid
      let minimumRequiredBid = minimumBid;
      if (currentHighBid) {
        const currentHighBidAmount = Number(BigInt(currentHighBid)) / 1e18;
        minimumRequiredBid = currentHighBidAmount;
      }

      if (amount <= minimumRequiredBid) {
        const minErrorAmount = currentHighBid
          ? Number(BigInt(currentHighBid)) / 1e18
          : minimumBid;
        throw new Error(
          `Your bid must be higher than $${minErrorAmount.toFixed(2)}. Please enter a higher amount.`,
        );
      }

      // Use auction currency, but fallback to OFFER_CURRENCY if empty
      // (auctions in this marketplace use ERC20, not native POL)
      const auctionCurrency =
        activeAuction.currency && activeAuction.currency.trim() !== ""
          ? activeAuction.currency
          : OFFER_CURRENCY;
      const isERC20Auction = auctionCurrency !== NATIVE_TOKEN_ADDRESS;

      // Check balance before attempting transaction
      const auctionCurrencyContract = getContract({
        address: auctionCurrency,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const balance = await readContract({
        contract: auctionCurrencyContract,
        method: "function balanceOf(address account) view returns (uint256)",
        params: [account.address],
      });

      const balanceInTokens = Number(balance) / 1e18;
      if (balanceInTokens < amount) {
        throw new Error(
          `Insufficient balance. You have $${balanceInTokens.toFixed(2)} but need $${amount.toFixed(2)} to place this bid. Please add more to your wallet to complete this transaction.`,
        );
      }

      // Use the token decimals we already fetched
      const bidAmountInWei = convertToTokenWei(amount, tokenDecimals);

      console.log("[PlaceBid] Debug info:", {
        auctionId: activeAuction.auctionId,
        bidder: account.address,
        bidAmount: amount,
        bidAmountInWei: bidAmountInWei.toString(),
        currency: auctionCurrency,
        decimals: tokenDecimals,
        isERC20: isERC20Auction,
      });

      // Check and request approval for ERC-20 tokens
      if (isERC20Auction) {
        console.log(
          "[PlaceBid] Checking approval for ERC-20 token:",
          auctionCurrency,
        );

        const currentAllowance = await checkERC20Allowance(
          auctionCurrency,
          account.address,
          MARKETPLACE_ADDRESS,
          THIRDWEB_CLIENT_ID,
        );

        console.log(
          "[PlaceBid] Current allowance:",
          currentAllowance.toString(),
          "Required:",
          bidAmountInWei.toString(),
        );

        if (currentAllowance < bidAmountInWei) {
          console.log(
            "[PlaceBid] Approval required. Current allowance:",
            currentAllowance.toString(),
            "Required:",
            bidAmountInWei.toString(),
          );
          console.log("[PlaceBid] Requesting approval from user...");
          setBidError(null);
          setIsBidApproving(true);

          // Request approval for the amount (with a small buffer)
          const approvalAmount = bidAmountInWei * 2n; // Approve for 2x the bid amount for convenience

          try {
            console.log("[PlaceBid] Calling approveERC20 with:", {
              tokenAddress: auctionCurrency,
              spender: MARKETPLACE_ADDRESS,
              amount: approvalAmount.toString(),
              accountAddress: account.address,
            });

            await approveERC20(
              auctionCurrency,
              MARKETPLACE_ADDRESS,
              approvalAmount,
              account,
              THIRDWEB_CLIENT_ID,
            );

            console.log(
              "[PlaceBid] Approval transaction submitted. Waiting for block confirmation...",
            );

            // Verify the allowance was actually set after approval
            let verificationAttempts = 0;
            const maxAttempts = 5;
            let approvalVerified = false;

            while (verificationAttempts < maxAttempts && !approvalVerified) {
              verificationAttempts++;
              // Wait longer for the blockchain to process
              const waitTime = verificationAttempts === 1 ? 2000 : 3000;
              console.log(
                `[PlaceBid] Verification attempt ${verificationAttempts}/${maxAttempts}: Waiting ${waitTime}ms...`,
              );
              await new Promise((resolve) => setTimeout(resolve, waitTime));

              try {
                const updatedAllowance = await checkERC20Allowance(
                  auctionCurrency,
                  account.address,
                  MARKETPLACE_ADDRESS,
                  THIRDWEB_CLIENT_ID,
                );

                console.log(
                  `[PlaceBid] Verification attempt ${verificationAttempts}: Token contract=${auctionCurrency}, Spender=${MARKETPLACE_ADDRESS}, Updated allowance:`,
                  updatedAllowance.toString(),
                  "Required:",
                  bidAmountInWei.toString(),
                );

                if (updatedAllowance >= bidAmountInWei) {
                  approvalVerified = true;
                  console.log(
                    "[PlaceBid] ✓ Approval verified! Allowance is sufficient. Proceeding with bid...",
                  );
                }
              } catch (verifyErr) {
                console.error(
                  `[PlaceBid] Verification attempt ${verificationAttempts} failed:`,
                  verifyErr,
                );
              }
            }

            if (!approvalVerified) {
              console.error(
                "[PlaceBid] ✗ Approval verification failed after all attempts",
              );
              throw new Error(
                "Approval transaction was submitted but the allowance could not be verified. Please wait a moment and try again, or check that your wallet is properly connected.",
              );
            }
          } catch (approvalErr) {
            console.error("[PlaceBid] ✗ Approval error:", approvalErr);
            setIsBidApproving(false);
            throw new Error(
              `Failed to approve marketplace to spend your ERC20 tokens. Error: ${approvalErr instanceof Error ? approvalErr.message : String(approvalErr)}`,
            );
          } finally {
            setIsBidApproving(false);
          }
        } else {
          console.log(
            "[PlaceBid] Allowance already sufficient. Skipping approval.",
          );
        }
      }

      console.log("[PlaceBid] Preparing transaction with:", {
        auctionId: activeAuction.auctionId,
        auctionIdBigInt: BigInt(activeAuction.auctionId),
        bidAmount: bidAmount,
        bidAmountInWei: bidAmountInWei.toString(),
        contractAddress: contract?.getAddress?.(),
        isERC20: isERC20Auction,
      });

      let transaction = prepareContractCall({
        contract,
        method:
          "function bidInAuction(uint256 _auctionId, uint256 _bidAmount) payable",
        params: [BigInt(activeAuction.auctionId), bidAmountInWei],
      });

      // For ERC20 auctions, explicitly set value to 0 to prevent native POL transfer
      if (isERC20Auction) {
        transaction = {
          ...transaction,
          value: 0n,
        };
      }

      console.log("[PlaceBid] Transaction prepared:", {
        transactionData: transaction,
        value: transaction.value?.toString?.() || "0",
      });

      await sendAndConfirmTransaction({
        transaction,
        account,
      });

      setBidSuccess(true);
    } catch (error) {
      console.error("[BuyOfferBid] Bid Error:", error);
      let errorMessage = "Failed to place bid. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more helpful error messages (but preserve specific balance checks)
        if (
          errorMessage.includes("AA21") ||
          errorMessage.includes("didn't pay prefund") ||
          errorMessage.includes("prefund")
        ) {
          errorMessage =
            "Insufficient gas funds. Your account needs more MATIC to cover gas fees. Please add MATIC to your wallet and try again.";
        } else if (
          errorMessage.includes("insufficient") ||
          errorMessage.includes("balance")
        ) {
          // If this fallback is hit, it means a transaction failed due to balance
          // Our pre-check should have caught this, but provide a helpful message anyway
          if (!errorMessage.includes("Insufficient balance")) {
            errorMessage = `Insufficient balance. You need $${bidAmount.toFixed(2)} to place this bid. Please add more to your wallet to complete this transaction.`;
          }
        } else if (
          errorMessage.includes("approval") ||
          errorMessage.includes("approved")
        ) {
          errorMessage =
            "Please approve the marketplace to spend your tokens first.";
        } else if (
          errorMessage.includes("Cannot decode zero data") ||
          errorMessage.includes("0x")
        ) {
          errorMessage =
            "Transaction reverted. Ensure you have approved the marketplace to spend your ERC20 tokens and try again.";
        } else if (errorMessage.includes("Encoded error signature")) {
          errorMessage =
            "Your bid may have been outbid. Please check the current bid and try again with a higher amount.";
        } else if (
          errorMessage.includes("not winning") ||
          errorMessage.includes("winning bid")
        ) {
          errorMessage =
            "Your bid is not higher than the current highest bid. Please enter a higher amount.";
        }
      }

      // If we get an error, refresh the current high bid in case it changed
      // This helps with race conditions when multiple users are bidding
      try {
        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client: {
            clientId: THIRDWEB_CLIENT_ID,
          },
        });

        const winningBid = await readContract({
          contract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(activeAuction?.auctionId || 0)],
        });

        if (
          winningBid &&
          Array.isArray(winningBid) &&
          winningBid.length >= 3 &&
          winningBid[2]
        ) {
          setCurrentHighBid(String(winningBid[2]));
          setBidderAddress(String(winningBid[0]));
        }
      } catch (refreshErr) {
        console.error("[PlaceBid] Could not refresh high bid:", refreshErr);
      }

      setBidError(errorMessage);
      setIsBidProcessing(false);
    }
  };

  const handleCancelAuction = async () => {
    try {
      setCancelAuctionError(null);
      setIsCancelingAuction(true);

      if (!account) {
        throw new Error("Please connect your wallet first");
      }

      if (!activeAuction) {
        throw new Error("Auction not found");
      }

      const MARKETPLACE_ADDRESS =
        import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
      const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

      if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
        throw new Error("Marketplace configuration is missing");
      }

      const marketplaceContract = await getContract({
        address: MARKETPLACE_ADDRESS,
        chain: polygon,
        client: {
          clientId: THIRDWEB_CLIENT_ID,
        },
      });

      const transaction = prepareContractCall({
        contract: marketplaceContract,
        method: "function cancelAuction(uint256 _auctionId)",
        params: [BigInt(activeAuction.auctionId)],
      });

      await sendAndConfirmTransaction({
        account,
        transaction,
      });

      setCancelAuctionSuccess(true);
    } catch (error) {
      console.error("[BuyOfferBid] Cancel Auction Error:", error);
      let errorMessage = "Failed to cancel auction. Please try again.";

      if (error instanceof Error) {
        errorMessage = error.message;

        if (
          errorMessage.includes("AA21") ||
          errorMessage.includes("didn't pay prefund") ||
          errorMessage.includes("prefund")
        ) {
          errorMessage =
            "Insufficient gas funds. Your account needs more MATIC to cover gas fees. Please add MATIC to your wallet and try again.";
        }
      }

      setCancelAuctionError(errorMessage);
      setIsCancelingAuction(false);
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

  // Show loading spinner while fetching listings and auctions
  if (listingsLoading || auctionsLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
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

  if (!activeAuction && !activeListing) {
    // Show offer form even when there's no active listing
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-[12px] dark:text-white lg:order-1 lg:col-start-1 lg:col-end-2">
            Make an Offer
          </h1>

          {editionData && params.serial && (
            <h6 className="text-sm text-slate-600 dark:text-slate-400 text-center mx-auto sm:text-left sm:mx-0 mb-1 sm:mb-8 lg:order-2 lg:col-start-1 lg:col-end-2">
              <span className="whitespace-nowrap">
                {editionData.PlayerName}
              </span>
              {" - "}
              <span className="whitespace-nowrap">
                #{params.serial} of {editionData.Minted}
              </span>
              {" - "}
              <span className="whitespace-nowrap">{editionData.TierValue}</span>
              {" - "}
              <span className="whitespace-nowrap">{editionData.GameDate}</span>
              {" - "}
              <span className="whitespace-nowrap">{editionData.SetName}</span>
              {" - "}
              <span className="whitespace-nowrap">
                {editionData.SeriesName}
              </span>
            </h6>
          )}

          {editionId && serial && (
            <div className="mb-4 lg:order-3 lg:sticky lg:top-8 lg:col-start-1 lg:col-end-2">
              <SerialCardMiniWrapper
                id={editionId}
                name={editionMetadata?.name}
                thumb={editionMetadata?.thumb}
                serial={serial}
                minted={editionData?.Minted || null}
                gameDate={editionMetadata?.gameDate}
                createDate={editionMetadata?.createDate}
                setName={editionMetadata?.setName}
                badge={editionMetadata?.badge}
                badge2={editionMetadata?.badge2}
                badge3={editionMetadata?.badge3}
                team={editionMetadata?.team}
              />
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 max-sm:shadow-[2px_2px_3px_1px_rgba(155,155,155,1)] lg:order-4 lg:col-start-2 lg:row-start-1 lg:row-end-4">
            <div className="space-y-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  No active listing for this relic
                </p>
              </div>

              {offerError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-3 rounded text-sm">
                  {offerError}
                </div>
              )}

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
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isOfferProcessing}
                />
              </div>

              <div>
                <label
                  htmlFor="expirationDate"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                >
                  <p>Offer Expiration</p>
                </label>
                <input
                  id="expirationDate"
                  type="datetime-local"
                  value={expirationDate}
                  onChange={(e) => setExpirationDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isOfferProcessing}
                />
              </div>

              <button
                onClick={handleMakeOffer}
                disabled={isOfferProcessing || !offerAmount || !expirationDate}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium rounded transition"
              >
                {isOfferProcessing ? "Submitting..." : "Make Offer"}
              </button>

              <button
                onClick={() =>
                  navigate(`/edition/${editionId}/serial/${serial}`)
                }
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (cancelAuctionSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">Success!</h2>
          <p className="text-slate-600 dark:text-slate-300">
            Auction canceled. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (bidSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Bid Placed!
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Your bid has been submitted. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  if (buySuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Buy Successful!
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Your Relic has been purchased. Redirecting to your collection...
          </p>
        </div>
      </div>
    );
  }

  if (offerSuccess) {
    return (
      <div className="w-full max-w-md mx-auto p-6">
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 text-center">
          <h2 className="text-2xl font-bold text-green-600 mb-4">
            Offer Submitted!
          </h2>
          <p className="text-slate-600 dark:text-slate-300">
            Your offer has been created. Redirecting...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
      <div className="max-w-6xl mx-auto lg:grid lg:grid-cols-2 lg:gap-6">
        <h1 className="text-3xl font-bold mb-[12px] dark:text-white lg:order-1 lg:col-start-1 lg:col-end-2">
          {activeAuction ? "Bid on Auction" : "Buy or Manage Offers"}
        </h1>

        {editionData && params.serial && (
          <h6 className="text-sm text-slate-600 dark:text-slate-400 text-center mx-auto sm:text-left sm:mx-0 mb-1 sm:mb-8 lg:order-2 lg:col-start-1 lg:col-end-2">
            <span className="whitespace-nowrap">{editionData.PlayerName}</span>
            {" - "}
            <span className="whitespace-nowrap">
              #{params.serial} of {editionData.Minted}
            </span>
            {" - "}
            <span className="whitespace-nowrap">{editionData.TierValue}</span>
            {" - "}
            <span className="whitespace-nowrap">{editionData.GameDate}</span>
            {" - "}
            <span className="whitespace-nowrap">{editionData.SetName}</span>
            {" - "}
            <span className="whitespace-nowrap">{editionData.SeriesName}</span>
          </h6>
        )}

        {editionId && serial && (
          <div className="mb-4 lg:order-3 lg:sticky lg:top-8 lg:col-start-1 lg:col-end-2">
            <SerialCardMiniWrapper
              id={editionId}
              name={editionMetadata?.name}
              thumb={editionMetadata?.thumb}
              serial={serial}
              minted={editionData?.Minted || null}
              gameDate={editionMetadata?.gameDate}
              createDate={editionMetadata?.createDate}
              setName={editionMetadata?.setName}
              badge={editionMetadata?.badge}
              badge2={editionMetadata?.badge2}
              badge3={editionMetadata?.badge3}
              team={editionMetadata?.team}
            />
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 max-sm:shadow-[2px_2px_3px_1px_rgba(155,155,155,1)] lg:order-4 lg:col-start-2 lg:row-start-1 lg:row-end-4">
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
                        BigInt(
                          currentHighBid || activeAuction.minimumBidAmount,
                        ),
                      ) / 1e18
                    ).toFixed(2)}
                  </p>
                  {bidderUsername && (
                    <p className="text-xs italic text-slate-500 dark:text-slate-400 mt-1 max-sm:-mt-1.5 max-sm:text-[10px]">
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
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-mono max-sm:[color:rgba(245,166,35,1)] max-sm:[text-shadow:1px_1px_22px_rgba(0,0,0,1)]">
                        {countdownTime ? (
                          <span>
                            {countdownTime.days > 0 && (
                              <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                                {countdownTime.days}d{" "}
                              </span>
                            )}
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              {countdownTime.hours.toString().padStart(2, "0")}
                            </span>
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              h
                            </span>
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              {" "}
                              {countdownTime.minutes
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              m
                            </span>
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              {" "}
                              {countdownTime.seconds
                                .toString()
                                .padStart(2, "0")}
                            </span>
                            <span className="max-sm:font-semibold max-sm:[text-shadow:1px_1px_42px_rgba(0,0,0,1)]">
                              s
                            </span>
                          </span>
                        ) : (
                          "Calculating..."
                        )}
                      </p>
                    </>
                  )}
                  {auctionBids.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 sm:mb-4">
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
                  <p className="text-lg font-semibold text-slate-900 dark:text-white">
                    ${listingPrice.toFixed(2)}
                  </p>
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

                  <button
                    onClick={() => navigate(-1)}
                    className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
                  >
                    Go Back
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
                    {!bidAmount && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {currentHighBid
                          ? `Higher Than: $${(Number(BigInt(currentHighBid)) / 1e18).toFixed(2)}`
                          : `Minimum: $${(Number(BigInt(activeAuction.minimumBidAmount)) / 1e18).toFixed(2)}`}
                      </p>
                    )}
                    {bidAmount && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        {Number(bidAmount) <
                        Number(
                          currentHighBid
                            ? BigInt(currentHighBid)
                            : BigInt(activeAuction.minimumBidAmount),
                        ) /
                          1e18
                          ? `Bid must be higher than $${(Number(currentHighBid ? BigInt(currentHighBid) : BigInt(activeAuction.minimumBidAmount)) / 1e18).toFixed(2)}`
                          : `Bid: $${Number(bidAmount).toFixed(2)}`}
                      </p>
                    )}
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

                  <button
                    onClick={() =>
                      navigate(`/edition/${editionId}/serial/${serial}`)
                    }
                    className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
                  >
                    Cancel
                  </button>
                </>
              )
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
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1 sm:mb-4">
                      Current Offers
                    </h3>
                    <div className="flex flex-wrap gap-4">
                      {sortedOffers.map((offer) => {
                        const formattedPrice = formatOfferPrice(
                          offer.totalPrice,
                          offer.currency,
                          18,
                        );
                        const username = offerorUsernames[offer.offeror];
                        return (
                          <div
                            key={offer.offerId}
                            className="flex flex-col items-center gap-[1px] sm:gap-2 w-[40px]"
                          >
                            <div className="w-[40px] h-[40px] rounded bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                            <p className="text-xs font-semibold text-slate-900 dark:text-white text-center">
                              {formattedPrice}
                            </p>
                            <p className="text-[10px] sm:text-xs text-slate-600 dark:text-slate-400 text-center truncate max-w-[40px]">
                              {username || "Unknown"}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {!activeAuction && (
            <div className="space-y-4">
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

              <button
                onClick={() =>
                  navigate(`/edition/${editionId}/serial/${serial}`)
                }
                className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-900 dark:text-white font-medium rounded transition"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {!activeAuction && sortedOffers.length > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 mt-6 lg:order-5 lg:col-start-2">
            <h2 className="text-xl font-bold mb-4">Your Offers</h2>
            <div className="space-y-4">
              {sortedOffers.map((offer) => {
                const isUserOffer =
                  account &&
                  account.address.toLowerCase() === offer.offeror.toLowerCase();

                if (!isUserOffer) return null;

                const formattedPrice = formatOfferPrice(
                  offer.totalPrice,
                  offer.currency,
                  18,
                );
                const username = offerorUsernames[offer.offeror];

                return (
                  <div
                    key={offer.offerId}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-700/50"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        Offer: {formattedPrice}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                        By: {username || account?.address || "Unknown"}
                      </p>
                      {cancelErrors[offer.offerId] && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          {cancelErrors[offer.offerId]}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleCancelOffer(offer.offerId)}
                      disabled={cancelingOfferId === offer.offerId}
                      className="ml-4 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-400 text-white font-medium rounded transition text-sm flex-shrink-0"
                    >
                      {cancelingOfferId === offer.offerId
                        ? "Canceling..."
                        : "Cancel"}
                    </button>
                  </div>
                );
              })}
              {sortedOffers.every(
                (offer) =>
                  !account ||
                  account.address.toLowerCase() !== offer.offeror.toLowerCase(),
              ) && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  You don't have any active offers on this item.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
