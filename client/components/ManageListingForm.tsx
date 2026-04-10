import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { useMarketplace, ALLOWED_CONTRACT_ADDRESSES } from "@/hooks/useMarketplace";
import { getContract, prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { setApprovalForAll } from "thirdweb/extensions/erc721";
import { fetchMintedByEditionId, type MintedRow } from "@/lib/supabaseMinted";
import { fetchRelicSerialByEditionAndSerial } from "@/lib/supabaseRelicSerialsJoined";
import { ListingCard } from "@/components/market/ListingCard";
import { AuctionCardCompact } from "@/components/market/AuctionCard";
import type { ActiveListing } from "@/lib/activeListings";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";

type ListingType = "direct" | "auction";

const CUSTOM_ERC20_ADDRESS = "0x1505F1122C8D08008DBac7B9D9dadDE4a1c64e71";
const ERC721_ADDRESS = import.meta.env.VITE_ERC721_ADDRESS || "";

function getLocalISODateString(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export type ManageListingFormProps = {
  editionId?: number | null;
  serial?: number | null;
  onCancel?: () => void;
};

export default function ManageListingForm({
  editionId = null,
  serial = null,
  onCancel,
}: ManageListingFormProps) {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const { contract } = useMarketplace();
  const { listings: activeListings, refetch: refetchListings } =
    useActiveListings();
  const { auctions: activeAuctions, refetch: refetchAuctions } =
    useActiveAuctions();

  const [editionData, setEditionData] = useState<
    (MintedRow & { SeriesName?: string; TierValue?: string }) | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [listingType, setListingType] = useState<ListingType>("direct");
  const [tokenId, setTokenId] = useState("");
  const [price, setPrice] = useState("");
  const [auctionBuyoutPrice, setAuctionBuyoutPrice] = useState("");
  const [startTimestamp, setStartTimestamp] = useState(
    getLocalISODateString(new Date()),
  );
  const [endTimestamp, setEndTimestamp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const reloadScheduledRef = useRef(false);

  // Handle success message and reload
  useEffect(() => {
    if (submitSuccess) {
      if (reloadScheduledRef.current) {
        return;
      }

      reloadScheduledRef.current = true;
      const timer = setTimeout(() => {
        window.location.reload();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [submitSuccess]);

  // Fetch token ID for edition/serial
  useEffect(() => {
    if (!editionId || !serial) {
      setTokenId("");
      return;
    }

    (async () => {
      try {
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
      }
    })();
  }, [editionId, serial]);

  // Fetch edition data
  useEffect(() => {
    if (!editionId) {
      setEditionData(null);
      return;
    }

    const editionIdNum = parseInt(String(editionId), 10);
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
      } finally {
        setIsLoading(false);
      }
    };

    loadEditionData();
  }, [editionId]);

  // Find active listing and auction for this relic
  const activeListing = useMemo(() => {
    if (!editionId || !serial || activeListings.length === 0) return null;

    return activeListings.find(
      (listing) =>
        listing.editionId === editionId &&
        listing.serial === serial &&
        listing.status === "active",
    ) as ActiveListing | null;
  }, [editionId, serial, activeListings]);

  const activeAuction = useMemo(() => {
    if (!editionId || !serial || activeAuctions.length === 0) return null;

    return activeAuctions.find(
      (auction) =>
        auction.editionId === editionId &&
        auction.serial === serial &&
        auction.status === "active",
    ) as ActiveAuction | null;
  }, [editionId, serial, activeAuctions]);

  const listingDurationInSeconds = useMemo(() => {
    if (!endTimestamp) return null;
    const startMs = new Date(startTimestamp).getTime();
    const endMs = new Date(endTimestamp).getTime();
    const durationSeconds = Math.floor((endMs - startMs) / 1000);
    return durationSeconds > 0 ? durationSeconds : null;
  }, [startTimestamp, endTimestamp]);

  const isValidContract = useMemo(() => {
    return ALLOWED_CONTRACT_ADDRESSES.includes(ERC721_ADDRESS);
  }, []);

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
      refetchListings();
      refetchAuctions();
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to create listing",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function createDirectListing(
    tId: string,
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
      address: ERC721_ADDRESS,
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
          assetContract: ERC721_ADDRESS,
          tokenId: BigInt(tId),
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
    tId: string,
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
      address: ERC721_ADDRESS,
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
          assetContract: ERC721_ADDRESS,
          tokenId: BigInt(tId),
          quantity: 1n,
          currency: CUSTOM_ERC20_ADDRESS,
          minimumBidAmount: minimumBidInWei,
          buyoutBidAmount: buyoutBidInWei,
          timeBufferInSeconds: 900n,
          bidBufferBps: 500n,
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

  if (!account) {
    return (
      <div className="p-6 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <p className="text-slate-600 dark:text-slate-400">
          Please connect your wallet to create a listing.
        </p>
      </div>
    );
  }

  if (submitSuccess) {
    return (
      <div className="p-6 flex items-center justify-center min-h-32">
        <p className="text-lg font-medium text-slate-800 dark:text-white text-center">
          Success! Your listing is now on the marketplace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activeListing && (
        <div>
          <h3 className="text-lg font-semibold mb-3 dark:text-white">
            Current Listing
          </h3>
          <ListingCard
            listing={activeListing}
            onCancelSuccess={() => {
              refetchListings();
              onCancel?.();
            }}
            onClose={onCancel}
            editionIdProp={editionId ?? undefined}
            serialProp={serial ?? undefined}
          />
        </div>
      )}

      {activeAuction && (
        <div>
          <h3 className="text-lg font-semibold mb-3 dark:text-white">
            Current Auction
          </h3>
          <AuctionCardCompact
            auction={activeAuction}
            onCancelSuccess={() => {
              refetchAuctions();
              onCancel?.();
            }}
            onClose={onCancel}
            editionIdProp={editionId ?? undefined}
            serialProp={serial ?? undefined}
          />
        </div>
      )}

      {!activeListing && !activeAuction && (
        <form
          onSubmit={handleCreateListing}
          className="space-y-[18px] pt-[18px] px-6 pb-6"
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
              disabled={isSubmitting || !isValidContract || submitSuccess}
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
              onClick={onCancel}
              className="flex-1 bg-slate-300 hover:bg-slate-400 dark:bg-slate-600 dark:hover:bg-slate-700 dark:text-white font-medium py-2 px-4 rounded transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
