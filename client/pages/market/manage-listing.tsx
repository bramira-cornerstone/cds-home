import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";

import {
  useMarketplace,
  ALLOWED_CONTRACT_ADDRESSES,
} from "@/hooks/useMarketplace";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { useEditionMetadata } from "@/hooks/useEditionMetadata";
import { ListingCard } from "@/components/market/ListingCard";
import { AuctionCardCompact } from "@/components/market/AuctionCard";
import { OfferCard } from "@/components/market/OfferCard";
import SerialCardMiniWrapper from "@/components/SerialCardMiniWrapper";
import type { Listing } from "@/hooks/useMarketplaceListings";
import type { ActiveListing } from "@/lib/activeListings";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ListingType = "direct" | "auction";

const CUSTOM_ERC20_ADDRESS = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";
const ERC1155_ADDRESS = import.meta.env.VITE_ERC1155_ADDRESS || "";

function getLocalISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

interface OfferCarouselProps {
  offers: Array<any>;
}

function OffersCarousel({ offers }: OfferCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ align: "start" });
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      setCanScrollPrev(emblaApi.canScrollPrev());
      setCanScrollNext(emblaApi.canScrollNext());
    };

    emblaApi.on("init", onSelect);
    emblaApi.on("reInit", onSelect);
    emblaApi.on("select", onSelect);
    emblaApi.on("scroll", onSelect);

    onSelect();

    return () => {
      emblaApi.off("init", onSelect);
      emblaApi.off("reInit", onSelect);
      emblaApi.off("select", onSelect);
      emblaApi.off("scroll", onSelect);
    };
  }, [emblaApi]);

  return (
    <div className="relative -my-3">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6 py-3">
          {offers.map((offer) => (
            <div
              key={offer.offerId}
              className="flex-[0_0_100%] md:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
            >
              <OfferCard offer={offer} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2 mt-4 justify-center md:justify-end">
        <button
          onClick={() => emblaApi?.scrollPrev()}
          disabled={!canScrollPrev}
          className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Previous"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => emblaApi?.scrollNext()}
          disabled={!canScrollNext}
          className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          aria-label="Next"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default function ManageListingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{
    editionId?: string;
    serial?: string;
    tokenId?: string;
  }>();
  const account = useActiveAccount();
  const { contract, loading, error } = useMarketplace();
  const { listings: activeListings, refetch: refetchListings } =
    useActiveListings();
  const { auctions: activeAuctions, refetch: refetchAuctions } =
    useActiveAuctions();
  const { offers } = useActiveOffers();

  const editionId = useMemo(
    () => (params.editionId ? parseInt(params.editionId, 10) : null),
    [params.editionId],
  );
  const { metadata: editionMetadata } = useEditionMetadata(editionId);

  const locationState = (location.state as any) || {};
  const [listingType, setListingType] = useState<ListingType>("direct");
  const [contractAddress, setContractAddress] = useState(
    locationState.assetContract || "",
  );
  const [tokenId, setTokenId] = useState(
    locationState.tokenId ? String(locationState.tokenId) : "",
  );
  const [price, setPrice] = useState("");
  const [auctionBuyoutPrice, setAuctionBuyoutPrice] = useState("");
  const [startTimestamp, setStartTimestamp] = useState(
    getLocalISODateString(new Date()),
  );
  const [endTimestamp, setEndTimestamp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);
  const [fetchingTokenId, setFetchingTokenId] = useState(false);
  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);

  const listingDurationInSeconds = useMemo(() => {
    if (!endTimestamp) return null;
    const startMs = new Date(startTimestamp).getTime();
    const endMs = new Date(endTimestamp).getTime();
    const durationSeconds = Math.floor((endMs - startMs) / 1000);
    return durationSeconds > 0 ? durationSeconds : null;
  }, [startTimestamp, endTimestamp]);

  const isEditionSerialRoute = useMemo(() => {
    return (
      params.editionId && params.serial && location.pathname.includes("serial")
    );
  }, [params.editionId, params.serial, location.pathname]);

  const isBoxDetailRoute = useMemo(() => {
    return (
      params.tokenId && location.pathname.includes("detail/manage-listing")
    );
  }, [params.tokenId, location.pathname]);

  const filteredOffers = useMemo(() => {
    if (!params.editionId || !params.serial) {
      return [];
    }

    const editionIdNum = parseInt(params.editionId, 10);
    const serialNum = parseInt(params.serial, 10);

    const filtered = offers.filter(
      (offer) => offer.editionId === editionIdNum && offer.serial === serialNum,
    );

    return filtered.sort((a, b) => {
      const priceA = BigInt(a.totalPrice);
      const priceB = BigInt(b.totalPrice);

      if (priceA !== priceB) {
        return priceA > priceB ? -1 : 1;
      }

      return a.offerId - b.offerId;
    });
  }, [offers, params.editionId, params.serial]);

  const activeListing = useMemo(() => {
    if (activeListings.length === 0) {
      return null;
    }

    let matching = null;

    // Check by edition/serial if it's an edition serial route
    if (isEditionSerialRoute && params.editionId && params.serial) {
      const editionId = parseInt(params.editionId, 10);
      const serial = parseInt(params.serial, 10);
      matching = activeListings.find(
        (listing) =>
          listing.editionId === editionId &&
          listing.serial === serial &&
          listing.status === "active",
      );
    }
    // Check by tokenId if it's a box detail route
    else if (isBoxDetailRoute && params.tokenId) {
      matching = activeListings.find(
        (listing) =>
          listing.tokenId === params.tokenId && listing.status === "active",
      );
    }

    if (!matching) {
      return null;
    }

    return {
      ...matching,
      seller: matching.sellerAddress,
      expirationTimestamp: matching.endTimestamp,
      startTime: matching.startTimestamp,
      endTime: matching.endTimestamp,
    } as Listing;
  }, [
    isEditionSerialRoute,
    isBoxDetailRoute,
    params.editionId,
    params.serial,
    params.tokenId,
    activeListings,
  ]);

  const activeAuction = useMemo(() => {
    if (activeAuctions.length === 0) {
      return null;
    }

    let matching = null;

    // Check by edition/serial if it's an edition serial route
    if (isEditionSerialRoute && params.editionId && params.serial) {
      const editionId = parseInt(params.editionId, 10);
      const serial = parseInt(params.serial, 10);
      matching = activeAuctions.find(
        (auction) =>
          auction.editionId === editionId &&
          auction.serial === serial &&
          auction.status === "active",
      );
    }
    // Check by tokenId if it's a box detail route
    else if (isBoxDetailRoute && params.tokenId) {
      matching = activeAuctions.find(
        (auction) =>
          auction.tokenId === params.tokenId && auction.status === "active",
      );
    }

    if (!matching) {
      return null;
    }

    return matching;
  }, [
    isEditionSerialRoute,
    isBoxDetailRoute,
    params.editionId,
    params.serial,
    params.tokenId,
    activeAuctions,
  ]);

  useEffect(() => {
    if (locationState.assetContract) {
      setContractAddress(locationState.assetContract);
    } else if (isEditionSerialRoute) {
      setContractAddress(ERC721_ADDRESS);
    } else if (isBoxDetailRoute) {
      setContractAddress(ERC1155_ADDRESS);
    }
  }, [locationState.assetContract, isEditionSerialRoute, isBoxDetailRoute]);

  useEffect(() => {
    if (locationState.tokenId) {
      setTokenId(String(locationState.tokenId));
    } else if (isBoxDetailRoute && params.tokenId) {
      setTokenId(String(params.tokenId));
    } else if (isEditionSerialRoute && params.editionId && params.serial) {
      setFetchingTokenId(true);
      (async () => {
        try {
          const editionId = Number(params.editionId);
          const serial = Number(params.serial);
          const claim = await fetchRelicSerialByEditionAndSerial(
            editionId,
            serial,
            undefined,
          );
          const tokenIdRaw =
            (claim as any)?.token_id ?? (claim as any)?.tokenId ?? null;
          if (tokenIdRaw != null) {
            setTokenId(String(tokenIdRaw));
          }
        } catch (err) {
          console.error("Failed to fetch token ID:", err);
        } finally {
          setFetchingTokenId(false);
        }
      })();
    }
  }, [locationState.tokenId, isBoxDetailRoute, isEditionSerialRoute, params]);

  useEffect(() => {
    if (!params.editionId) {
      setEditionData(null);
      return;
    }

    const editionIdNum = parseInt(params.editionId, 10);
    if (!Number.isFinite(editionIdNum)) {
      setEditionData(null);
      return;
    }

    const loadEditionData = async () => {
      try {
        const data = await fetchMintedByEditionId(editionIdNum);
        setEditionData(data);
      } catch (err) {
        setEditionData(null);
      }
    };

    loadEditionData();
  }, [params.editionId]);

  useEffect(() => {
    if (redirectTarget) {
      const timer = setTimeout(() => {
        navigate(redirectTarget);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [redirectTarget, navigate]);

  if (!account) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-[12px] dark:text-white">
            Create Listing
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Please connect your wallet to create a listing.
          </p>
        </div>
      </div>
    );
  }

  const isValidContract = ALLOWED_CONTRACT_ADDRESSES.some(
    (addr) => addr.toLowerCase() === contractAddress.toLowerCase(),
  );

  async function handleCreateListing(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!account) {
      setSubmitError("Wallet not connected");
      return;
    }

    if (!isValidContract) {
      setSubmitError(
        `Invalid contract address. Allowed addresses: ${ALLOWED_CONTRACT_ADDRESSES.join(", ")}`,
      );
      return;
    }

    if (!tokenId || !price) {
      setSubmitError("Please fill in all required fields");
      return;
    }

    if (parseFloat(price) === 0) {
      setSubmitError("Can not be $0");
      return;
    }

    if (endTimestamp && startTimestamp) {
      const startMs = new Date(startTimestamp).getTime();
      const endMs = new Date(endTimestamp).getTime();
      if (endMs <= startMs) {
        setSubmitError("End time must be after start time");
        return;
      }
    }

    if (listingType === "auction") {
      if (auctionBuyoutPrice && parseFloat(auctionBuyoutPrice) === 0) {
        setSubmitError("Can not be $0");
        return;
      }
      if (!startTimestamp) {
        setSubmitError("Please set a start time for the auction");
        return;
      }
    }

    try {
      setIsSubmitting(true);

      if (listingType === "direct") {
        await createDirectListing(
          tokenId,
          price,
          startTimestamp,
          listingDurationInSeconds || null,
        );
      } else {
        await createAuctionListing(
          tokenId,
          price,
          startTimestamp,
          listingDurationInSeconds || null,
        );
      }

      setSubmitSuccess(true);
      if (params.editionId && params.serial) {
        setRedirectTarget(
          `/edition/${params.editionId}/serial/${params.serial}`,
        );
      } else {
        setRedirectTarget("/market");
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create listing",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createDirectListing(
    tokenId: string,
    priceValue: string,
    startTimeISOString: string,
    durationInSeconds: number | null,
  ) {
    if (!contract || !account)
      throw new Error("Marketplace or wallet not loaded");

    const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
    if (!MARKETPLACE_ADDRESS) {
      throw new Error("Marketplace address not configured");
    }

    const assetContract = getContract({
      address: contractAddress,
      chain: contract.chain,
      client: contract.client,
    });

    const approvalTransaction = setApprovalForAll({
      contract: assetContract,
      operator: MARKETPLACE_ADDRESS,
      approved: true,
    });

    await sendAndConfirmTransaction({
      transaction: approvalTransaction,
      account,
    });

    const priceInWei = BigInt(Math.floor(parseFloat(priceValue) * 1e18));

    const startTimestampSeconds = Math.floor(
      new Date(startTimeISOString).getTime() / 1000,
    );
    const expirationTimestampSeconds = durationInSeconds
      ? startTimestampSeconds + durationInSeconds
      : startTimestampSeconds + 100 * 365.25 * 24 * 60 * 60;

    const transaction = prepareContractCall({
      contract,
      method:
        "function createListing((address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 pricePerToken, uint128 startTimestamp, uint128 endTimestamp, bool reserved) params)",
      params: [
        {
          assetContract: contractAddress,
          tokenId: BigInt(tokenId),
          quantity: 1n,
          currency: CUSTOM_ERC20_ADDRESS,
          pricePerToken: priceInWei,
          startTimestamp: startTimestampSeconds,
          endTimestamp: expirationTimestampSeconds,
          reserved: false,
        },
      ],
    });

    await sendAndConfirmTransaction({
      transaction,
      account,
    });
  }

  async function createAuctionListing(
    tokenId: string,
    priceValue: string,
    startTimeISOString: string,
    durationInSeconds: number | null,
  ) {
    if (!contract || !account)
      throw new Error("Marketplace or wallet not loaded");

    const MARKETPLACE_ADDRESS = import.meta.env.VITE_MARKETPLACE_ADDRESS || "";
    if (!MARKETPLACE_ADDRESS) {
      throw new Error("Marketplace address not configured");
    }

    const assetContract = getContract({
      address: contractAddress,
      chain: contract.chain,
      client: contract.client,
    });

    const approvalTransaction = setApprovalForAll({
      contract: assetContract,
      operator: MARKETPLACE_ADDRESS,
      approved: true,
    });

    await sendAndConfirmTransaction({
      transaction: approvalTransaction,
      account,
    });

    const minimumBidInWei = BigInt(Math.floor(parseFloat(priceValue) * 1e18));
    const buyoutBidInWei = BigInt(
      Math.floor(
        parseFloat(auctionBuyoutPrice || parseFloat(priceValue) * 5) * 1e18,
      ),
    );

    const startTimestampSeconds = BigInt(
      Math.floor(new Date(startTimeISOString).getTime() / 1000),
    );
    const auctionDurationSeconds = durationInSeconds || 60 * 60 * 24 * 7;
    const endTimestampSeconds =
      startTimestampSeconds + BigInt(auctionDurationSeconds);

    const transaction = prepareContractCall({
      contract,
      method:
        "function createAuction((address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 minimumBidAmount, uint256 buyoutBidAmount, uint64 timeBufferInSeconds, uint64 bidBufferBps, uint64 startTimestamp, uint64 endTimestamp) params)",
      params: [
        {
          assetContract: contractAddress,
          tokenId: BigInt(tokenId),
          quantity: 1n,
          currency: CUSTOM_ERC20_ADDRESS,
          minimumBidAmount: minimumBidInWei,
          buyoutBidAmount: buyoutBidInWei,
          timeBufferInSeconds: 900n,
          bidBufferBps: 10n,
          startTimestamp: startTimestampSeconds,
          endTimestamp: endTimestampSeconds,
        },
      ],
    });

    await sendAndConfirmTransaction({
      transaction,
      account,
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-4 dark:text-white">
            Create Listing
          </h1>
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-4 dark:text-white">
            Create Listing
          </h1>
          <p className="text-red-600">
            Error: {error || "Marketplace not available"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white dark:bg-slate-900 p-8"
      data-manage-listing-container
    >
      <div className="max-w-2xl mx-auto flex flex-col">
        <h1 className="text-3xl font-bold mb-[4px] dark:text-white">
          <p>Manage Listing</p>
        </h1>

        {editionData && params.serial && (
          <h6 className="text-sm text-slate-600 dark:text-slate-400 text-center mx-auto sm:text-left sm:mx-0 mb-3 sm:mb-3">
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

        <div className="flex flex-col items-start lg:flex-row lg:items-start gap-6">
          {/* Left Column: SerialCardMini */}
          {editionId && params.serial && (
            <div
              className="flex-none max-sm:flex max-sm:flex-col max-sm:mx-auto"
              data-tablet-flex-col
            >
              <SerialCardMiniWrapper
                id={editionId}
                name={editionMetadata?.name}
                thumb={editionMetadata?.thumb}
                serial={parseInt(params.serial, 10)}
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

          {/* Right Column: Listing/Form/Offers */}
          <div className="flex-1 w-full lg:w-auto">
            {activeListing && (
              <div className="mb-[12px]">
                <h2 className="text-2xl font-normal mb-1.5 dark:text-white">
                  Current Listing
                </h2>
                <ListingCard
                  listing={activeListing}
                  onCancelSuccess={refetchListings}
                  editionIdProp={
                    params.editionId
                      ? parseInt(params.editionId, 10)
                      : undefined
                  }
                  serialProp={
                    params.serial ? parseInt(params.serial, 10) : undefined
                  }
                />
              </div>
            )}

            {activeAuction && (
              <div className="mb-[12px]">
                <h2 className="text-2xl font-normal mb-1.5 dark:text-white">
                  Current Auction
                </h2>
                <AuctionCardCompact
                  auction={activeAuction}
                  onCancelSuccess={refetchAuctions}
                  editionIdProp={
                    params.editionId
                      ? parseInt(params.editionId, 10)
                      : undefined
                  }
                  serialProp={
                    params.serial ? parseInt(params.serial, 10) : undefined
                  }
                />
              </div>
            )}

            {!activeListing && !activeAuction && (
              <>
                <form
                  onSubmit={handleCreateListing}
                  className="space-y-[18px] pt-[18px] px-6 pb-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow"
                  style={{ boxShadow: "2px 2px 3px 0 rgba(155, 155, 155, 1)" }}
                >
                  {submitError && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      <p>Create Listing Type</p>
                    </label>
                    <div className="flex gap-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="direct"
                          checked={listingType === "direct"}
                          onChange={(e) =>
                            setListingType(e.target.value as ListingType)
                          }
                          className="w-4 h-4"
                        />
                        <span className="dark:text-slate-300">
                          Direct Listing
                        </span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input
                          type="radio"
                          value="auction"
                          checked={listingType === "auction"}
                          onChange={(e) =>
                            setListingType(e.target.value as ListingType)
                          }
                          className="w-4 h-4"
                        />
                        <span className="dark:text-slate-300">Auction</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      {listingType === "direct" ? "Price" : "Minimum Bid"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      Start Time
                    </label>
                    <input
                      type="datetime-local"
                      value={startTimestamp}
                      onChange={(e) => setStartTimestamp(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {listingType === "direct"
                        ? "When the listing will become available"
                        : "When the auction will start accepting bids"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2 dark:text-white">
                      End Time
                    </label>
                    <input
                      type="datetime-local"
                      value={endTimestamp}
                      onChange={(e) => setEndTimestamp(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {listingType === "direct"
                        ? "Optional: When the listing will expire (if blank, the listing never expires)"
                        : `When the auction will end and stop accepting bids (if blank, defaults to 7 days after start time)`}
                      {listingDurationInSeconds && (
                        <span className="block mt-1">
                          Duration:{" "}
                          {Math.floor(listingDurationInSeconds / 86400)} days,{" "}
                          {Math.floor(
                            (listingDurationInSeconds % 86400) / 3600,
                          )}{" "}
                          hours
                        </span>
                      )}
                    </p>
                  </div>

                  {listingType === "auction" && (
                    <div>
                      <label className="block text-sm font-medium mb-2 dark:text-white">
                        <p>Buyout Price</p>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={auctionBuyoutPrice}
                        onChange={(e) => setAuctionBuyoutPrice(e.target.value)}
                        placeholder={String(parseFloat(price) * 5) || "0.00"}
                        className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
                      />
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        Leave empty to default to 500% of minimum bid
                      </p>
                    </div>
                  )}

                  <div className="flex gap-4 pt-4 mt-[18px]">
                    <button
                      type="submit"
                      disabled={
                        isSubmitting || !isValidContract || submitSuccess
                      }
                      className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition"
                    >
                      <p>
                        {submitSuccess
                          ? "Success!"
                          : isSubmitting
                            ? "Submitting..."
                            : "Submit"}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (params.editionId && params.serial) {
                          navigate(
                            `/edition/${params.editionId}/serial/${params.serial}`,
                          );
                        } else {
                          navigate("/market");
                        }
                      }}
                      disabled={submitSuccess}
                      className="flex-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white font-medium py-2 px-4 rounded transition sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>

                  {listingType === "auction" && (
                    <div className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 p-3 rounded mt-6 sm:mt-6 max-sm:mt-2">
                      Active auctions can only be canceled before a bid on them
                      has been placed.
                    </div>
                  )}
                </form>
              </>
            )}

            {filteredOffers.length > 0 && (
              <div className="mt-[12px]">
                <h2 className="text-2xl font-normal mb-1.5 dark:text-white sm:mt-3">
                  Current Offers
                </h2>
                <OffersCarousel offers={filteredOffers} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
