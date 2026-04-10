import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import {
  useMarketplace,
  ALLOWED_CONTRACT_ADDRESSES,
} from "@/hooks/useMarketplace";
import {
  getContract,
  prepareContractCall,
  sendAndConfirmTransaction,
} from "thirdweb";
import { setApprovalForAll } from "thirdweb/extensions/erc721";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { ListingCard } from "@/components/market/ListingCard";
import { OfferCard } from "@/components/market/OfferCard";
import type { Listing } from "@/hooks/useMarketplaceListings";
import type { ActiveListing } from "@/lib/activeListings";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ListingType = "direct" | "auction";

const CUSTOM_ERC20_ADDRESS = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";
const ERC1155_ADDRESS = import.meta.env.VITE_ERC1155_ADDRESS || "";

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
    <div className="relative">
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-6">
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

export default function CreateListingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{
    editionId?: string;
    serial?: string;
    tokenId?: string;
  }>();
  const account = useActiveAccount();
  const { contract, loading, error } = useMarketplace();
  const { listings: activeListings } = useActiveListings();
  const { offers } = useActiveOffers();

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
    new Date().toISOString().slice(0, 16),
  );
  const [endTimestamp, setEndTimestamp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
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
      params.tokenId && location.pathname.includes("detail/create-listing")
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
    if (
      !isEditionSerialRoute ||
      !params.editionId ||
      !params.serial ||
      activeListings.length === 0
    ) {
      return null;
    }

    const editionId = parseInt(params.editionId, 10);
    const serial = parseInt(params.serial, 10);

    const matching = activeListings.find(
      (listing) => listing.editionId === editionId && listing.serial === serial,
    );

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
  }, [isEditionSerialRoute, params.editionId, params.serial, activeListings]);

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

  if (!account) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-4 dark:text-white">
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

      if (params.editionId && params.serial) {
        navigate(`/edition/${params.editionId}/serial/${params.serial}`);
      } else {
        navigate("/market");
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
        parseFloat(auctionBuyoutPrice || parseFloat(priceValue) * 1.2) * 1e18,
      ),
    );

    const startTimestampSeconds = Math.floor(
      new Date(startTimeISOString).getTime() / 1000,
    );
    const auctionDurationSeconds = durationInSeconds || 60 * 60 * 24 * 7;
    const endTimestampSeconds = startTimestampSeconds + auctionDurationSeconds;

    const transaction = prepareContractCall({
      contract,
      method:
        "function createAuction((address assetContract, uint256 tokenId, uint256 quantity, address currency, uint256 minimumBidAmount, uint256 buyoutBidAmount, uint64 timeBufferInSeconds, uint16 bidBufferBps, uint64 startTimestamp, uint64 endTimestamp) params)",
      params: [
        {
          assetContract: contractAddress,
          tokenId: BigInt(tokenId),
          quantity: 1n,
          currency: CUSTOM_ERC20_ADDRESS,
          minimumBidAmount: minimumBidInWei,
          buyoutBidAmount: buyoutBidInWei,
          timeBufferInSeconds: 900n,
          bidBufferBps: 500,
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
    <div className="min-h-screen bg-white dark:bg-slate-900 p-8">
      <div className="max-w-2xl mx-auto flex flex-col">
        <h1 className="text-3xl font-bold mb-8 dark:text-white">
          <p>Manage Listing</p>
        </h1>

        {editionData && params.serial && (
          <h6 className="text-sm text-slate-600 dark:text-slate-400 mb-8 text-center mx-auto sm:text-left sm:mx-0">
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

        {activeListing && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-1.5 dark:text-white sm:font-light">
              Current Listing
            </h2>
            <ListingCard listing={activeListing} />
          </div>
        )}

        <h2 className="text-2xl font-bold mb-1.5 dark:text-white mt-8 sm:font-light">
          Create or Update Listing
        </h2>

        <form
          onSubmit={handleCreateListing}
          className="space-y-6 p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow listing-card-mobile-shadow"
        >
          {submitError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 p-4 rounded">
              {submitError}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2 dark:text-white">
              Listing Type
            </label>
            <div className="flex gap-4">
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
                <span className="dark:text-slate-300">Direct Listing</span>
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
              {listingType === "direct" ? "Price" : "Minimum Bid"} in
              Cornerstone Cash (COR)
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
                  Duration: {Math.floor(listingDurationInSeconds / 86400)} days,{" "}
                  {Math.floor((listingDurationInSeconds % 86400) / 3600)} hours
                </span>
              )}
            </p>
          </div>

          {listingType === "auction" && (
            <div>
              <label className="block text-sm font-medium mb-2 dark:text-white">
                <p>Buyout Price in Cornerstone Cash (COR)</p>
              </label>
              <input
                type="number"
                step="0.01"
                value={auctionBuyoutPrice}
                onChange={(e) => setAuctionBuyoutPrice(e.target.value)}
                placeholder={String(parseFloat(price) * 1.2) || "0.00"}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 dark:text-white"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Leave empty to default to 120% of minimum bid
              </p>
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !isValidContract}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-medium py-2 px-4 rounded transition"
            >
              <p>Submit</p>
            </button>
            <button
              type="button"
              onClick={() => navigate("/market")}
              className="flex-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white font-medium py-2 px-4 rounded transition sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </form>

        {filteredOffers.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-1.5 dark:text-white sm:font-light">
              Current Offers
            </h2>
            <OffersCarousel offers={filteredOffers} />
          </div>
        )}
      </div>
    </div>
  );
}
