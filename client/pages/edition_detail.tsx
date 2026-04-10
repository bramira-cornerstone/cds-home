import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import {
  FontLoader,
  type Font,
} from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useWinningBid } from "@/hooks/useWinningBid";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useSharedCountdown } from "@/hooks/useSharedCountdown";
import { useMarketplace } from "@/hooks/useMarketplace";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import { formatOfferPrice } from "@/lib/activeOffers";
import { fetchMintedByEditionId, MintedRow } from "@/lib/supabaseMinted";
import EditionSplineScene, {
  EDITION_FONT_URL,
} from "@/components/EditionSplineScene";
import EditionMetricsTable from "@/components/EditionMetricsTable";
import EditionBuyOfferRow from "@/components/EditionBuyOfferRow";
import StakeForm from "@/components/StakeForm";
import ManageListingForm from "@/components/ManageListingForm";
import ManageOfferForm from "@/components/ManageOfferForm";
import BuyOfferBidPanel from "@/components/BuyOfferBidPanel";
import EditionEventsChart from "@/components/EditionEventsChart";
import CountdownDisplay from "@/components/CountdownDisplay";
import ActiveSerialListings from "@/components/ActiveSerialListings";
import ActiveSerialSettlement from "@/components/ActiveSerialSettlement";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import {
  fetchRelicSerialsJoinedByEditionId,
  fetchRelicSerialByEditionAndSerial,
  fetchUsernameByWalletAddress,
  fetchRollingMedianSaleByEditionId,
  countInPackTokensByEditionId,
  type RelicSerialRow,
} from "@/lib/supabaseRelicSerialsJoined";
import { getTeamCrest } from "@/lib/teams";
import { DarkModeHover } from "@/components/ui/dark_mode_hover";
import { getBadgeLabel } from "@/lib/badgeLabels";
import { getOwnerDisplayName } from "@/lib/auctionHouse";
import {
  fetchStakingByEditionAndSerial,
  hasActiveStake,
  formatExpirationDate,
  countStakedTokensByEditionId,
  type StakingRow,
} from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";
import { useToast } from "@/hooks/use-toast";

// Helper component to display countdown text inline
function OfferCountdown({
  endTimestampSeconds,
  style,
}: {
  endTimestampSeconds: number;
  style?: React.CSSProperties;
}) {
  const displayText = useSharedCountdown(endTimestampSeconds);
  if (!displayText) return null;
  return (
    <span className="text-sm font-medium" style={style}>
      {displayText}
    </span>
  );
}

export default function EditionDetailPage() {
  const betaAllowlist = useBetaAllowlist();
  const account = useActiveAccount();
  const connectedWalletAddress = account?.address ?? null;
  const navigate = useNavigate();
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const { contract: marketplaceContract } = useMarketplace();
  const { mutate: sendTransaction } = useSendTransaction();
  const params = useParams<{ editionId?: string; serial?: string }>();
  const editionId = useMemo(() => {
    const raw = (params.editionId || "").trim();
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [params.editionId]);

  const serial = useMemo(() => {
    const raw = (params.serial ?? "").trim();
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }, [params.serial]);
  const isSerialPage = serial != null;

  const [row, setRow] = useState<MintedRow | null>(null);
  const [serialData, setSerialData] = useState<RelicSerialRow | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [font, setFont] = useState<Font | null>(null);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [serials, setSerials] = useState<number[]>([]);
  const [serialLoading, setSerialLoading] = useState(false);
  const [serialPage, setSerialPage] = useState(0);
  const prevSerialPage = useRef(0);
  const [isDarkMode, setIsDarkMode] = useState(
    typeof document !== "undefined" && document.documentElement.classList.contains("dark")
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDarkMode(document.documentElement.classList.contains("dark"));
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);
  const [serialAnimClass, setSerialAnimClass] = useState("");
  const [currentOwner, setCurrentOwner] = useState<string>("");
  const [currentOwnerAddress, setCurrentOwnerAddress] = useState<string | null>(
    null,
  );
  const [currentTokenId, setCurrentTokenId] = useState<number | null>(null);
  const [isLoadingOwner, setIsLoadingOwner] = useState<boolean>(false);
  const [rollingMedianSale, setRollingMedianSale] = useState<string | null>(
    null,
  );
  const [settlementAuction, setSettlementAuction] =
    useState<ActiveAuction | null>(null);
  const [settlementWinningBid, setSettlementWinningBid] = useState<
    string | null
  >(null);
  const [stakingData, setStakingData] = useState<StakingRow[]>([]);
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);
  const [openPanel, setOpenPanel] = useState<
    "stake" | "listing" | "buyOfferBid" | "manageOffer" | null
  >(null);
  const [hasEditionEvents, setHasEditionEvents] = useState(true);
  const [isSubmittingCancelOffer, setIsSubmittingCancelOffer] = useState(false);
  const [rmvLowAsk, setRmvLowAsk] = useState<string | null>(null);
  const [rmvHighOffer, setRmvHighOffer] = useState<string | null>(null);
  const [rmvRollingMedianSale, setRmvRollingMedianSale] = useState<string | null>(null);
  const { toast } = useToast();

  // Merge data from both Minted and RelicSerialsJoined for serial pages
  const mergedRow = useMemo(() => {
    if (!row) return null;

    // For serial pages, prefer serialData fields over row fields
    if (!isSerialPage || !serialData) {
      return row;
    }

    return {
      ...row,
      GameDate: (serialData as any)?.GameDate ?? row.GameDate,
      FinalScore: (serialData as any)?.FinalScore ?? row.FinalScore,
      PlayerStatValue1:
        (serialData as any)?.PlayerStatValue1 ?? row.PlayerStatValue1,
      PlayerStatValue2:
        (serialData as any)?.PlayerStatValue2 ?? row.PlayerStatValue2,
      PlayerStatValue3:
        (serialData as any)?.PlayerStatValue3 ?? row.PlayerStatValue3,
      PlayerStatValue4:
        (serialData as any)?.PlayerStatValue4 ?? row.PlayerStatValue4,
      PlayerStatValue5:
        (serialData as any)?.PlayerStatValue5 ?? row.PlayerStatValue5,
      PlayerStat1: (serialData as any)?.PlayerStat1 ?? row.PlayerStat1,
      PlayerStat2: (serialData as any)?.PlayerStat2 ?? row.PlayerStat2,
      PlayerStat3: (serialData as any)?.PlayerStat3 ?? row.PlayerStat3,
      PlayerStat4: (serialData as any)?.PlayerStat4 ?? row.PlayerStat4,
      PlayerStat5: (serialData as any)?.PlayerStat5 ?? row.PlayerStat5,
    };
  }, [row, serialData, isSerialPage]);

  // Calculate active listings and auctions count for this edition
  const activeListingsCount = useMemo(() => {
    if (!editionId) return 0;

    const serialsSet = new Set<number>();

    // Add serials from active listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === editionId &&
          listing.serial !== null &&
          listing.status === "active"
        ) {
          serialsSet.add(listing.serial);
        }
      }
    }

    // Add serials from active auctions
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === editionId &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }

    return serialsSet.size;
  }, [editionId, activeListings, activeAuctions]);

  const listingPriceFromMarketplace = useMemo(() => {
    if (
      !isSerialPage ||
      !editionId ||
      serial == null ||
      activeListings.length === 0
    ) {
      return null;
    }

    const matching = activeListings.find(
      (listing) => listing.editionId === editionId && listing.serial === serial,
    );

    if (!matching) {
      return null;
    }

    const priceInWei = BigInt(matching.pricePerToken);
    const priceInTokens = Number(priceInWei) / 1e18;
    return `$${priceInTokens.toFixed(2)}`;
  }, [isSerialPage, editionId, serial, activeListings]);

  const { currentAuction, allListingsForEdition } = useMemo(() => {
    let auction = null;

    // On serial pages: find auction for the specific tokenId
    if (currentTokenId && isSerialPage) {
      auction = activeAuctions.find(
        (a) => a.tokenId === currentTokenId.toString() && a.status === "active",
      );
    }
    // On edition pages: find the lowest-priced active auction for the edition
    else if (!isSerialPage && editionId && activeAuctions.length > 0) {
      const editionAuctions = activeAuctions.filter(
        (a) => a.editionId === editionId && a.status === "active",
      );

      if (editionAuctions.length > 0) {
        // Find the auction with the lowest bid value
        auction = editionAuctions.reduce((lowest, current) => {
          const currentBid = current.currentBidAmount
            ? Number(BigInt(current.currentBidAmount)) / 1e18
            : Number(BigInt(current.minimumBidAmount)) / 1e18;

          const lowestBid = lowest.currentBidAmount
            ? Number(BigInt(lowest.currentBidAmount)) / 1e18
            : Number(BigInt(lowest.minimumBidAmount)) / 1e18;

          return currentBid < lowestBid ? current : lowest;
        });
      }
    }

    const listingsForEdition = editionId
      ? activeListings.filter((l) => l.editionId === editionId)
      : [];

    return {
      currentAuction: auction,
      allListingsForEdition: listingsForEdition,
    };
  }, [currentTokenId, activeAuctions, editionId, activeListings, isSerialPage]);

  // Find settlement auction (expired but not yet closed)
  useMemo(() => {
    if (!isSerialPage || !currentTokenId) {
      setSettlementAuction(null);
      return;
    }

    // Look through all auctions for one matching this token that is expired
    const tokenIdStr = currentTokenId.toString();
    const auction = activeAuctions.find(
      (a) =>
        a.tokenId === tokenIdStr &&
        a.endTimestamp < Math.floor(Date.now() / 1000),
    );

    setSettlementAuction(auction || null);
  }, [isSerialPage, currentTokenId, activeAuctions]);

  const { endTimestampToShow, currentAuctionForDisplay } = useMemo(() => {
    // Check if there's an active auction - only on serial pages
    if (isSerialPage && currentAuction && currentAuction.endTimestamp) {
      return {
        endTimestampToShow: currentAuction.endTimestamp,
        currentAuctionForDisplay: currentAuction,
      };
    }

    // Fall back to listing end time on serial pages only
    if (
      !isSerialPage ||
      !editionId ||
      serial == null ||
      activeListings.length === 0
    ) {
      return {
        endTimestampToShow: null,
        currentAuctionForDisplay: null,
      };
    }

    const matching = activeListings.find(
      (listing) => listing.editionId === editionId && listing.serial === serial,
    );

    if (!matching || !matching.startTimestamp || !matching.endTimestamp) {
      return {
        endTimestampToShow: null,
        currentAuctionForDisplay: null,
      };
    }

    const diffSeconds = matching.endTimestamp - matching.startTimestamp;
    const oneHundredYearsInSeconds = 100 * 365.25 * 24 * 60 * 60;
    const isApproximatelyOneHundredYears =
      Math.abs(diffSeconds - oneHundredYearsInSeconds) < 365 * 24 * 60 * 60;

    if (isApproximatelyOneHundredYears) {
      return {
        endTimestampToShow: null,
        currentAuctionForDisplay: null,
      };
    }

    return {
      endTimestampToShow: matching.endTimestamp,
      currentAuctionForDisplay: null,
    };
  }, [isSerialPage, editionId, serial, activeListings, currentAuction]);

  const lowAskToShow = useMemo(() => {
    if (!editionId) {
      return null;
    }

    let lowestPrice: number | null = null;

    // Check listings for low_ask
    if (activeListings.length > 0) {
      const editionListing = activeListings.find(
        (listing) => listing.editionId === editionId && listing.low_ask,
      );

      if (editionListing && editionListing.low_ask) {
        const priceInWei = BigInt(editionListing.low_ask);
        lowestPrice = Number(priceInWei) / 1e18;
      }
    }

    // Check auctions for current high bids
    if (activeAuctions.length > 0) {
      const editionAuctions = activeAuctions.filter(
        (a) => a.editionId === editionId && a.status === "active",
      );

      if (editionAuctions.length > 0) {
        for (const auction of editionAuctions) {
          const auctionBid = auction.currentBidAmount
            ? Number(BigInt(auction.currentBidAmount)) / 1e18
            : Number(BigInt(auction.minimumBidAmount)) / 1e18;

          if (lowestPrice === null || auctionBid < lowestPrice) {
            lowestPrice = auctionBid;
          }
        }
      }
    }

    if (lowestPrice === null) {
      return null;
    }

    return `$${lowestPrice.toFixed(2)}`;
  }, [editionId, activeListings, activeAuctions]);

  const { offers: allOffers, refetch: refetchOffers } = useActiveOffers();

  const highestEditionOfferToShow = useMemo(() => {
    if (!editionId || !allOffers || allOffers.length === 0) {
      return null;
    }

    // Filter offers for this edition
    const editionOffers = allOffers.filter(
      (offer) => offer.editionId === editionId,
    );

    if (editionOffers.length === 0) {
      return null;
    }

    // Find the highest offer by totalPrice
    const highestOffer = editionOffers.reduce((highest, current) => {
      const currentPrice = BigInt(current.totalPrice);
      const highestPrice = BigInt(highest.totalPrice);
      return currentPrice > highestPrice ? current : highest;
    });

    return formatOfferPrice(highestOffer.totalPrice, highestOffer.currency);
  }, [editionId, allOffers]);

  const { data: auctionWinningBid } = useWinningBid(
    currentAuction?.auctionId ?? null,
  );

  const tokenSpecificPrice = useMemo(() => {
    if (!isSerialPage || !listingPriceFromMarketplace) {
      return null;
    }
    return listingPriceFromMarketplace;
  }, [isSerialPage, listingPriceFromMarketplace]);

  const tokenSpecificAuctionBid = useMemo(() => {
    if (!isSerialPage || !currentAuction) {
      return null;
    }
    const auctionBid =
      auctionWinningBid && auctionWinningBid > 0
        ? auctionWinningBid
        : Number((currentAuction as any).minimumBidAmount || 0) / 1e18;
    if (typeof auctionBid === "number" && Number.isFinite(auctionBid)) {
      return `$${auctionBid.toFixed(2)}`;
    }
    return null;
  }, [isSerialPage, currentAuction, auctionWinningBid]);

  const isOwner = useMemo(() => {
    if (!connectedWalletAddress || !currentOwnerAddress) return false;
    return (
      connectedWalletAddress.toLowerCase() === currentOwnerAddress.toLowerCase()
    );
  }, [connectedWalletAddress, currentOwnerAddress]);

  const isAuctionCreator = useMemo(() => {
    if (!connectedWalletAddress || !currentAuction) return false;
    const auctionCreator = (currentAuction as any)?.auctionCreator ?? null;
    if (!auctionCreator) return false;
    return (
      connectedWalletAddress.toLowerCase() === auctionCreator.toLowerCase()
    );
  }, [connectedWalletAddress, currentAuction]);

  // Find user's active offer for the current serial
  const userActiveOffer = useMemo(() => {
    if (
      !isSerialPage ||
      !editionId ||
      !serial ||
      !connectedWalletAddress ||
      !allOffers ||
      allOffers.length === 0
    ) {
      return null;
    }

    const userOffers = allOffers.filter(
      (offer) =>
        offer.editionId === editionId &&
        offer.serial === serial &&
        offer.offeror.toLowerCase() === connectedWalletAddress.toLowerCase(),
    );

    if (userOffers.length === 0) {
      return null;
    }

    // Return the first (and typically only) active offer from user for this serial
    return userOffers[0];
  }, [isSerialPage, editionId, serial, connectedWalletAddress, allOffers]);

  const tokenSpecificOffersDisplay = useMemo(() => {
    if (
      !isSerialPage ||
      !currentTokenId ||
      !allOffers ||
      allOffers.length === 0
    ) {
      return null;
    }

    const tokenOffers = allOffers.filter(
      (offer) => offer.tokenId === currentTokenId.toString(),
    );

    if (tokenOffers.length === 0) {
      return null;
    }

    const formattedPrices = tokenOffers.map((offer) =>
      formatOfferPrice(offer.totalPrice, offer.currency),
    );

    return formattedPrices.join(", ");
  }, [isSerialPage, currentTokenId, allOffers]);

  useEffect(() => {
    let cancelled = false;
    const loader = new FontLoader();
    loader
      .loadAsync(EDITION_FONT_URL)
      .then((loadedFont) => {
        if (!cancelled) {
          setFont(loadedFont);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Silently ignore font load issues during dev testing
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleRefetchMissingData = useCallback(async () => {
    if (!editionId) return;
    try {
      const freshRow = await fetchMintedByEditionId(editionId, undefined);
      setRow(freshRow);

      // Also refetch serial data if on a serial page
      if (isSerialPage && serial != null) {
        try {
          const freshSerialData = await fetchRelicSerialByEditionAndSerial(
            editionId,
            serial,
            undefined,
          );
          setSerialData(freshSerialData);
        } catch (err) {
          console.error(
            "[EditionDetailPage] Failed to refetch serial data:",
            err,
          );
        }
      }
    } catch (err) {
      console.error("[EditionDetailPage] Failed to refetch data:", err);
    }
  }, [editionId, isSerialPage, serial]);

  const handleCancelOffer = useCallback(() => {
    if (!marketplaceContract || !userActiveOffer) {
      console.error("Missing contract or offer data");
      toast({
        title: "Error",
        description: "Missing contract or offer data",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingCancelOffer(true);

    try {
      const transaction = prepareContractCall({
        contract: marketplaceContract,
        method: "function cancelOffer(uint256 _offerId)",
        params: [BigInt(userActiveOffer.offerId)],
      });
      sendTransaction(transaction, {
        onSuccess: () => {
          setIsSubmittingCancelOffer(false);
          toast({
            title: "Success",
            description: "Your offer has been cancelled successfully!",
          });
          // Refetch offers to update the UI
          refetchOffers();
          // Clear the offer panel after success
          setTimeout(() => {
            setOpenPanel(null);
          }, 1500);
        },
        onError: (error) => {
          setIsSubmittingCancelOffer(false);
          const errorMessage =
            error instanceof Error ? error.message : "Failed to cancel offer";
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        },
      });
    } catch (err) {
      setIsSubmittingCancelOffer(false);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to prepare cancel offer transaction";
      console.error("Failed to prepare cancel offer transaction:", err);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  }, [marketplaceContract, userActiveOffer, sendTransaction, toast, refetchOffers]);

  useEffect(() => {
    if (!editionId) {
      setLoaded(true);
      setRow(null);
      setRollingMedianSale(null);
      return;
    }
    let cancelled = false;
    fetchMintedByEditionId(editionId, undefined)
      .then((r) => {
        if (!cancelled) {
          console.log(
            `[EditionDetailPage] Fetched minted row for edition ${editionId}:`,
            r,
          );
          setRow(r);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRow(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch RMV metrics: low_ask, high_offer, rolling_median_sale
  // Falls back to front-end calculations (lowAskToShow, highestEditionOfferToShow) if RMV fails
  useEffect(() => {
    if (!editionId) {
      setRmvLowAsk(null);
      setRmvHighOffer(null);
      setRmvRollingMedianSale(null);
      return;
    }

    const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
    const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;
    if (!baseUrl || !anonKey) return;

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RMV?edition_id=eq.${encodeURIComponent(
      editionId,
    )}&select=low_ask,high_offer,rolling_median_sale`;

    let cancelled = false;

    const formatWei = (value: string | number | null): string | null => {
      if (!value) return null;
      try {
        const bigValue = BigInt(String(value).trim());
        const wholePart = bigValue / BigInt(1e18);
        const remainder = bigValue % BigInt(1e18);
        const decimal = Number(wholePart) + Number(remainder) / 1e18;
        return `$${decimal.toFixed(2)}`;
      } catch {
        return null;
      }
    };

    fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    })
      .then((res) => res.json())
      .then((rows) => {
        if (cancelled) return;

        if (Array.isArray(rows) && rows[0]) {
          const row = rows[0];
          setRmvLowAsk(formatWei(row.low_ask));
          setRmvHighOffer(formatWei(row.high_offer));
          setRmvRollingMedianSale(formatWei(row.rolling_median_sale));
        } else {
          // No data from RMV, use fallbacks
          setRmvLowAsk(lowAskToShow);
          setRmvHighOffer(highestEditionOfferToShow);
          setRmvRollingMedianSale(null);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn(`[EditionDetailPage] RMV fetch error, using fallback calculations:`, err);
        // RMV query failed (500 error, timeout, etc) - use front-end calculated values
        setRmvLowAsk(lowAskToShow);
        setRmvHighOffer(highestEditionOfferToShow);
        setRmvRollingMedianSale(null);
      });

    return () => {
      cancelled = true;
    };
  }, [editionId, lowAskToShow, highestEditionOfferToShow]);

  useEffect(() => {
    if (!isSerialPage || !editionId || serial == null) {
      setStakingData([]);
      return;
    }
    let cancelled = false;
    fetchStakingByEditionAndSerial(editionId, serial, undefined)
      .then((data) => {
        if (!cancelled) setStakingData(data);
      })
      .catch(() => {
        if (!cancelled) setStakingData([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isSerialPage, editionId, serial]);

  // Fetch staked count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setStakedCount(0);
      return;
    }
    let cancelled = false;
    countStakedTokensByEditionId(editionId, undefined)
      .then((count) => {
        if (!cancelled) setStakedCount(count);
      })
      .catch(() => {
        if (!cancelled) setStakedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch in-packs count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setInPacksCount(0);
      return;
    }
    let cancelled = false;
    countInPackTokensByEditionId(editionId, undefined)
      .then((count) => {
        if (!cancelled) setInPacksCount(count);
      })
      .catch(() => {
        if (!cancelled) setInPacksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch redeemed count for the edition (asynchronous)
  useEffect(() => {
    if (!editionId) {
      setRedeemedCount(0);
      return;
    }
    let cancelled = false;
    countRedeemedTokensByEditionId(editionId, undefined, undefined)
      .then((count) => {
        if (!cancelled) setRedeemedCount(count);
      })
      .catch(() => {
        if (!cancelled) setRedeemedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch winning bid from contract for settlement auction
  useEffect(() => {
    if (!settlementAuction) {
      setSettlementWinningBid(null);
      return;
    }

    let cancelled = false;

    const fetchWinningBid = async () => {
      try {
        const MARKETPLACE_ADDRESS =
          import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
        const THIRDWEB_CLIENT_ID = import.meta.env.THIRDWEB_CLIENT_ID || "";

        if (!MARKETPLACE_ADDRESS || !THIRDWEB_CLIENT_ID) {
          setSettlementWinningBid(null);
          return;
        }

        const client = getAlchemyThirdwebClient();
        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client,
        });

        const result = await readContract({
          contract,
          method:
            "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
          params: [BigInt(settlementAuction.auctionId)],
        });

        if (!cancelled && result && result[2] !== undefined && result[2] > 0n) {
          setSettlementWinningBid(String(result[2]));
        } else {
          setSettlementWinningBid(null);
        }
      } catch (err) {
        console.debug("[EditionDetailPage] Error fetching winning bid:", err);
        if (!cancelled) {
          setSettlementWinningBid(null);
        }
      }
    };

    fetchWinningBid();

    return () => {
      cancelled = true;
    };
  }, [settlementAuction]);

  useEffect(() => {
    if (!isSerialPage || !editionId || serial == null) {
      setCurrentOwner("");
      setCurrentOwnerAddress(null);
      setCurrentTokenId(null);
      setIsLoadingOwner(false);
      return;
    }
    let cancelled = false;
    setCurrentOwner("");
    setCurrentOwnerAddress(null);
    setCurrentTokenId(null);
    setIsLoadingOwner(true);
    (async () => {
      try {
        const claim = await fetchRelicSerialByEditionAndSerial(
          editionId,
          serial,
          undefined,
        );
        const tokenIdRaw =
          (claim as any)?.token_id ?? (claim as any)?.tokenId ?? null;
        if (tokenIdRaw == null) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        const tokenIdInt =
          typeof tokenIdRaw === "bigint"
            ? Number(tokenIdRaw)
            : Number(tokenIdRaw);
        if (!Number.isFinite(tokenIdInt)) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        if (!cancelled) {
          setCurrentTokenId(tokenIdInt);
        }

        const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;
        if (!rpcKey) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        const contractAddress = (import.meta as any).env.VITE_ERC721_ADDRESS as
          | string
          | undefined;
        if (!contractAddress) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }
        const alchemyUrl = `https://polygon-mainnet.g.alchemy.com/nft/v3/${rpcKey}/getOwnersForNFT?contractAddress=${contractAddress}&tokenId=${tokenIdInt}`;
        const alchemyResponse = await fetch(alchemyUrl);

        if (!alchemyResponse.ok) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        const alchemyData = await alchemyResponse.json().catch(() => null);
        if (
          !alchemyData?.owners ||
          !Array.isArray(alchemyData.owners) ||
          alchemyData.owners.length === 0
        ) {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        const ownerAddress = alchemyData.owners[0];
        if (!ownerAddress || typeof ownerAddress !== "string") {
          if (!cancelled) {
            setIsLoadingOwner(false);
          }
          return;
        }

        const ownerAddressUpper = ownerAddress.toUpperCase();
        const username = await fetchUsernameByWalletAddress(
          ownerAddressUpper,
          undefined,
        );

        if (!cancelled) {
          setCurrentOwnerAddress(ownerAddressUpper);
          const displayName = getOwnerDisplayName(
            username || ownerAddressUpper,
          );
          setCurrentOwner(displayName);
          setIsLoadingOwner(false);
        }
      } catch {
        if (!cancelled) {
          setCurrentOwner("");
          setCurrentOwnerAddress(null);
          setIsLoadingOwner(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isSerialPage, editionId, serial]);

  useEffect(() => {
    const dir = serialPage > prevSerialPage.current ? "up" : "down";
    setSerialAnimClass(dir === "up" ? "swipe-up-anim" : "swipe-down-anim");
    const t = setTimeout(() => setSerialAnimClass(""), 260);
    prevSerialPage.current = serialPage;
    return () => clearTimeout(t);
  }, [serialPage]);

  // Temporarily deactivated betaAllowlist check
  // if (betaAllowlist !== true) {
  //   return (
  //     <section className="container mx-auto px-4 py-16">
  //       <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
  //         Platform is invitation only. Log in and enter your invite code to
  //         join.
  //       </div>
  //     </section>
  //   );
  // }

  if (!editionId) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Invalid edition id.</div>
      </section>
    );
  }

  if (loaded && row === null) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="mb-4 text-slate-700">Edition not found.</div>
      </section>
    );
  }

  return (
    <section
      className="container mx-auto px-0 md:px-4 pb-4 pt-0 nightmode_nocards"
      style={{ paddingTop: "0px" }}
    >
      <div className="w-full" style={{ width: "100%" }}>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="w-full lg:w-1/2 flex flex-col">
            {loaded ? (
              row ? (
                <EditionSplineScene
                  key={`${row.edition_id ?? editionId ?? undefined}-${isSerialPage ? serial : "edition"}`}
                  overlayUrl={
                    row?.video_location
                      ? `https://stream.mux.com/${row.video_location}.m3u8`
                      : undefined
                  }
                  className="w-full max-sm:h-[500px] lg:h-[calc(80dvh+20px)]"
                  font={font}
                  fontUrl={EDITION_FONT_URL}
                  textGeometryClass={TextGeometry}
                  playerName={mergedRow?.PlayerName ?? null}
                  productName={mergedRow?.ProductName ?? null}
                  minted={(() => {
                    const m = mergedRow?.Minted ?? null;
                    console.log(
                      `[EditionDetailPage] Passing minted prop:`,
                      m,
                      `from mergedRow:`,
                      mergedRow,
                    );
                    return m;
                  })()}
                  seriesName={mergedRow?.SeriesName ?? null}
                  tierValue={mergedRow?.TierValue ?? null}
                  playDescription={mergedRow?.PlayDescription ?? null}
                  setName={mergedRow?.SetName ?? null}
                  finalScore={mergedRow?.FinalScore ?? null}
                  gameDate={mergedRow?.GameDate ?? null}
                  lowAsk={rmvLowAsk || lowAskToShow}
                  highOffer={rmvHighOffer || highestEditionOfferToShow}
                  rollingMedianSale={rmvRollingMedianSale || rollingMedianSale}
                  activeListingsCount={activeListingsCount}
                  stakedCount={stakedCount}
                  inPacksCount={inPacksCount}
                  redeemedCount={redeemedCount}
                  statValue1={mergedRow?.PlayerStatValue1 ?? null}
                  statValue2={mergedRow?.PlayerStatValue2 ?? null}
                  statValue3={mergedRow?.PlayerStatValue3 ?? null}
                  statValue4={mergedRow?.PlayerStatValue4 ?? null}
                  statValue5={mergedRow?.PlayerStatValue5 ?? null}
                  statName1={mergedRow?.PlayerStat1 ?? null}
                  statName2={mergedRow?.PlayerStat2 ?? null}
                  statName3={mergedRow?.PlayerStat3 ?? null}
                  statName4={mergedRow?.PlayerStat4 ?? null}
                  statName5={mergedRow?.PlayerStat5 ?? null}
                  badge1={mergedRow?.Badge1 ?? null}
                  badge2={mergedRow?.Badge2 ?? null}
                  badge3={mergedRow?.Badge3 ?? null}
                  team={mergedRow?.team ?? null}
                  serialNumber={isSerialPage ? serial : null}
                  owner_name={
                    isSerialPage && currentOwner ? currentOwner : null
                  }
                  onRefetchMissingData={handleRefetchMissingData}
                  showBackgroundImage={true}
                />
              ) : (
                <div className="w-full h-[calc(80dvh+20px)] flex items-center justify-center text-slate-600">
                  No data.
                </div>
              )
            ) : (
              <div className="w-full h-[calc(80dvh+20px)] flex items-center justify-center text-slate-600">
                Loading…
              </div>
            )}
            {/* Flashing down arrow indicator */}
            {loaded && row && (
              <div className="w-full hidden max-sm:flex justify-center" style={{ padding: "0.5rem 0" }}>
                <div
                  className="text-slate-400 flex items-center gap-2"
                  style={{
                    animation: "fadeInOut 3s ease-in-out infinite",
                  }}
                  title="Scroll down to view details"
                >
                  <div style={{ fontSize: "20px", fontWeight: "bold", lineHeight: "1", color: "rgba(196, 196, 196, 1)" }}>⬇</div>
                  <div style={{ fontSize: "18px", fontWeight: "500", lineHeight: "1", color: "rgba(196, 196, 196, 1)" }}>Scroll for More</div>
                  <div style={{ fontSize: "20px", fontWeight: "bold", lineHeight: "1", color: "rgba(196, 196, 196, 1)" }}>⬇</div>
                </div>
              </div>
            )}
            {loaded ? (
              row ? (
                <div
                  className={`${hasEditionEvents ? "hidden lg:block" : "hidden"} bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-4`}
                  style={{ marginTop: "24px" }}
                >
                  <div className="text-sm text-slate-800 space-y-1 dark:text-white">
                    {(() => {
                      const FIELDS_BEFORE = ["PlayerName", "team"] as const;
                      const FIELDS_AFTER = [
                        "GameDate",
                        "PlayDescription",
                        "FinalScore",
                        "SeriesName",
                        "Minted",
                        "SetName",
                        "CreateDate",
                      ] as const;

                      const elements: JSX.Element[] = [];

                      for (const k of FIELDS_BEFORE) {
                        const v = (row as any)?.[k as any];
                        const label =
                          k === "PlayerName"
                            ? "Player"
                            : k === "team"
                              ? "Team"
                              : String(k);
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            <span className="font-medium">{label}</span>:{" "}
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </p>,
                        );
                      }

                      const b1 = String(
                        (row as any)?.Badge1 ?? "",
                      ).toUpperCase();
                      const badgeSrc =
                        b1 === "CP"
                          ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                          : b1 === "RY"
                            ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                            : b1 === "CY"
                              ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                              : null;
                      const b2 = String(
                        (row as any)?.Badge2 ?? "",
                      ).toUpperCase();
                      const badgeSrc2 =
                        b2 === "CP"
                          ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                          : b2 === "RY"
                            ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                            : b2 === "CY"
                              ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                              : null;
                      const b3 = String(
                        (row as any)?.Badge3 ?? "",
                      ).toUpperCase();
                      const badgeSrc3 =
                        b3 === "CP"
                          ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                          : b3 === "RY"
                            ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                            : b3 === "CY"
                              ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                              : null;

                      for (const k of FIELDS_AFTER) {
                        const v = (row as any)?.[k as any];
                        if (k === "PlayDescription") {
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              {v === null || v === undefined
                                ? "—"
                                : typeof v === "object"
                                  ? JSON.stringify(v)
                                  : String(v)}
                            </p>,
                          );
                          continue;
                        }
                        if (k === "SeriesName") {
                          const seriesVal = v;
                          const tierVal = (row as any)?.["TierValue"];
                          const combined =
                            (seriesVal == null ? "" : String(seriesVal)) +
                            (tierVal == null
                              ? ""
                              : (seriesVal ? " - " : "") + String(tierVal));
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              {combined || "—"}
                            </p>,
                          );
                          continue;
                        }
                        if (k === "CreateDate") {
                          const raw = v;
                          let formatted = "—";
                          try {
                            if (raw != null) {
                              const s = String(raw).replace(" ", "T");
                              const m = s.match(
                                /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
                              );
                              if (m) {
                                const msUTCGuess = Date.parse(
                                  `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`,
                                );
                                const getTzOffset = (
                                  date: Date,
                                  timeZone: string,
                                ) => {
                                  const dtf = new Intl.DateTimeFormat("en-US", {
                                    timeZone,
                                    hour12: false,
                                    year: "numeric",
                                    month: "2-digit",
                                    day: "2-digit",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    second: "2-digit",
                                  });
                                  const parts = dtf.formatToParts(date);
                                  const map: any = {};
                                  for (const { type, value } of parts)
                                    (map as any)[type] = value as string;
                                  const tzAsUTC = Date.parse(
                                    `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`,
                                  );
                                  return tzAsUTC - date.getTime();
                                };
                                const offset = getTzOffset(
                                  new Date(msUTCGuess),
                                  "America/New_York",
                                );
                                const utcMs = msUTCGuess - offset;
                                const dLocal = new Date(utcMs);
                                const pad = (n: number) =>
                                  String(n).padStart(2, "0");
                                formatted = `${dLocal.getFullYear()}-${pad(dLocal.getMonth() + 1)}-${pad(dLocal.getDate())} ${pad(dLocal.getHours())}:${pad(dLocal.getMinutes())}:${pad(dLocal.getSeconds())}`;
                              } else {
                                const d = new Date(raw);
                                const pad = (n: number) =>
                                  String(n).padStart(2, "0");
                                formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                              }
                            }
                          } catch {}
                          elements.push(
                            <p key={String(k)} className="leading-relaxed">
                              <span className="font-medium">
                                {"Relic created on"}
                              </span>
                              : {formatted}
                            </p>,
                          );
                          continue;
                        }
                        const label =
                          k === "GameDate"
                            ? "Game Date"
                            : k === "FinalScore"
                              ? "Final Score"
                              : k === "SetName"
                                ? "Set Name"
                                : String(k);
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            <span className="font-medium">{label}</span>:{" "}
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </p>,
                        );
                      }

                      return elements;
                    })()}

                    {(() => {
                      const names = [
                        row?.PlayerStat1 ?? null,
                        row?.PlayerStat2 ?? null,
                        row?.PlayerStat3 ?? null,
                        row?.PlayerStat4 ?? null,
                        row?.PlayerStat5 ?? null,
                      ];
                      const values = [
                        row?.PlayerStatValue1 ?? null,
                        row?.PlayerStatValue2 ?? null,
                        row?.PlayerStatValue3 ?? null,
                        row?.PlayerStatValue4 ?? null,
                        row?.PlayerStatValue5 ?? null,
                      ];
                      const hasAny =
                        names.some((n) => n != null) ||
                        values.some((v) => v != null);
                      if (!hasAny) return null;
                      return (
                        <div className="mt-3 rounded-md border border-slate-200 overflow-hidden dark:bg-slate-700 dark:border-white/10 dark:text-white">
                          <div className="grid grid-cols-5 bg-slate-50 dark:bg-slate-700">
                            {names.map((n, i) => (
                              <div
                                key={`h-${i}`}
                                className="px-2 py-1 text-center text-[12px] font-medium text-slate-700 truncate dark:text-white"
                              >
                                {n ?? "—"}
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-5">
                            {values.map((v, i) => (
                              <div
                                key={`v-${i}`}
                                className="px-2 py-2 text-center text-[13px] text-slate-800 dark:text-white"
                              >
                                {v === null || v === undefined
                                  ? "—"
                                  : String(v)}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="hidden lg:block text-slate-600">No data.</div>
              )
            ) : (
              <div className="hidden lg:block text-slate-600">Loading…</div>
            )}
          </div>

          <div className="w-full lg:w-1/2">
            {/* Desktop placement: on the right above the text table */}
            <div className="mb-1">
              {isSerialPage ? (
                <>
                  <div className="flex items-baseline gap-1 leading-[50px]">
                    <div className="text-[40px] font-medium">#</div>
                    <div className="text-[40px] font-bold">{serial}</div>
                    <div className="text-[40px] font-medium italic flex items-baseline gap-1">
                      <div style={{ fontFamily: "Allura, sans-serif" }}>
                        <p>of </p>
                      </div>
                      <div style={{ fontFamily: "Allura, sans-serif" }}>
                        {row?.Minted ?? "—"}
                      </div>
                      <div style={{ fontFamily: "Allura, sans-serif" }}>
                        {" "}
                        to ever exist
                      </div>
                    </div>
                  </div>
                  <div
                    className="text-[40px] font-medium leading-[50px] italic"
                    style={{ fontFamily: "Allura, sans-serif" }}
                  >
                    {isLoadingOwner
                      ? ""
                      : isSerialPage && !currentOwner
                        ? "Hidden in boxes"
                        : `Owned by ${currentOwner || ""}`}
                  </div>
                </>
              ) : null}
            </div>
            {loaded &&
              row &&
              (() => {
                const b1 = String((row as any)?.Badge1 ?? "").toUpperCase();
                const badgeSrc =
                  b1 === "CP"
                    ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                    : b1 === "RY"
                      ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                      : b1 === "CY"
                        ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                        : null;
                const b2 = String((row as any)?.Badge2 ?? "").toUpperCase();
                const badgeSrc2 =
                  b2 === "CP"
                    ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                    : b2 === "RY"
                      ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                      : b2 === "CY"
                        ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                        : null;
                const b3 = String((row as any)?.Badge3 ?? "").toUpperCase();
                const badgeSrc3 =
                  b3 === "CP"
                    ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                    : b3 === "RY"
                      ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                      : b3 === "CY"
                        ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                        : null;
                const teamName = (row as any)?.team;
                const teamCrestSrc = teamName ? getTeamCrest(teamName) : null;
                return (
                  <div className="mb-3 grid grid-cols-4 gap-2">
                    <div
                      className="h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center relative group"
                      title={teamName || undefined}
                    >
                      {teamCrestSrc && (
                        <>
                          <img
                            src={teamCrestSrc}
                            alt={teamName || "Team crest"}
                            className="max-h-[80%] object-contain"
                          />
                          {teamName && (
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-slate-900 text-white text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-events-none transition-opacity z-10 dark:bg-slate-700">
                              {teamName}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    <DarkModeHover
                      tooltip={getBadgeLabel(badgeSrc)}
                      className="h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center"
                    >
                      {badgeSrc && (
                        <img
                          src={badgeSrc}
                          alt=""
                          className="max-h-[80%] object-contain"
                        />
                      )}
                    </DarkModeHover>
                    <DarkModeHover
                      tooltip={getBadgeLabel(badgeSrc2)}
                      className="h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center"
                    >
                      {badgeSrc2 && (
                        <img
                          src={badgeSrc2}
                          alt=""
                          className="max-h-[80%] object-contain"
                        />
                      )}
                    </DarkModeHover>
                    <DarkModeHover
                      tooltip={getBadgeLabel(badgeSrc3)}
                      className="h-[80px] md:h-[80px] rounded-[4px] flex items-center justify-center"
                    >
                      {badgeSrc3 && (
                        <img
                          src={badgeSrc3}
                          alt=""
                          className="max-h-[80%] object-contain"
                        />
                      )}
                    </DarkModeHover>
                  </div>
                );
              })()}
            {!isSerialPage && serials.length > 0 && (
              <div className="flex items-center justify-between gap-4 px-3 py-2 rounded-md border border-slate-200 bg-white dark:bg-slate-700 dark:border-white/10 dark:text-white mb-1.5">
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Available for Purchase ({serials.length})
                </div>
                <button
                  onClick={() => navigate(`/edition/${editionId}/serials`)}
                  className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  View All Serials
                </button>
              </div>
            )}
            {isSerialPage && settlementAuction && (
              <ActiveSerialSettlement
                className="mt-2"
                auction={settlementAuction}
                currentHighBid={settlementWinningBid}
              />
            )}
            <div className="mb-0.5">
              <ActiveSerialListings
                editionId={editionId}
                isSerialPage={isSerialPage}
              />
            </div>
            <div>
              {isSerialPage &&
                (tokenSpecificPrice != null ||
                  tokenSpecificAuctionBid != null) && (
                  <div
                    className="mt-2 rounded-md bg-white dark:bg-slate-700 dark:text-white p-3"
                    style={{ border: "1px solid rgba(226, 232, 240, 1)" }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div>
                          <p className="text-sm text-slate-700 dark:text-slate-300">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              {tokenSpecificPrice != null
                                ? "Listing Price: "
                                : "Auction Price: "}
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: "rgba(255, 99, 0, 1)" }}
                            >
                              {tokenSpecificPrice != null
                                ? tokenSpecificPrice
                                : tokenSpecificAuctionBid}
                            </span>
                          </p>
                        </div>
                        {tokenSpecificOffersDisplay && (
                          <div className="mb-2">
                            <p className="text-sm text-slate-700 dark:text-slate-300">
                              <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                                Offers:{" "}
                              </span>
                              <span className="font-semibold">
                                {tokenSpecificOffersDisplay}
                              </span>
                            </p>
                          </div>
                        )}
                        {endTimestampToShow && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                              Listing Ending In:
                            </span>
                            <CountdownDisplay
                              endTimestampSeconds={endTimestampToShow}
                              className="text-sm font-medium"
                              style={{ color: "rgba(255, 99, 0, 1)" }}
                              showLabel={false}
                            />
                          </div>
                        )}
                      </div>
                      {!isOwner && !isAuctionCreator && (
                        <button
                          className="w-[120px] h-[30px] self-stretch mb-auto rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
                          style={{
                            boxShadow: "1px 1px 3px 0 rgba(74, 74, 74, 1)",
                          }}
                          onClick={() =>
                            setOpenPanel(
                              openPanel === "buyOfferBid"
                                ? null
                                : "buyOfferBid",
                            )
                          }
                        >
                          Buy - Offer - Bid
                        </button>
                      )}
                    </div>
                  </div>
                )}

              {/* Buy - Offer - Bid Panel Slide Down */}
              {isSerialPage &&
                (tokenSpecificPrice != null ||
                  tokenSpecificAuctionBid != null) &&
                !isOwner &&
                !isAuctionCreator && (
                  <div
                    style={{
                      maxHeight: openPanel === "buyOfferBid" ? "1000px" : "0",
                      overflow: "hidden",
                      transition: "max-height 0.4s ease-in-out",
                      border:
                        openPanel === "buyOfferBid"
                          ? "1px solid rgba(226, 232, 240, 1)"
                          : "none",
                    }}
                  >
                    <div className="p-6">
                      {editionId !== null && serial !== null && (
                        <BuyOfferBidPanel
                          editionId={editionId}
                          serial={serial}
                        />
                      )}
                    </div>
                  </div>
                )}

              {/* User's Active Offer Bar */}
              {isSerialPage && userActiveOffer && (
                <div
                  className="mt-2 rounded-md bg-white dark:bg-slate-700 dark:text-white p-3"
                  style={{ border: "1px solid rgba(226, 232, 240, 1)" }}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div>
                        <p className="text-sm text-slate-700 dark:text-slate-300">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Your Offer:{" "}
                          </span>
                          <span
                            className="font-semibold"
                            style={{ color: "rgba(255, 99, 0, 1)" }}
                          >
                            {formatOfferPrice(userActiveOffer.totalPrice, userActiveOffer.currency)}
                          </span>
                        </p>
                      </div>
                      {userActiveOffer.expirationTimestamp && (
                        <div className="flex items-center gap-0 mt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                            Offer Expires In:
                          </span>
                          <OfferCountdown
                            endTimestampSeconds={userActiveOffer.expirationTimestamp}
                            style={{ color: "rgba(255, 99, 0, 1)" }}
                          />
                        </div>
                      )}
                    </div>
                    <FilterStyleButton
                      className="h-[30px] mb-auto text-sm font-medium whitespace-nowrap px-3"
                      onClick={handleCancelOffer}
                      disabled={isSubmittingCancelOffer}
                    >
                      {isSubmittingCancelOffer ? "Submitting..." : "Cancel Offer"}
                    </FilterStyleButton>
                  </div>
                </div>
              )}

              <EditionMetricsTable
                className=""
                tokenId={currentTokenId}
                listingPrice={listingPriceFromMarketplace}
                editionLowAsk={rmvLowAsk || lowAskToShow}
                lowAsk={rmvLowAsk || lowAskToShow}
                highOffer={rmvHighOffer || highestEditionOfferToShow}
                editionId={editionId}
                allListingsForEdition={allListingsForEdition}
                rollingMedianSale={rmvRollingMedianSale || rollingMedianSale}
                marketplaceListings={activeListings as any}
                ownerAddress={currentOwnerAddress}
                connectedWalletAddress={connectedWalletAddress}
              />
            </div>
            {(!isSerialPage ||
              (currentOwnerAddress &&
                connectedWalletAddress &&
                currentOwnerAddress.toUpperCase() ===
                  connectedWalletAddress.toUpperCase())) && (
              <EditionBuyOfferRow
                className="mt-2"
                editionId={editionId}
                isSerialPage={isSerialPage}
                ownerAddress={currentOwnerAddress}
                connectedWalletAddress={connectedWalletAddress}
                currentTokenId={currentTokenId}
                serial={serial}
                onStakeClick={() =>
                  setOpenPanel(openPanel === "stake" ? null : "stake")
                }
                onListClick={() =>
                  setOpenPanel(openPanel === "listing" ? null : "listing")
                }
              />
            )}

            {/* Collapsible Stake Panel */}
            {isSerialPage && (
              <div
                style={{
                  maxHeight: openPanel === "stake" ? "1000px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.4s ease-in-out",
                  border:
                    openPanel === "stake"
                      ? "1px solid rgba(226, 232, 240, 1)"
                      : "none",
                }}
              >
                <StakeForm
                  editionId={editionId}
                  serial={serial}
                  team={(mergedRow as any)?.team ?? null}
                  onSuccess={() => {
                    setOpenPanel(null);
                  }}
                  onCancel={() => setOpenPanel(null)}
                  showTitle={false}
                />
              </div>
            )}

            {/* Collapsible Manage Listing Panel */}
            {isSerialPage && (
              <div
                style={{
                  maxHeight: openPanel === "listing" ? "1000px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.4s ease-in-out",
                  border:
                    openPanel === "listing"
                      ? "1px solid rgba(226, 232, 240, 1)"
                      : "none",
                }}
              >
                <ManageListingForm
                  editionId={editionId}
                  serial={serial}
                  onCancel={() => setOpenPanel(null)}
                />
              </div>
            )}

            {/* Collapsible Manage Offer Panel */}
            {isSerialPage && userActiveOffer && (
              <div
                style={{
                  maxHeight: openPanel === "manageOffer" ? "1000px" : "0",
                  overflow: "hidden",
                  transition: "max-height 0.4s ease-in-out",
                  border:
                    openPanel === "manageOffer"
                      ? "1px solid rgba(226, 232, 240, 1)"
                      : "none",
                }}
              >
                <div className="p-6">
                  <ManageOfferForm
                    editionId={editionId}
                    serial={serial}
                    offer={userActiveOffer}
                    onCancel={() => setOpenPanel(null)}
                  />
                </div>
              </div>
            )}

            {loaded ? (
              row ? (
                <div
                  className="block lg:hidden text-sm text-slate-800 space-y-1 dark:text-white"
                  style={{ marginTop: "24px" }}
                >
                  {(() => {
                    const FIELDS_BEFORE = ["PlayerName", "team"] as const;
                    const FIELDS_AFTER = [
                      "GameDate",
                      "PlayDescription",
                      "FinalScore",
                      "SeriesName",
                      "Minted",
                      "SetName",
                      "CreateDate",
                    ] as const;

                    const elements: JSX.Element[] = [];

                    for (const k of FIELDS_BEFORE) {
                      const v = (row as any)?.[k as any];
                      const label =
                        k === "PlayerName"
                          ? "Player"
                          : k === "team"
                            ? "Team"
                            : String(k);
                      elements.push(
                        <p key={String(k)} className="leading-relaxed">
                          <span className="font-medium">{label}</span>:{" "}
                          {v === null || v === undefined
                            ? "—"
                            : typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                        </p>,
                      );
                    }

                    const b1 = String((row as any)?.Badge1 ?? "").toUpperCase();
                    const badgeSrc =
                      b1 === "CP"
                        ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                        : b1 === "RY"
                          ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                          : b1 === "CY"
                            ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                            : null;
                    const b2 = String((row as any)?.Badge2 ?? "").toUpperCase();
                    const badgeSrc2 =
                      b2 === "CP"
                        ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                        : b2 === "RY"
                          ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                          : b2 === "CY"
                            ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                            : null;
                    const b3 = String((row as any)?.Badge3 ?? "").toUpperCase();
                    const badgeSrc3 =
                      b3 === "CP"
                        ? isDarkMode ? "/images/CP_badge_white.webp" : "/images/cp-badge.webp"
                        : b3 === "RY"
                          ? isDarkMode ? "/images/RY_badge_white.webp" : "/images/ry-badge.webp"
                          : b3 === "CY"
                            ? isDarkMode ? "/images/CY_badge_white.webp" : "/images/cy-badge.webp"
                            : null;

                    for (const k of FIELDS_AFTER) {
                      const v = (row as any)?.[k as any];
                      if (k === "PlayDescription") {
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            {v === null || v === undefined
                              ? "—"
                              : typeof v === "object"
                                ? JSON.stringify(v)
                                : String(v)}
                          </p>,
                        );
                        continue;
                      }
                      if (k === "SeriesName") {
                        const seriesVal = v;
                        const tierVal = (row as any)?.["TierValue"];
                        const combined =
                          (seriesVal == null ? "" : String(seriesVal)) +
                          (tierVal == null
                            ? ""
                            : (seriesVal ? " - " : "") + String(tierVal));
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            {combined || "—"}
                          </p>,
                        );
                        continue;
                      }
                      if (k === "CreateDate") {
                        const raw = v;
                        let formatted = "—";
                        try {
                          if (raw != null) {
                            const s = String(raw).replace(" ", "T");
                            const m = s.match(
                              /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
                            );
                            if (m) {
                              const msUTCGuess = Date.parse(
                                `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`,
                              );
                              const getTzOffset = (
                                date: Date,
                                timeZone: string,
                              ) => {
                                const dtf = new Intl.DateTimeFormat("en-US", {
                                  timeZone,
                                  hour12: false,
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                });
                                const parts = dtf.formatToParts(date);
                                const map: any = {};
                                for (const { type, value } of parts)
                                  (map as any)[type] = value as string;
                                const tzAsUTC = Date.parse(
                                  `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`,
                                );
                                return tzAsUTC - date.getTime();
                              };
                              const offset = getTzOffset(
                                new Date(msUTCGuess),
                                "America/New_York",
                              );
                              const utcMs = msUTCGuess - offset;
                              const dLocal = new Date(utcMs);
                              const pad = (n: number) =>
                                String(n).padStart(2, "0");
                              formatted = `${dLocal.getFullYear()}-${pad(dLocal.getMonth() + 1)}-${pad(dLocal.getDate())} ${pad(dLocal.getHours())}:${pad(dLocal.getMinutes())}:${pad(dLocal.getSeconds())}`;
                            } else {
                              const d = new Date(raw);
                              const pad = (n: number) =>
                                String(n).padStart(2, "0");
                              formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
                            }
                          }
                        } catch {}
                        elements.push(
                          <p key={String(k)} className="leading-relaxed">
                            <span className="font-medium">
                              {"Relic created on"}
                            </span>
                            : {formatted}
                          </p>,
                        );
                        continue;
                      }
                      const label =
                        k === "GameDate"
                          ? "Game Date"
                          : k === "FinalScore"
                            ? "Final Score"
                            : k === "SetName"
                              ? "Set Name"
                              : String(k);
                      elements.push(
                        <p key={String(k)} className="leading-relaxed">
                          <span className="font-medium">{label}</span>:{" "}
                          {v === null || v === undefined
                            ? "—"
                            : typeof v === "object"
                              ? JSON.stringify(v)
                              : String(v)}
                        </p>,
                      );
                    }

                    return elements;
                  })()}

                  {(() => {
                    const names = [
                      row?.PlayerStat1 ?? null,
                      row?.PlayerStat2 ?? null,
                      row?.PlayerStat3 ?? null,
                      row?.PlayerStat4 ?? null,
                      row?.PlayerStat5 ?? null,
                    ];
                    const values = [
                      row?.PlayerStatValue1 ?? null,
                      row?.PlayerStatValue2 ?? null,
                      row?.PlayerStatValue3 ?? null,
                      row?.PlayerStatValue4 ?? null,
                      row?.PlayerStatValue5 ?? null,
                    ];
                    const hasAny =
                      names.some((n) => n != null) ||
                      values.some((v) => v != null);
                    if (!hasAny) return null;
                    return (
                      <div className="mt-3 rounded-md border border-slate-200 overflow-hidden dark:bg-slate-700 dark:border-white/10 dark:text-white">
                        <div className="grid grid-cols-5 bg-slate-50 dark:bg-slate-700">
                          {names.map((n, i) => (
                            <div
                              key={`h-${i}`}
                              className="px-2 py-1 text-center text-[12px] font-medium text-slate-700 truncate dark:text-white"
                            >
                              {n ?? "—"}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-5">
                          {values.map((v, i) => (
                            <div
                              key={`v-${i}`}
                              className="px-2 py-2 text-center text-[13px] text-slate-800 dark:text-white"
                            >
                              {v === null || v === undefined ? "—" : String(v)}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="block lg:hidden text-slate-600">No data.</div>
              )
            ) : (
              <div className="block lg:hidden text-slate-600">Loading…</div>
            )}
            <div className="mt-3">
              <EditionEventsChart
                editionId={editionId}
                playerName={row?.PlayerName}
                setName={row?.SetName}
                minted={row?.Minted}
                gameDate={row?.GameDate}
                onHasContent={setHasEditionEvents}
              />
            </div>

            {/* Desktop metadata - Show when EditionEventsChart is hidden */}
            {!hasEditionEvents && loaded && row && (
              <div
                className="hidden lg:block text-sm text-slate-800 space-y-1 dark:text-white"
                style={{ marginTop: "24px" }}
              >
                {(() => {
                  const FIELDS_BEFORE = ["PlayerName", "team"] as const;
                  const FIELDS_AFTER = [
                    "GameDate",
                    "PlayDescription",
                    "FinalScore",
                    "SeriesName",
                    "Minted",
                    "SetName",
                    "CreateDate",
                  ] as const;

                  const elements: JSX.Element[] = [];

                  for (const k of FIELDS_BEFORE) {
                    const v = (row as any)?.[k as any];
                    const label =
                      k === "PlayerName"
                        ? "Player"
                        : k === "team"
                          ? "Team"
                          : String(k);
                    elements.push(
                      <p key={String(k)} className="leading-relaxed">
                        <span className="font-medium">{label}</span>:{" "}
                        {v === null || v === undefined
                          ? "—"
                          : typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)}
                      </p>,
                    );
                  }

                  for (const k of FIELDS_AFTER) {
                    const v = (row as any)?.[k as any];
                    if (k === "CreateDate") {
                      let formatted = "—";
                      try {
                        const raw = v;
                        let msUTCGuess = new Date(raw).getTime();
                        const getTzOffset = (
                          date: Date,
                          tzString: string,
                        ): number => {
                          const tzGuess = new Date(
                            date.toLocaleString("en-US", {
                              timeZone: tzString,
                            }),
                          );
                          const parts = date
                            .toLocaleString("en-CA", {
                              timeZone: tzString,
                              year: "numeric",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                              hour12: false,
                            })
                            .split(/[:\-\s/]/)
                            .map((p) => {
                              const idx = [
                                "year",
                                "month",
                                "day",
                                "hour",
                                "minute",
                                "second",
                              ].indexOf(
                                [
                                  "year",
                                  "month",
                                  "day",
                                  "hour",
                                  "minute",
                                  "second",
                                ][
                                  [0, 1, 2, 3, 4, 5].indexOf(
                                    parts.indexOf(p) >= 0
                                      ? parts.indexOf(p)
                                      : -1,
                                  )
                                ],
                              );
                              return {
                                type: [
                                  "year",
                                  "month",
                                  "day",
                                  "hour",
                                  "minute",
                                  "second",
                                ][
                                  parts.indexOf(p) >= 0 ? parts.indexOf(p) : -1
                                ],
                                value: p,
                              };
                            })
                            .filter((p) =>
                              [
                                "year",
                                "month",
                                "day",
                                "hour",
                                "minute",
                                "second",
                              ].includes(p.type),
                            );
                          const map: any = {};
                          for (const { type, value } of parts)
                            (map as any)[type] = value as string;
                          const tzAsUTC = Date.parse(
                            `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`,
                          );
                          return tzAsUTC - date.getTime();
                        };
                        const offset = getTzOffset(
                          new Date(msUTCGuess),
                          "America/New_York",
                        );
                        const utcMs = msUTCGuess - offset;
                        const dLocal = new Date(utcMs);
                        const pad = (n: number) => String(n).padStart(2, "0");
                        formatted = `${dLocal.getFullYear()}-${pad(dLocal.getMonth() + 1)}-${pad(dLocal.getDate())} ${pad(dLocal.getHours())}:${pad(dLocal.getMinutes())}:${pad(dLocal.getSeconds())}`;
                      } catch {}
                      elements.push(
                        <p key={String(k)} className="leading-relaxed">
                          <span className="font-medium">
                            {"Relic created on"}
                          </span>
                          : {formatted}
                        </p>,
                      );
                      continue;
                    }
                    const label =
                      k === "GameDate"
                        ? "Game Date"
                        : k === "FinalScore"
                          ? "Final Score"
                          : k === "SetName"
                            ? "Set Name"
                            : String(k);
                    elements.push(
                      <p key={String(k)} className="leading-relaxed">
                        <span className="font-medium">{label}</span>:{" "}
                        {v === null || v === undefined
                          ? "—"
                          : typeof v === "object"
                            ? JSON.stringify(v)
                            : String(v)}
                      </p>,
                    );
                  }

                  return elements;
                })()}

                {(() => {
                  const names = [
                    row?.PlayerStat1 ?? null,
                    row?.PlayerStat2 ?? null,
                    row?.PlayerStat3 ?? null,
                    row?.PlayerStat4 ?? null,
                    row?.PlayerStat5 ?? null,
                  ];
                  const values = [
                    row?.PlayerStatValue1 ?? null,
                    row?.PlayerStatValue2 ?? null,
                    row?.PlayerStatValue3 ?? null,
                    row?.PlayerStatValue4 ?? null,
                    row?.PlayerStatValue5 ?? null,
                  ];
                  const hasAny =
                    names.some((n) => n != null) ||
                    values.some((v) => v != null);
                  if (!hasAny) return null;
                  return (
                    <div className="mt-3 rounded-md border border-slate-200 overflow-hidden dark:bg-slate-700 dark:border-white/10 dark:text-white">
                      <div className="grid grid-cols-5 bg-slate-50 dark:bg-slate-700">
                        {names.map((n, i) => (
                          <div
                            key={`h-${i}`}
                            className="px-2 py-1 text-center text-[12px] font-medium text-slate-700 truncate dark:text-white"
                          >
                            {n ?? "—"}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5">
                        {values.map((v, i) => (
                          <div
                            key={`v-${i}`}
                            className="px-2 py-2 text-center text-[13px] text-slate-800 dark:text-white"
                          >
                            {v === null || v === undefined ? "—" : String(v)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={serialModalOpen} onOpenChange={setSerialModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Serial</DialogTitle>
          </DialogHeader>
          <div className="overflow-x-auto rounded border border-slate-200 dark:border-white/10">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="px-2 py-1 text-left">Serial</th>
                  <th className="px-2 py-1 text-left">&nbsp;</th>
                  <th className="px-2 py-1 text-left">&nbsp;</th>
                  <th className="px-2 py-1 text-left">&nbsp;</th>
                </tr>
              </thead>
              <tbody className={serialAnimClass}>
                {serialLoading ? (
                  <tr>
                    <td className="px-2 py-2" colSpan={4}>
                      Loading serials…
                    </td>
                  </tr>
                ) : serials.length === 0 ? (
                  <tr>
                    <td className="px-2 py-2" colSpan={4}>
                      No serials found.
                    </td>
                  </tr>
                ) : (
                  serials
                    .slice(serialPage * 10, serialPage * 10 + 10)
                    .map((s) => (
                      <tr
                        key={s}
                        className="border-t border-slate-200 dark:border-white/10"
                      >
                        <td className="px-2 py-1">
                          <FilterStyleButton
                            asChild
                            className="w-1/4 px-2 py-1 text-xs"
                          >
                            <Link
                              to={`/edition/${editionId}/serial/${s}`}
                              onClick={() => setSerialModalOpen(false)}
                            >
                              {s}
                            </Link>
                          </FilterStyleButton>
                        </td>
                        <td className="px-2 py-1">&nbsp;</td>
                        <td className="px-2 py-1">&nbsp;</td>
                        <td className="px-2 py-1">&nbsp;</td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
            <div className="flex items-center justify-between gap-2 px-2 py-2">
              <div className="flex-1">
                {serialPage > 0 ? (
                  <FilterStyleButton
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setSerialPage((p) => Math.max(0, p - 1))}
                  >
                    Previous 10
                  </FilterStyleButton>
                ) : null}
              </div>
              <div className="text-[11px] text-slate-500">
                Page {serials.length ? serialPage + 1 : 0} /{" "}
                {Math.max(1, Math.ceil(serials.length / 10))}
              </div>
              <div className="flex-1 flex justify-end">
                {serialPage < Math.ceil(serials.length / 10) - 1 ? (
                  <FilterStyleButton
                    className="px-3 py-1.5 text-xs"
                    onClick={() =>
                      setSerialPage((p) =>
                        Math.min(
                          Math.max(0, Math.ceil(serials.length / 10) - 1),
                          p + 1,
                        ),
                      )
                    }
                  >
                    Next 10
                  </FilterStyleButton>
                ) : null}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
