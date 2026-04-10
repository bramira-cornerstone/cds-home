import { useEffect, useMemo, useState, useRef } from "react";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import EditionHoverPreview from "@/components/EditionHoverPreview";
import { FitText } from "@/components/ui/fit-text";
import CollectionSerialCard from "@/components/CollectionSerialCard";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import {
  fetchRelicsFromAlchemy,
  fetchRelicSerialsByTokenIds,
  type RelicSerialWithMetadata,
  type AlchemyTokenWithTime,
} from "@/lib/alchemyRelicSerialsJoined";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import {
  fetchPriorDropNFTs,
  buildPriorDropAttributeMap,
  getTokenIdString,
  resolveMediaUrl,
  type PriorDropNFT,
} from "@/lib/priorDrops";
import { fetchBoxesForOwnerAlchemy } from "@/lib/nftReads";
import { useMarketplaceListings } from "@/hooks/useMarketplaceListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { isAuctionExpired } from "@/lib/activeAuctionsFromEvents";
import { checkAuctionClosed } from "@/lib/marketplaceEvents";
import { fetchAllRMVData, type RMVData } from "@/lib/walletProfitLoss";
import CountdownDisplay from "@/components/CountdownDisplay";
import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";

import type { TrophySlot } from "@/hooks/useTrophyCase";
import TrophyCaseOverlay, {
  type OwnedRelic,
} from "@/components/TrophyCaseOverlay";
import { useActiveRedemptions } from "@/hooks/useActiveRedemptions";

interface CardData {
  tokenId: string;
  editionId: number;
  serial: number;
  name?: string;
  team?: string;
  thumb?: string;
  videoId?: string;
  tier?: string;
  minted?: number;
  gameDate?: string;
  createDate?: string;
  setName?: string;
  badge?: string;
  badge2?: string;
  badge3?: string;
  collectedDate?: string;
  marketPrice?: string | null;
  listingType?: "Listing" | "Auction" | null;
  endTimestamp?: number | null;
  auctionId?: string | null;
  maxBid?: string | null;
  isSettlementNeeded?: boolean;
}

export default function CollectionCards({
  ownerWallet = null,
  isOwnCollection = false,
  thirdwebDebug,
  isSelectionMode = false,
  isTrophyCaseFull = false,
  selectedRelicsOrder = [],
  onRelicSelectForTrophy,
  isRedemptionView = false,
  redemptionTeamFilter = null,
  onRelicSelectForRedemption,
  team = null,
  hideHeader = false,
  showTrophyBadges = false,
}: {
  ownerWallet?: string | null;
  isOwnCollection?: boolean;
  thirdwebDebug?: any;
  isSelectionMode?: boolean;
  isTrophyCaseFull?: boolean;
  selectedRelicsOrder?: {
    editionId: number;
    serial: number;
    tokenId: number;
  }[];
  onRelicSelectForTrophy?: (editionId: number, serial: number) => void;
  isRedemptionView?: boolean;
  redemptionTeamFilter?: string | null;
  onRelicSelectForRedemption?: (cardData: {
    editionId: number;
    serial: number;
    name?: string;
    setName?: string;
    tier?: string;
    team?: string;
    gameDate?: string;
    minted?: number;
    series?: string;
  }) => void;
  team?: string | null;
  hideHeader?: boolean;
  showTrophyBadges?: boolean;
}) {
  const betaAllowlist = useBetaAllowlist();
  const navigate = useNavigate();
  const location = useLocation();
  const { listings, loading: listingsLoading } = useMarketplaceListings();
  const { auctions, loading: auctionsLoading } = useActiveAuctions();
  const { isTokenRedeeming } = useActiveRedemptions();
  const rpcKey = (import.meta as any).env.RPC_KEY as string | undefined;

  const [activeFilter, setActiveFilter] = useState<
    "none" | "player" | "team" | "tier" | "set" | "sort"
  >("none");
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [selectedSet, setSelectedSet] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<string | null>(null);
  const [serialPrices, setSerialPrices] = useState<
    Record<string, string | null>
  >({});
  const [serialEndTimes, setSerialEndTimes] = useState<
    Record<string, number | null>
  >({});
  const [rmvDataMap, setRmvDataMap] = useState<Map<number, string | null>>(
    new Map(),
  );

  // Load relics based on collection type
  const [cards, setCards] = useState<CardData[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState<number>(24);
  const [marketplaceType, setMarketplaceType] = useState<"relics" | "boxes">(
    "relics",
  );
  const [priorDrops, setPriorDrops] = useState<PriorDropNFT[] | null>(null);
  const [ownedBoxTokenIds, setOwnedBoxTokenIds] = useState<number[] | null>(
    null,
  );
  const [ownedBoxCounts, setOwnedBoxCounts] = useState<Record<
    number,
    number
  > | null>(null);
  const [boxesLoading, setBoxesLoading] = useState<boolean>(true);
  const [winningBidsByAuctionId, setWinningBidsByAuctionId] = useState<
    Record<string, string | null>
  >({});

  // Track if we've ever loaded cards for this wallet (to avoid flashing on refetches)
  const hasLoadedCardsRef = useRef(false);

  // Reset the loaded flag when the wallet changes (switching to a different user's collection)
  useEffect(() => {
    hasLoadedCardsRef.current = false;
  }, [ownerWallet]);

  // Auto-apply team filter in redemption view
  useEffect(() => {
    if (isRedemptionView && redemptionTeamFilter) {
      setSelectedTeam(redemptionTeamFilter);
    }
  }, [isRedemptionView, redemptionTeamFilter]);

  // Initialize toggle state from URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("toggle") === "boxes") {
      setMarketplaceType("boxes");
    }
  }, [location.search]);

  // Fetch relics from Alchemy and Supabase
  useEffect(() => {
    if (marketplaceType !== "relics") return;

    let cancelled = false;
    const abortController = new AbortController();
    let loadingTimeoutId: NodeJS.Timeout | null = null;

    const loadRelics = async () => {
      try {
        // Only show loading state if we haven't loaded cards yet
        // For refetches (e.g., when listings change), keep showing previous cards
        // This prevents flashing and improves UX for quick operations
        if (!hasLoadedCardsRef.current) {
          loadingTimeoutId = setTimeout(() => {
            if (!cancelled) {
              setCardsLoading(true);
            }
          }, 300); // 300ms delay to avoid flashing during quick Alchemy calls
        }

        // Get token IDs from Alchemy with transfer times
        if (!ownerWallet || !rpcKey) {
          if (!cancelled) {
            if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
            hasLoadedCardsRef.current = true;
            setCards([]);
            setCardsLoading(false);
          }
          return;
        }

        // Check if aborted before making async call
        if (cancelled || abortController.signal.aborted) return;

        const tokensWithTime = await fetchRelicsFromAlchemy(
          ownerWallet,
          rpcKey,
        );

        if (cancelled) return;

        // Get token IDs from user's listings and active auctions
        const listingTokenIds = new Set<string>();
        const userAddress = ownerWallet.toLowerCase();

        // Add token IDs from direct listings where user is the seller
        for (const listing of listings) {
          if (listing.sellerAddress.toLowerCase() === userAddress) {
            listingTokenIds.add(listing.tokenId);
          }
        }

        // Add token IDs from active auctions where user is the creator
        // Include both active and expired auctions that haven't been settled yet
        const auctionTokenIds: Array<{
          tokenId: string;
          auctionId: string;
        }> = [];
        for (const auction of auctions) {
          if (auction.auctionCreator.toLowerCase() === userAddress) {
            auctionTokenIds.push({
              tokenId: auction.tokenId,
              auctionId: auction.auctionId,
            });
          }
        }

        // Check which auctions are closed/settled and filter them out
        for (const { tokenId, auctionId } of auctionTokenIds) {
          if (cancelled) return;
          try {
            const isClosed = await checkAuctionClosed(auctionId);
            if (!isClosed) {
              listingTokenIds.add(tokenId);
            }
          } catch (err: any) {
            if (cancelled) return;
            if (err?.name === "AbortError") return;
            // Continue with other auctions if one fails
            continue;
          }
        }

        // Combine Alchemy token IDs with listing/auction token IDs
        const tokenIdsFromAlchemy = new Set(
          tokensWithTime.map((t) => t.tokenId),
        );
        const allTokenIds = Array.from(
          new Set([...tokenIdsFromAlchemy, ...listingTokenIds]),
        );

        if (allTokenIds.length === 0) {
          if (!cancelled) {
            if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
            hasLoadedCardsRef.current = true;
            setCards([]);
            setCardsLoading(false);
          }
          return;
        }

        // Create a map of tokenId -> transferTime for quick lookup (only for Alchemy tokens)
        const transferTimeMap = new Map<string, string | undefined>();
        for (const token of tokensWithTime) {
          transferTimeMap.set(token.tokenId, token.transferTime);
        }

        const tokenIds = allTokenIds;

        if (cancelled || abortController.signal.aborted) return;

        // Fetch metadata from Supabase
        let relicDataMap: Map<string, RelicSerialWithMetadata> = new Map();
        try {
          // Don't pass the signal to avoid AbortError during cleanup
          // Instead, rely on the cancelled flag to prevent state updates
          relicDataMap = await fetchRelicSerialsByTokenIds(tokenIds);
        } catch (err: any) {
          if (cancelled) return;
          if (err?.name === "AbortError") {
            return;
          }
          throw err;
        }

        if (cancelled) return;

        // Create a map of tokenId -> auction for quick lookup
        const tokenIdToAuction = new Map<
          string,
          {
            auctionId: string;
            currentBidAmount: string | null;
            minimumBidAmount: string;
            endTimestamp: number;
            isExpired: boolean;
            isClosed: boolean;
          }
        >();

        for (const auction of auctions) {
          if (cancelled) return;
          try {
            const isExpired = isAuctionExpired(auction);
            const isClosed = await checkAuctionClosed(auction.auctionId);
            tokenIdToAuction.set(auction.tokenId, {
              auctionId: auction.auctionId,
              currentBidAmount: auction.currentBidAmount,
              minimumBidAmount: auction.minimumBidAmount,
              endTimestamp: auction.endTimestamp,
              isExpired,
              isClosed,
            });
          } catch (err: any) {
            if (cancelled) return;
            if (err?.name === "AbortError") return;
            // Continue with other auctions if one fails
            continue;
          }
        }

        // Convert to CardData
        const cardList: CardData[] = [];
        for (const [tokenId, relicData] of relicDataMap.entries()) {
          if (!relicData) continue;

          const video =
            relicData.video_location && String(relicData.video_location).trim();
          const url = video
            ? `https://image.mux.com/${video}/thumbnail.png?time=5`
            : null;
          const name = relicData.PlayerName
            ? String(relicData.PlayerName)
            : null;
          const team = relicData.team ? String(relicData.team) : null;
          const tier = relicData.TierValue ? String(relicData.TierValue) : null;
          const minted = relicData.Minted ?? null;
          const gameDate = relicData.GameDate
            ? String(relicData.GameDate)
            : null;
          const createDate = relicData.CreateDate
            ? String(relicData.CreateDate)
            : null;
          const setName = relicData.SetName ? String(relicData.SetName) : null;
          const collectedDate = transferTimeMap.get(tokenId);

          const b1 = (
            relicData.Badge1 ? String(relicData.Badge1) : ""
          ).toUpperCase();
          const badge =
            b1 === "CP"
              ? "/images/cp-badge.webp"
              : b1 === "RY"
                ? "/images/ry-badge.webp"
                : b1 === "CY"
                  ? "/images/cy-badge.webp"
                  : null;

          const b2 = (
            relicData.Badge2 ? String(relicData.Badge2) : ""
          ).toUpperCase();
          const badge2 =
            b2 === "CP"
              ? "/images/cp-badge.webp"
              : b2 === "RY"
                ? "/images/ry-badge.webp"
                : b2 === "CY"
                  ? "/images/cy-badge.webp"
                  : null;

          const b3 = (
            relicData.Badge3 ? String(relicData.Badge3) : ""
          ).toUpperCase();
          const badge3 =
            b3 === "CP"
              ? "/images/cp-badge.webp"
              : b3 === "RY"
                ? "/images/ry-badge.webp"
                : b3 === "CY"
                  ? "/images/cy-badge.webp"
                  : null;

          // Check if this token is in an unsettled auction
          const auctionData = tokenIdToAuction.get(tokenId);
          const isSettlementNeeded =
            auctionData && auctionData.isExpired && !auctionData.isClosed;

          cardList.push({
            tokenId,
            editionId: relicData.edition_id,
            serial: relicData.serial,
            name,
            team,
            thumb: url,
            videoId: video ?? undefined,
            tier,
            minted: minted ?? undefined,
            gameDate: gameDate ?? undefined,
            createDate: createDate ?? undefined,
            setName: setName ?? undefined,
            badge: badge ?? undefined,
            badge2: badge2 ?? undefined,
            badge3: badge3 ?? undefined,
            collectedDate: collectedDate ?? undefined,
            marketPrice: null,
            auctionId: auctionData?.auctionId ?? undefined,
            maxBid: auctionData?.minimumBidAmount ?? undefined,
            isSettlementNeeded,
          });
        }

        if (!cancelled) {
          if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
          hasLoadedCardsRef.current = true;
          setCards(cardList);
          setCardsLoading(false);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;

        console.error("[CollectionCards] Error loading relics:", err);
        if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
        if (!cancelled) {
          hasLoadedCardsRef.current = true;
          setCards([]);
          setCardsLoading(false);
        }
      }
    };

    loadRelics();

    return () => {
      cancelled = true;
      if (loadingTimeoutId) clearTimeout(loadingTimeoutId);
    };
  }, [ownerWallet, marketplaceType, rpcKey, listings, auctions]);

  // Fetch RMV data for redemption view
  useEffect(() => {
    if (!isRedemptionView) {
      setRmvDataMap(new Map());
      return;
    }

    let cancelled = false;

    const loadRMVData = async () => {
      try {
        const rmvData = await fetchAllRMVData();
        if (!cancelled) {
          const map = new Map<number, string | null>();
          for (const item of rmvData) {
            map.set(item.edition_id, item.rolling_median_sale);
          }
          setRmvDataMap(map);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error("[CollectionCards] Error loading RMV data:", err);
        if (!cancelled) {
          setRmvDataMap(new Map());
        }
      }
    };

    loadRMVData();

    return () => {
      cancelled = true;
    };
  }, [isRedemptionView]);

  // Load boxes
  useEffect(() => {
    if (marketplaceType !== "boxes") return;

    let active = true;
    const ctrl = new AbortController();
    setPriorDrops(null);

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error("Prior drops fetch timeout"));
      }, 10000);
    });

    Promise.race([fetchPriorDropNFTs({ signal: ctrl.signal }), timeoutPromise])
      .then((data) => {
        if (active) {
          setPriorDrops(data || []);
        }
      })
      .catch((err) => {
        if (!active) return;
        if (err?.name === "AbortError") return;

        console.warn("Prior drops loading complete or timed out", err?.message);
        setPriorDrops([]);
      });

    return () => {
      active = false;
      try {
        ctrl.abort();
      } catch (err) {
        // Silently ignore if already aborted
      }
    };
  }, [marketplaceType]);

  // Fetch wallet boxes via Alchemy
  useEffect(() => {
    if (marketplaceType !== "boxes") return;

    const addr = (ownerWallet || "").trim();
    if (!addr) {
      setOwnedBoxTokenIds([]);
      setOwnedBoxCounts({});
      setBoxesLoading(false);
      return;
    }

    let aborted = false;
    setBoxesLoading(true);

    const processBoxesBalance = (boxesBalance: Record<string, any>) => {
      if (aborted) return;

      const counts: Record<number, number> = {};
      const addCount = (idVal: any, qVal: any) => {
        let tid: number | null = null;
        if (idVal != null) {
          const s = String(idVal).trim();
          try {
            tid = /^0x/i.test(s) ? Number(BigInt(s)) : Number(s);
            if (!Number.isFinite(tid)) tid = null;
          } catch {
            tid = null;
          }
        }
        if (tid == null) return;
        let qty = 1;
        if (qVal != null) {
          const qs = String(qVal).trim();
          try {
            qty = /^0x/i.test(qs) ? Number(BigInt(qs)) : Number(qs);
            if (!Number.isFinite(qty)) qty = 1;
          } catch {
            qty = 1;
          }
        }
        if (qty > 0) counts[tid] = (counts[tid] ?? 0) + qty;
      };

      for (const [tokenId, balance] of Object.entries(boxesBalance)) {
        addCount(tokenId, balance);
      }

      if (Object.keys(counts).length === 0) {
        setOwnedBoxCounts({});
        setOwnedBoxTokenIds([]);
      } else {
        setOwnedBoxCounts(counts);
        setOwnedBoxTokenIds(Object.keys(counts).map((k) => Number(k)));
      }
      setBoxesLoading(false);
    };

    // Check if parent provided boxes data via thirdwebDebug
    if (
      thirdwebDebug &&
      thirdwebDebug.boxesBalance &&
      typeof thirdwebDebug.boxesBalance === "object" &&
      !thirdwebDebug.boxesBalance.error
    ) {
      console.log(
        "[CollectionCards] Using boxes data from parent (thirdwebDebug)",
        Object.keys(thirdwebDebug.boxesBalance).length,
      );
      processBoxesBalance(thirdwebDebug.boxesBalance);
      return;
    }

    (async () => {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error("Boxes fetch timeout"));
          }, 10000);
        });

        const boxesBalance = await Promise.race([
          fetchBoxesForOwnerAlchemy(addr),
          timeoutPromise,
        ]);

        processBoxesBalance(boxesBalance);
      } catch (err: any) {
        if (aborted) return;
        if (err?.name === "AbortError") return;

        console.warn(
          "Boxes fetch completed or timed out",
          (err as any)?.message,
        );
        if (!aborted) {
          setOwnedBoxTokenIds([]);
          setOwnedBoxCounts({});
          setBoxesLoading(false);
        }
      }
    })();

    return () => {
      aborted = true;
    };
  }, [ownerWallet, marketplaceType, thirdwebDebug]);

  // Apply marketplace data to cards
  useEffect(() => {
    if (!listings || !auctions || cards.length === 0) return;

    const pricesBySerial: Record<string, string | null> = {};
    const endTimesBySerial: Record<string, number | null> = {};

    // Build a map of token_id -> {price, endTime} from listings - only active
    const tokenIdToDataFromListings: Record<
      string,
      { price: string; endTime: number | null }
    > = {};
    if (listings && listings.length > 0) {
      for (const listing of listings) {
        if (listing.status !== 1) continue;
        const tokenIdStr = String(listing.tokenId);
        if (tokenIdStr) {
          const priceInWei = BigInt(listing.pricePerToken);
          const priceInTokens = Number(priceInWei) / 1e18;
          tokenIdToDataFromListings[tokenIdStr] = {
            price: `$${priceInTokens.toFixed(2)}`,
            endTime: listing.endTimestamp || null,
          };
        }
      }
    }

    // Build a map of token_id -> {price, endTime} from auctions - active or unsettled completed
    const tokenIdToDataFromAuctions: Record<
      string,
      { price: string; endTime: number | null }
    > = {};
    if (auctions && auctions.length > 0) {
      for (const auction of auctions) {
        const tokenIdStr = String(auction.tokenId);
        if (tokenIdStr && !tokenIdToDataFromListings[tokenIdStr]) {
          const isActive = auction.status === "active";
          const hasCurrentBid =
            auction.currentBidAmount && Number(auction.currentBidAmount) > 0;
          const isUnsettledCompleted =
            auction.status === "completed" && hasCurrentBid;

          if (isActive || isUnsettledCompleted) {
            const bidAmount = hasCurrentBid
              ? Number(auction.currentBidAmount)
              : isActive
                ? Number(auction.minimumBidAmount || 0)
                : 0;

            if (bidAmount > 0) {
              const bidInTokens = bidAmount / 1e18;
              tokenIdToDataFromAuctions[tokenIdStr] = {
                price: `$${bidInTokens.toFixed(2)}`,
                endTime: auction.endTimestamp || null,
              };
            }
          }
        }
      }
    }

    // Combine both maps (listings take precedence)
    const tokenIdToData = {
      ...tokenIdToDataFromAuctions,
      ...tokenIdToDataFromListings,
    };

    // Apply marketplace data to all cards
    for (const card of cards) {
      const serialKey = `${card.editionId}:${card.serial}`;
      const data = tokenIdToData[card.tokenId];
      pricesBySerial[serialKey] = data?.price || null;
      endTimesBySerial[serialKey] = data?.endTime || null;
    }

    setSerialPrices(pricesBySerial);
    setSerialEndTimes(endTimesBySerial);
  }, [cards, listings, auctions]);

  // Load auction cards for auctions created by ownerWallet
  const [auctionCards, setAuctionCards] = useState<CardData[]>([]);
  useEffect(() => {
    if (!ownerWallet || !auctions || auctions.length === 0) {
      setAuctionCards([]);
      return;
    }

    let cancelled = false;

    const loadAuctionCards = async () => {
      try {
        if (cancelled) return;

        const creatorAuctions = auctions.filter(
          (auction) =>
            auction.status === "active" &&
            auction.auctionCreator.toLowerCase() === ownerWallet.toLowerCase(),
        );

        if (creatorAuctions.length === 0) {
          setAuctionCards([]);
          return;
        }

        const auctionCardList: CardData[] = [];

        for (const auction of creatorAuctions) {
          if (
            auction.editionId === null ||
            auction.serial === null ||
            !auction.tokenId
          ) {
            continue;
          }

          try {
            const relicData = await fetchRelicSerialByEditionAndSerial(
              auction.editionId,
              auction.serial,
            );

            if (cancelled || !relicData) continue;

            const video =
              relicData.video_location &&
              String(relicData.video_location).trim();
            const url = video
              ? `https://image.mux.com/${video}/thumbnail.png?time=5`
              : null;
            const name = relicData.PlayerName
              ? String(relicData.PlayerName)
              : null;
            const team = relicData.team ? String(relicData.team) : null;
            const tier = relicData.TierValue
              ? String(relicData.TierValue)
              : null;
            const minted = relicData.Minted ?? null;
            const gameDate = relicData.GameDate
              ? String(relicData.GameDate)
              : null;
            const createDate = relicData.CreateDate
              ? String(relicData.CreateDate)
              : null;
            const setName = relicData.SetName
              ? String(relicData.SetName)
              : null;

            const b1 = (
              relicData.Badge1 ? String(relicData.Badge1) : ""
            ).toUpperCase();
            const badge =
              b1 === "CP"
                ? "/images/cp-badge.webp"
                : b1 === "RY"
                  ? "/images/ry-badge.webp"
                  : b1 === "CY"
                    ? "/images/cy-badge.webp"
                    : null;

            const b2 = (
              relicData.Badge2 ? String(relicData.Badge2) : ""
            ).toUpperCase();
            const badge2 =
              b2 === "CP"
                ? "/images/cp-badge.webp"
                : b2 === "RY"
                  ? "/images/ry-badge.webp"
                  : b2 === "CY"
                    ? "/images/cy-badge.webp"
                    : null;

            const b3 = (
              relicData.Badge3 ? String(relicData.Badge3) : ""
            ).toUpperCase();
            const badge3 =
              b3 === "CP"
                ? "/images/cp-badge.webp"
                : b3 === "RY"
                  ? "/images/ry-badge.webp"
                  : b3 === "CY"
                    ? "/images/cy-badge.webp"
                    : null;

            auctionCardList.push({
              tokenId: auction.tokenId,
              editionId: auction.editionId,
              serial: auction.serial,
              name,
              team,
              thumb: url,
              videoId: video ?? undefined,
              tier,
              minted: minted ?? undefined,
              gameDate: gameDate ?? undefined,
              createDate: createDate ?? undefined,
              setName: setName ?? undefined,
              badge: badge ?? undefined,
              badge2: badge2 ?? undefined,
              badge3: badge3 ?? undefined,
            });
          } catch (err) {
            console.error(
              `Failed to fetch relic data for auction ${auction.auctionId}:`,
              err,
            );
          }
        }

        if (!cancelled) {
          setAuctionCards(auctionCardList);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;

        console.error("Failed to load auction cards:", err);
        if (!cancelled) {
          setAuctionCards([]);
        }
      }
    };

    loadAuctionCards();

    return () => {
      cancelled = true;
    };
  }, [ownerWallet, auctions]);

  // Fetch winning bids for all auctions (active and expired) from contract
  useEffect(() => {
    if (!auctions || auctions.length === 0) {
      setWinningBidsByAuctionId({});
      return;
    }

    let cancelled = false;
    const MARKETPLACE_ADDRESS = (import.meta as any).env
      .VITE_MARKETPLACE_ADDRESS as string | undefined;

    const fetchWinningBids = async () => {
      const bidsMap: Record<string, number | null> = {};

      if (!MARKETPLACE_ADDRESS) {
        setWinningBidsByAuctionId({});
        return;
      }

      try {
        const client = getAlchemyThirdwebClient();
        const contract = getContract({
          address: MARKETPLACE_ADDRESS,
          chain: polygon,
          client,
        });

        for (const auction of auctions) {
          if (cancelled) return;

          try {
            const result = await readContract({
              contract,
              method:
                "function getWinningBid(uint256 _auctionId) returns (address, address, uint256)",
              params: [BigInt(auction.auctionId)],
            });

            if (result && result[2] !== undefined && result[2] > 0n) {
              bidsMap[auction.auctionId] = String(result[2]);
            } else {
              bidsMap[auction.auctionId] = null;
            }
          } catch (err) {
            bidsMap[auction.auctionId] = null;
          }
        }

        if (!cancelled) {
          setWinningBidsByAuctionId(bidsMap);
        }
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "AbortError") return;

        if (!cancelled) {
          setWinningBidsByAuctionId({});
        }
      }
    };

    fetchWinningBids();

    return () => {
      cancelled = true;
    };
  }, [auctions]);

  // Enrich cards with market prices
  const cardsWithPrices = useMemo(() => {
    const tokenIdToMarketData = new Map<
      string,
      {
        price: string | null;
        listingType: "Listing" | "Auction" | null;
        endTimestamp: number | null;
      }
    >();

    // Map listings - only active listings
    for (const listing of listings) {
      if (listing.status !== 1) continue;
      const tokenIdStr = String(listing.tokenId);
      const priceInWei = BigInt(listing.pricePerToken || 0);
      const priceInTokens = Number(priceInWei) / 1e18;
      const roundedPrice = Math.ceil(priceInTokens);
      tokenIdToMarketData.set(tokenIdStr, {
        price: `$${roundedPrice}`,
        listingType: "Listing",
        endTimestamp: listing.endTimestamp || null,
      });
    }

    // Map auctions only if not already in listing - active auctions or completed with pending settlement
    for (const auction of auctions) {
      const tokenIdStr = String(auction.tokenId);
      if (!tokenIdToMarketData.has(tokenIdStr)) {
        const isActive = auction.status === "active";
        const hasCurrentBid =
          auction.currentBidAmount && Number(auction.currentBidAmount) > 0;
        const isUnsettledCompleted =
          auction.status === "completed" && hasCurrentBid;

        if (isActive || isUnsettledCompleted) {
          // Use winning bid from smart contract if available, otherwise fall back to minimum bid
          const winningBid = winningBidsByAuctionId[auction.auctionId];
          const bidAmountToUse =
            winningBid !== null && winningBid !== undefined
              ? BigInt(Math.ceil(winningBid * 1e18))
              : BigInt(auction.minimumBidAmount || 0);

          const bidInTokens = Number(bidAmountToUse) / 1e18;
          const roundedPrice = Math.ceil(bidInTokens);
          tokenIdToMarketData.set(tokenIdStr, {
            price: `$${roundedPrice}`,
            listingType: "Auction",
            endTimestamp: auction.endTimestamp || null,
          });
        }
      }
    }

    // Merge owned cards with auction cards, deduplicating by tokenId
    const cardsByTokenId = new Map<string, CardData>();
    for (const card of cards) {
      cardsByTokenId.set(card.tokenId, card);
    }
    for (const card of auctionCards) {
      if (!cardsByTokenId.has(card.tokenId)) {
        cardsByTokenId.set(card.tokenId, card);
      }
    }
    const allCards = Array.from(cardsByTokenId.values());

    // Enrich cards with market prices and settlement bid info
    return allCards.map((card) => {
      const data = tokenIdToMarketData.get(card.tokenId);

      // Enrich settlement overlay with contract-fetched winning bid
      let enrichedMaxBid = card.maxBid;
      if (card.auctionId) {
        const contractWinningBid = winningBidsByAuctionId[card.auctionId];
        if (contractWinningBid !== null && contractWinningBid !== undefined) {
          enrichedMaxBid = String(contractWinningBid);
        }
      }

      return {
        ...card,
        marketPrice: data?.price || null,
        listingType: data?.listingType || null,
        endTimestamp: data?.endTimestamp || null,
        maxBid: enrichedMaxBid,
      };
    });
  }, [cards, listings, auctions, auctionCards, winningBidsByAuctionId]);

  // Memoized filters and sorting
  const playerNames = useMemo(() => {
    const names = new Set<string>();
    for (const card of cardsWithPrices) {
      if (card.name) names.add(card.name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [cardsWithPrices]);

  const teamNames = useMemo(() => {
    const names = new Set<string>();
    for (const card of cardsWithPrices) {
      if (card.team) names.add(card.team);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [cardsWithPrices]);

  const tierValues = useMemo(() => {
    const vals = new Set<string>();
    for (const card of cardsWithPrices) {
      if (card.tier) vals.add(card.tier);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  }, [cardsWithPrices]);

  const setNames = useMemo(() => {
    const vals = new Set<string>();
    for (const card of cardsWithPrices) {
      if (card.setName) vals.add(card.setName);
    }
    return Array.from(vals).sort((a, b) => a.localeCompare(b));
  }, [cardsWithPrices]);

  const filteredCards = useMemo(() => {
    let list = cardsWithPrices;
    if (selectedPlayer) {
      list = list.filter((card) => card.name === selectedPlayer);
    }
    if (selectedTeam) {
      list = list.filter((card) => card.team === selectedTeam);
    }
    if (selectedTier) {
      list = list.filter((card) => card.tier === selectedTier);
    }
    if (selectedSet) {
      list = list.filter((card) => card.setName === selectedSet);
    }
    return list;
  }, [
    cardsWithPrices,
    selectedPlayer,
    selectedTeam,
    selectedTier,
    selectedSet,
  ]);

  useEffect(() => {
    setVisibleCount(24);
  }, [filteredCards, selectedSort]);

  const sortedCards = useMemo(() => {
    const list = [...filteredCards];
    const opt = selectedSort ?? "Collected Date (Newest First)";

    const getDateMs = (s: any) => {
      if (!s) return null;
      const ms = Date.parse(String(s));
      return Number.isFinite(ms) ? ms : null;
    };

    const cmpNulls = (
      a: number | null,
      b: number | null,
      dir: "asc" | "desc",
    ) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return dir === "asc" ? a - b : b - a;
    };

    switch (opt) {
      case "Collected Date (Newest First)":
        list.sort((a, b) =>
          cmpNulls(
            getDateMs(a.collectedDate),
            getDateMs(b.collectedDate),
            "desc",
          ),
        );
        break;
      case "Collected Date (Oldest First)":
        list.sort((a, b) =>
          cmpNulls(
            getDateMs(b.collectedDate),
            getDateMs(a.collectedDate),
            "desc",
          ),
        );
        break;
      case "CreateDate (Recent to Oldest)":
        list.sort((a, b) =>
          cmpNulls(getDateMs(a.createDate), getDateMs(b.createDate), "desc"),
        );
        break;
      case "CreateDate (Oldest to Recent)":
        list.sort((a, b) =>
          cmpNulls(getDateMs(a.createDate), getDateMs(b.createDate), "asc"),
        );
        break;
      case "GameDate (Recent to Oldest)":
        list.sort((a, b) =>
          cmpNulls(getDateMs(a.gameDate), getDateMs(b.gameDate), "desc"),
        );
        break;
      case "GameDate (Oldest to Recent)":
        list.sort((a, b) =>
          cmpNulls(getDateMs(a.gameDate), getDateMs(b.gameDate), "asc"),
        );
        break;
      default:
        break;
    }
    return list;
  }, [filteredCards, selectedSort]);

  const tierCounts = useMemo(() => {
    const counts = { epic: 0, rare: 0, basic: 0, total: 0 };
    const allCards = [...cards, ...auctionCards];
    for (const card of allCards) {
      const tier = card.tier?.toLowerCase() || "";
      counts.total++;
      if (tier.includes("epic")) counts.epic++;
      else if (tier.includes("rare")) counts.rare++;
      else if (tier.includes("basic")) counts.basic++;
    }
    return counts;
  }, [cards, auctionCards]);

  const clearAllFilters = () => {
    setSelectedPlayer(null);
    setSelectedTeam(null);
    setSelectedTier(null);
    setSelectedSet(null);
    setSelectedSort(null);
  };

  if (betaAllowlist !== true) return null;

  return (
    <div
      className="mt-6 collection-cards-section"
      data-marketplace_type={marketplaceType}
    >
      {!isRedemptionView && !hideHeader && (
        <div className="w-full pb-[10px] flex items-center justify-between collection-cards-header">
          <div className="text-slate-800 text-[22px] font-normal tracking-wide leading-7 text-left">
            <p className="font-medium">Collection</p>
          </div>
          <div
            className="ml-2 flex items-center"
            role="group"
            aria-label="Type"
          >
            <button
              type="button"
              aria-pressed={marketplaceType === "relics"}
              className={`relative flex flex-col items-center justify-center text-center px-2 py-1.5 border w-16 bg-white border-slate-300 rounded-l-md dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] ${
                marketplaceType === "relics"
                  ? "text-slate-900"
                  : "text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)]"
              }`}
              onClick={() => {
                setMarketplaceType("relics");
                const params = new URLSearchParams(location.search);
                params.delete("toggle");
                const newSearch = params.toString();
                navigate(
                  `${location.pathname}${newSearch ? "?" + newSearch : ""}`,
                );
              }}
            >
              <span className="relative z-[1] flex flex-col items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="7" y="3" width="10" height="16" rx="2" />
                </svg>
                <span className="mt-1 text-[10px] leading-none">Relics</span>
              </span>
            </button>
            <button
              type="button"
              aria-pressed={marketplaceType === "boxes"}
              className={`relative -ml-px flex flex-col items-center justify-center text-center px-2 py-1.5 border w-16 bg-white border-slate-300 rounded-r-md dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] ${
                marketplaceType === "boxes"
                  ? "text-slate-900"
                  : "text-slate-800 shadow-[0_5px_0_0_rgba(226,232,240,1)]"
              }`}
              onClick={() => {
                setMarketplaceType("boxes");
                const params = new URLSearchParams(location.search);
                params.set("toggle", "boxes");
                navigate(`${location.pathname}?${params.toString()}`);
              }}
            >
              <span className="relative z-[1] flex flex-col items-center justify-center">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="5" y="10" width="14" height="8" rx="2" />
                  <rect x="4" y="7" width="16" height="3" rx="1" />
                </svg>
                <span className="mt-1 text-[10px] leading-none">Boxes</span>
              </span>
            </button>
            <input
              type="hidden"
              name="marketplace_type"
              value={marketplaceType}
            />
          </div>
        </div>
      )}

      <div className="flex justify-between items-center gap-4 m-0 p-0">
        <div className="text-xs text-slate-600 text-left">
          Filter and sort options
        </div>
        <div className="text-xs text-slate-600 text-right whitespace-nowrap">
          {tierCounts.epic > 0 && `E:${tierCounts.epic}, `}
          {tierCounts.rare > 0 && `R:${tierCounts.rare}, `}
          {tierCounts.basic > 0 && `B:${tierCounts.basic}, `}
          T:{tierCounts.total}
        </div>
      </div>

      <div
        className="mb-0 relative flex flex-nowrap items-stretch gap-0.5 w-full"
        role="toolbar"
        aria-label="Filter and sort options"
      >
        <FilterStyleButton
          type="button"
          className={`flex-1 basis-0 px-3 py-1.5 text-sm ${
            activeFilter === "player"
              ? "bg-slate-900 text-white border-slate-900"
              : ""
          }`}
          onClick={() =>
            setActiveFilter((p) => (p === "player" ? "none" : "player"))
          }
        >
          Player
          {selectedPlayer ? (
            <span aria-hidden="true" className="ml-1 text-xs align-middle">
              ✓
            </span>
          ) : null}
        </FilterStyleButton>
        {!isRedemptionView && (
          <FilterStyleButton
            type="button"
            className={`flex-1 basis-0 px-3 py-1.5 text-sm ${
              activeFilter === "team"
                ? "bg-slate-900 text-white border-slate-900"
                : ""
            }`}
            onClick={() =>
              setActiveFilter((p) => (p === "team" ? "none" : "team"))
            }
          >
            Team
            {selectedTeam ? (
              <span aria-hidden="true" className="ml-1 text-xs align-middle">
                ✓
              </span>
            ) : null}
          </FilterStyleButton>
        )}
        <FilterStyleButton
          type="button"
          className={`flex-1 basis-0 px-3 py-1.5 text-sm ${
            activeFilter === "tier"
              ? "bg-slate-900 text-white border-slate-900"
              : ""
          }`}
          onClick={() =>
            setActiveFilter((p) => (p === "tier" ? "none" : "tier"))
          }
        >
          Tier
          {selectedTier ? (
            <span aria-hidden="true" className="ml-1 text-xs align-middle">
              ✓
            </span>
          ) : null}
        </FilterStyleButton>
        <FilterStyleButton
          type="button"
          className={`flex-1 basis-0 px-3 py-1.5 text-sm ${
            activeFilter === "set"
              ? "bg-slate-900 text-white border-slate-900"
              : ""
          }`}
          onClick={() => setActiveFilter((p) => (p === "set" ? "none" : "set"))}
        >
          Set
          {selectedSet ? (
            <span aria-hidden="true" className="ml-1 text-xs align-middle">
              ✓
            </span>
          ) : null}
        </FilterStyleButton>
        <FilterStyleButton
          type="button"
          className={`flex-1 basis-0 px-3 py-1.5 text-sm ${
            activeFilter === "sort"
              ? "bg-slate-900 text-white border-slate-900"
              : ""
          }`}
          onClick={() =>
            setActiveFilter((p) => (p === "sort" ? "none" : "sort"))
          }
        >
          Sort
          {selectedSort ? (
            <span aria-hidden="true" className="ml-1 text-xs align-middle">
              ✓
            </span>
          ) : null}
        </FilterStyleButton>
        <FilterStyleButton
          type="button"
          className="flex-1 basis-0 px-3 py-1.5 text-sm"
          onClick={() => {
            clearAllFilters();
            setActiveFilter("none");
          }}
        >
          Clear
        </FilterStyleButton>
      </div>

      {/* Filter Panels */}
      <div
        className={`relative z-10 overflow-hidden transition-all duration-300 ${
          activeFilter === "player"
            ? "max-h-64 opacity-100"
            : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
          <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {playerNames.map((name) => (
              <button
                key={name}
                type="button"
                className={`px-2 py-1.5 text-sm rounded border text-left ${
                  selectedPlayer === name
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                }`}
                onClick={() => {
                  setSelectedPlayer(name);
                  setActiveFilter("none");
                }}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 overflow-hidden transition-all duration-300 ${
          activeFilter === "team" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
          <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {teamNames.map((t) => (
              <button
                key={t}
                type="button"
                className={`px-2 py-1.5 text-sm rounded border text-left ${
                  selectedTeam === t
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                }`}
                onClick={() => {
                  setSelectedTeam(t);
                  setActiveFilter("none");
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 overflow-hidden transition-all duration-300 ${
          activeFilter === "tier" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
          <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {tierValues.map((t) => (
              <button
                key={t}
                type="button"
                className={`px-2 py-1.5 text-sm rounded border text-left ${
                  selectedTier === t
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                }`}
                onClick={() => {
                  setSelectedTier(t);
                  setActiveFilter("none");
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 overflow-hidden transition-all duration-300 ${
          activeFilter === "set" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
          <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {setNames.map((s) => (
              <button
                key={s}
                type="button"
                className={`px-2 py-1.5 text-sm rounded border text-left ${
                  selectedSet === s
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                }`}
                onClick={() => {
                  setSelectedSet(s);
                  setActiveFilter("none");
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        className={`relative z-10 overflow-hidden transition-all duration-300 ${
          activeFilter === "sort" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
          <div className="max-h-40 overflow-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {[
              "Collected Date (Newest First)",
              "Collected Date (Oldest First)",
              "CreateDate (Recent to Oldest)",
              "CreateDate (Oldest to Recent)",
              "GameDate (Recent to Oldest)",
              "GameDate (Oldest to Recent)",
            ].map((opt) => (
              <button
                key={opt}
                type="button"
                className={`px-2 py-1.5 text-sm rounded border text-left ${
                  selectedSort === opt
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                }`}
                onClick={() => {
                  setSelectedSort(opt);
                  setActiveFilter("none");
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-[10px]" />

      {/* Boxes Marketplace Type */}
      {marketplaceType === "boxes" ? (
        boxesLoading ? (
          <div className="text-sm text-slate-600">Loading…</div>
        ) : ownedBoxTokenIds && ownedBoxTokenIds.length === 0 ? (
          <div className="text-sm text-slate-600">No unopened boxes owned.</div>
        ) : priorDrops == null || priorDrops.length === 0 ? (
          <div className="text-sm text-slate-600">No boxes found.</div>
        ) : (
          <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pb-6">
            {priorDrops
              .filter((box) => {
                const boxTokenId = getTokenIdString(box.id);
                return ownedBoxTokenIds.some(
                  (ownedId) => String(ownedId) === boxTokenId,
                );
              })
              .map((box) => {
                const boxTokenId = getTokenIdString(box.id);
                const boxUrl = resolveMediaUrl(box.metadata?.image);
                const balance = ownedBoxCounts?.[Number(boxTokenId)] ?? 0;
                const attributeMap = buildPriorDropAttributeMap(
                  box.metadata?.attributes,
                );

                return (
                  <li key={boxTokenId} className="flex flex-col h-fit">
                    <Link
                      to={boxTokenId ? `/box/${boxTokenId}` : "#"}
                      className="block flex-1"
                      style={{
                        boxShadow: "1px 1px 3px 1px rgba(155, 155, 155, 1)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        className="bg-white dark:bg-slate-800 rounded-[1px] overflow-hidden shadow-sm flex flex-col"
                        style={{ aspectRatio: "1 / 1.4" }}
                      >
                        {boxUrl ? (
                          <div
                            className="relative w-full"
                            style={{ height: "79%" }}
                          >
                            <img
                              src={boxUrl}
                              alt={box.metadata?.name ?? `Box ${boxTokenId}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                            {balance > 0 && (
                              <div className="absolute top-2 left-2 z-20 bg-[#4169E1] text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                x{balance}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex w-full flex-1 items-center justify-center bg-slate-100 dark:bg-slate-700 text-sm text-slate-500 dark:text-slate-400">
                            Image unavailable
                          </div>
                        )}
                        <div className="flex flex-col items-center justify-center flex-1 gap-0.5 px-2 py-1 text-xs text-slate-700 dark:text-slate-300">
                          {attributeMap.tier && (
                            <div
                              style={{ fontWeight: "600", fontSize: "16px" }}
                            >
                              {attributeMap.tier} Box
                            </div>
                          )}
                          {attributeMap.drop_week && (
                            <div>Week of {attributeMap.drop_week}</div>
                          )}
                          {attributeMap.series && (
                            <div>{attributeMap.series}</div>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
          </ul>
        )
      ) : cardsLoading ? (
        <div className="text-sm text-slate-600">Loading…</div>
      ) : sortedCards.length === 0 ? (
        isOwnCollection ? (
          <div className="text-sm text-slate-600 text-center w-full py-6">
            No relics found. Collect some{" "}
            <Link to="/market" className="underline">
              HERE
            </Link>
            .
          </div>
        ) : (
          <div className="text-sm text-slate-600 text-center w-full py-6">
            No relics found.
          </div>
        )
      ) : (
        <>
          <ul className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pb-6">
            {sortedCards.slice(0, visibleCount).map((card) => {
              const linkPath = `/edition/${card.editionId}/serial/${card.serial}`;

              return (
                <li
                  key={card.tokenId}
                  className={`flex flex-col h-fit relative ${isRedemptionView ? "card-shadow-responsive card-shadow" : ""}`}
                >
                  <Link
                    to={linkPath}
                    onClick={(e) => {
                      if (isRedemptionView) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Prevent selection if token is being redeemed
                        if (isTokenRedeeming(card.tokenId)) {
                          return;
                        }
                        if (onRelicSelectForRedemption) {
                          onRelicSelectForRedemption({
                            editionId: card.editionId,
                            serial: card.serial,
                            name: card.name,
                            setName: card.setName,
                            tier: card.tier,
                            team: card.team,
                            gameDate: card.gameDate,
                            minted: card.minted,
                            series: card.team,
                          });
                        }
                        return;
                      }
                      if (isSelectionMode && isOwnCollection) {
                        e.preventDefault();
                        e.stopPropagation();
                        onRelicSelectForTrophy?.(card.editionId, card.serial);
                      }
                    }}
                    className={`block flex-1 ${
                      isTokenRedeeming(card.tokenId)
                        ? ""
                        : (isSelectionMode &&
                              isOwnCollection &&
                              !isRedemptionView) ||
                            isRedemptionView
                          ? "cursor-pointer"
                          : ""
                    }`}
                  >
                    <div className="relative">
                      <CollectionSerialCard
                        id={card.editionId}
                        name={card.name}
                        thumb={card.thumb}
                        tier={card.tier}
                        serial={card.serial}
                        minted={card.minted}
                        gameDate={card.gameDate}
                        createDate={card.createDate}
                        setName={card.setName}
                        badge={card.badge}
                        badge2={card.badge2}
                        badge3={card.badge3}
                        team={card.team}
                        isSettlementNeeded={card.isSettlementNeeded}
                        maxBid={card.maxBid}
                        disableShadow={isRedemptionView}
                      />
                      {isTokenRedeeming(card.tokenId) ? (
                        <div className="absolute inset-0 bg-black/50 text-[#FF6300] flex items-center justify-center font-medium">
                          <div className="text-[20px] leading-[28px] font-medium">
                            Redeeming
                          </div>
                        </div>
                      ) : card.marketPrice ? (
                        <div className="absolute inset-0 bg-black/45 text-[#FF6300] flex flex-col items-center justify-center font-medium">
                          <div className="text-[12px] leading-[16px] font-medium">
                            {card.listingType}
                          </div>
                          <div className="text-[24px] leading-[32px] font-medium">
                            {card.marketPrice || "—"}
                          </div>
                          {card.endTimestamp &&
                          card.endTimestamp * 1000 - Date.now() > 0 &&
                          card.endTimestamp * 1000 - Date.now() <
                            365 * 24 * 60 * 60 * 1000 ? (
                            <CountdownDisplay
                              endTimestampSeconds={card.endTimestamp}
                              showLabel={false}
                              className="text-sm font-medium"
                              style={{ color: "rgba(255, 99, 0, 1)" }}
                            />
                          ) : null}
                        </div>
                      ) : null}
                      {showTrophyBadges && (() => {
                        const slotIndex = selectedRelicsOrder.findIndex(
                          (r) =>
                            r.editionId === card.editionId &&
                            r.serial === card.serial,
                        );
                        if (slotIndex >= 0) {
                          return (
                            <div className="absolute inset-0 flex items-center justify-center"
                              style={{ pointerEvents: 'none' }}
                            >
                              <div className="w-24 h-24 rounded-full flex flex-col items-center justify-center font-bold text-white"
                                style={{
                                  background:
                                    "linear-gradient(135deg, #004FFF 0%, #FF6300 100%)",
                                  pointerEvents: 'auto',
                                  zIndex: 10,
                                }}
                              >
                                <div className="text-sm">Trophy</div>
                                <div className="text-2xl">{slotIndex + 1}</div>
                              </div>
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </Link>
                  {isRedemptionView && (
                    <div className="border-t border-slate-200 dark:border-slate-700 px-1 py-1 text-xs bg-white dark:bg-slate-800 text-center">
                      <p className="text-slate-700 dark:text-slate-400">
                        RMV:&nbsp;
                      </p>
                      <span className="text-[#FF6300] font-medium text-base">
                        {(() => {
                          const rmvValue = rmvDataMap.get(card.editionId);
                          if (!rmvValue) return "—";
                          try {
                            const numValue = Number(rmvValue);
                            if (!Number.isFinite(numValue)) return "—";
                            const converted = numValue / 1e18;
                            return converted.toFixed(2);
                          } catch {
                            return "—";
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {sortedCards.length > visibleCount ? (
            <div className="mt-2">
              <button
                type="button"
                className="relative overflow-hidden flex items-center justify-center text-center w-full px-3 py-1.5 text-sm rounded border bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"
                onClick={() =>
                  setVisibleCount((c) => Math.min(c + 24, sortedCards.length))
                }
              >
                FIND MORE
              </button>
            </div>
          ) : null}

          {!hideHeader && (
            <div className="mt-6 text-center">
              <FilterStyleButton
                onClick={() =>
                  navigate(
                    `/market?team=${encodeURIComponent(team || sortedCards[0]?.team || "")}`,
                  )
                }
                className="text-[14px] text-slate-800 dark:text-slate-200 w-auto inline-flex"
              >
                Shop for more
              </FilterStyleButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
