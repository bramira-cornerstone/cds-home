import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import {
  fetchRelicSerialsJoinedByEditionId,
  fetchRelicSerialByEditionAndSerial,
  fetchUsernameByWalletAddress,
} from "@/lib/supabaseRelicSerialsJoined";
import { getOwnerDisplayName } from "@/lib/auctionHouse";
import { getRankLevelBadgeImage } from "@/lib/teamRmvChartData";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
} from "@/lib/rmvPerOwner";
import BuyOfferBidPanel from "@/components/BuyOfferBidPanel";

interface ActiveSerialListingsProps {
  editionId: number;
  isSerialPage?: boolean;
}

interface SellerInfo {
  username: string;
  rankLevel: string | undefined;
}

export default function ActiveSerialListings({
  editionId,
  isSerialPage = false,
}: ActiveSerialListingsProps) {
  const navigate = useNavigate();
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();

  const [serials, setSerials] = useState<number[]>([]);
  const [sellerInfo, setSellerInfo] = useState<Record<number, SellerInfo>>({});
  const [serialListingPrices, setSerialListingPrices] = useState<
    Record<number, string>
  >({});
  const [loading, setLoading] = useState(false);
  const [carouselOffset, setCarouselOffset] = useState(0);
  const [selectedSerial, setSelectedSerial] = useState<number | null>(null);
  const [viewerCounts, setViewerCounts] = useState<Record<string, number>>({});
  const [instanceId] = useState(() => `${Date.now()}-${Math.random()}`);

  // Track open menus across browser tabs using localStorage
  useEffect(() => {
    const updateViewerCounts = () => {
      const activeMenus = JSON.parse(localStorage.getItem("activeMenus") || "{}");
      const counts: Record<string, number> = {};

      // Count the number of instances for each menu
      for (const [key, instances] of Object.entries(activeMenus)) {
        if (Array.isArray(instances)) {
          counts[key] = instances.length;
        }
      }

      setViewerCounts(counts);
    };

    // Listen for storage changes from other tabs
    window.addEventListener("storage", updateViewerCounts);

    // Initial update
    updateViewerCounts();

    return () => {
      window.removeEventListener("storage", updateViewerCounts);
    };
  }, []);

  // Update localStorage when selected serial changes
  useEffect(() => {
    const menuKey = `${editionId}-${selectedSerial}`;
    const activeMenus = JSON.parse(localStorage.getItem("activeMenus") || "{}");

    if (selectedSerial !== null) {
      // Add this instance to the list of open menus for this key
      if (!Array.isArray(activeMenus[menuKey])) {
        activeMenus[menuKey] = [];
      }
      if (!activeMenus[menuKey].includes(instanceId)) {
        activeMenus[menuKey].push(instanceId);
      }
    } else {
      // Remove this instance from all menu keys
      for (const key in activeMenus) {
        if (Array.isArray(activeMenus[key])) {
          activeMenus[key] = activeMenus[key].filter((id: string) => id !== instanceId);
          if (activeMenus[key].length === 0) {
            delete activeMenus[key];
          }
        }
      }
    }

    localStorage.setItem("activeMenus", JSON.stringify(activeMenus));

    // Update viewer counts
    const counts: Record<string, number> = {};
    for (const [key, instances] of Object.entries(activeMenus)) {
      if (Array.isArray(instances)) {
        counts[key] = instances.length;
      }
    }
    setViewerCounts(counts);

    // Notify other tabs of the change
    window.dispatchEvent(new StorageEvent("storage", {
      key: "activeMenus",
      newValue: JSON.stringify(activeMenus),
    }));
  }, [selectedSerial, editionId, instanceId]);

  // Filter serials to only those with active listings or auctions
  const serialsWithActiveListings = useMemo(() => {
    if (serials.length === 0) return [];

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

    return Array.from(serialsSet);
  }, [serials, editionId, activeListings, activeAuctions]);

  // Map serials to their listing prices (or auction highest bid)
  useEffect(() => {
    if (serialsWithActiveListings.length === 0) {
      setSerialListingPrices({});
      return;
    }

    const prices: Record<number, string> = {};

    const fetchAuctionBidData = async (auctionId: string) => {
      const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
      const anonKey = import.meta.env.SUPABASE_ANON_KEY as
        | string
        | undefined;

      if (!baseUrl || !anonKey) return null;

      try {
        const root = baseUrl.replace(/\/$/, "");
        const params = new URLSearchParams({
          auction_id: `eq.${encodeURIComponent(auctionId)}`,
          select: "minimum_bid_amount,max_bid",
        });

        const response = await fetch(
          `${root}/rest/v1/marketplace_events_with_relics?${params.toString()}`,
          {
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${anonKey}`,
              Accept: "application/json",
            },
          },
        );

        if (!response.ok) return null;

        const events = (await response.json()) as Array<{
          minimum_bid_amount?: string;
          max_bid?: string;
        }>;

        if (!Array.isArray(events) || events.length === 0) return null;

        // Find the maximum of minimum_bid_amount and max_bid across all events
        let maxBidWei = BigInt(0);
        for (const event of events) {
          const minBid = event.minimum_bid_amount
            ? BigInt(event.minimum_bid_amount)
            : BigInt(0);
          const maxBid = event.max_bid ? BigInt(event.max_bid) : BigInt(0);
          const eventMax = minBid > maxBid ? minBid : maxBid;
          if (eventMax > maxBidWei) {
            maxBidWei = eventMax;
          }
        }

        return maxBidWei > BigInt(0) ? maxBidWei : null;
      } catch (err) {
        console.error(
          "[ActiveSerialListings] Error fetching auction bid data:",
          err,
        );
        return null;
      }
    };

    const fetchPrices = async () => {
      for (const serial of serialsWithActiveListings) {
        // First check for active listing
        const listing = activeListings?.find(
          (l) =>
            l.editionId === editionId &&
            l.serial === serial &&
            l.status === "active",
        );
        if (listing && listing.pricePerToken) {
          const priceInWei = BigInt(listing.pricePerToken);
          const priceInTokens = Number(priceInWei) / 1e18;
          prices[serial] = `$${priceInTokens.toFixed(2)}`;
          continue;
        }

        // If no listing, check for active auction
        const auction = activeAuctions?.find(
          (a) =>
            a.editionId === editionId &&
            a.serial === serial &&
            a.status === "active",
        );
        if (auction) {
          const maxBidWei = await fetchAuctionBidData(auction.auctionId);
          if (maxBidWei !== null) {
            const priceInTokens = Number(maxBidWei) / 1e18;
            prices[serial] = `$${priceInTokens.toFixed(2)}`;
          }
        }
      }
      setSerialListingPrices(prices);
    };

    fetchPrices();
  }, [serialsWithActiveListings, editionId, activeListings, activeAuctions]);

  // Map serials to their listing type (direct or auction)
  const serialListingTypes = useMemo(() => {
    const types: Record<number, "direct" | "auction" | null> = {};

    for (const serial of serialsWithActiveListings) {
      // Check for active listing first
      const listing = activeListings?.find(
        (l) =>
          l.editionId === editionId &&
          l.serial === serial &&
          l.status === "active",
      );
      if (listing) {
        types[serial] = listing.listingType || null;
        continue;
      }

      // Check for active auction
      const auction = activeAuctions?.find(
        (a) =>
          a.editionId === editionId &&
          a.serial === serial &&
          a.status === "active",
      );
      if (auction) {
        types[serial] = "auction";
      }
    }
    return types;
  }, [serialsWithActiveListings, editionId, activeListings, activeAuctions]);

  // Sort serials by price (lowest-high), with ties broken by serial number (lowest first)
  const sortedSerialsByPrice = useMemo(() => {
    const sorted = [...serialsWithActiveListings];
    sorted.sort((a, b) => {
      const aPriceStr = serialListingPrices[a];
      const bPriceStr = serialListingPrices[b];

      const aPrice = aPriceStr ? parseFloat(aPriceStr.replace("$", "")) : null;
      const bPrice = bPriceStr ? parseFloat(bPriceStr.replace("$", "")) : null;

      // Both have prices: compare prices, break ties with serial number
      if (aPrice !== null && bPrice !== null) {
        if (aPrice !== bPrice) {
          return aPrice - bPrice; // Lowest price first
        }
        return a - b; // Same price: lowest serial first
      }

      // One has a price: price comes first
      if (aPrice !== null) return -1;
      if (bPrice !== null) return 1;

      // Neither has a price: sort by serial number
      return a - b;
    });
    return sorted;
  }, [serialsWithActiveListings, serialListingPrices]);

  // Fetch all serials for the edition
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchRelicSerialsJoinedByEditionId(editionId, undefined)
      .then((ser) => {
        if (!cancelled) {
          setSerials(ser);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSerials([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [editionId]);

  // Fetch seller info for all serials with active listings
  useEffect(() => {
    if (serialsWithActiveListings.length === 0) {
      setSellerInfo({});
      return;
    }

    const fetchAllSellers = async () => {
      const info: Record<number, SellerInfo> = {};

      // Fetch RMV data once
      const rmvData = await fetchRMVPerOwner();

      for (const serial of serialsWithActiveListings) {
        try {
          const claim = await fetchRelicSerialByEditionAndSerial(
            editionId,
            serial,
            undefined,
          );
          const tokenIdRaw =
            (claim as any)?.token_id ?? (claim as any)?.tokenId ?? null;

          if (tokenIdRaw == null) {
            info[serial] = { username: "Unknown", rankLevel: undefined };
            continue;
          }

          const tokenIdInt =
            typeof tokenIdRaw === "bigint"
              ? Number(tokenIdRaw)
              : Number(tokenIdRaw);
          if (!Number.isFinite(tokenIdInt)) {
            info[serial] = { username: "Unknown", rankLevel: undefined };
            continue;
          }

          const rpcKey = (import.meta as any).env.RPC_KEY as
            | string
            | undefined;
          if (!rpcKey) {
            info[serial] = { username: "Unknown", rankLevel: undefined };
            continue;
          }

          const contractAddress = (import.meta as any).env.VITE_ERC721_ADDRESS as string | undefined;
          if (!contractAddress) {
            info[serial] = { username: "Unknown", rankLevel: undefined };
            continue;
          }
          const selector = "6352211e";
          const tokenIdHex = tokenIdInt.toString(16).padStart(64, "0");
          const data = `0x${selector}${tokenIdHex}`;

          const rpcUrl = `https://polygon-mainnet.g.alchemy.com/v2/${encodeURIComponent(rpcKey)}`;
          const rpcResponse = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "eth_call",
              params: [{ to: contractAddress, data }, "latest"],
              id: 1,
            }),
          });

          if (!rpcResponse.ok) {
            info[serial] = { username: "", rankLevel: undefined };
            continue;
          }

          const rpcData = await rpcResponse.json().catch(() => null);
          if (!rpcData?.result || rpcData.result === "0x") {
            info[serial] = { username: "", rankLevel: undefined };
            continue;
          }

          const ownerAddress = ("0x" + rpcData.result.slice(-40)).toUpperCase();
          const username = await fetchUsernameByWalletAddress(
            ownerAddress,
            undefined,
          );
          const displayName = getOwnerDisplayName(username || ownerAddress);

          // Fetch RMV record for this owner to get rank level
          let rankLevel: string | undefined = undefined;
          const rmvRecord = findRMVByOwner(rmvData, ownerAddress);
          if (rmvRecord) {
            rankLevel = calculateRankLevel(rmvRecord.Percentile);
          }

          info[serial] = {
            username: displayName,
            rankLevel,
          };
        } catch (e) {
          info[serial] = { username: "", rankLevel: undefined };
        }
      }

      setSellerInfo(info);
    };

    fetchAllSellers();
  }, [editionId, serialsWithActiveListings]);

  // Track current time for countdown calculations
  // Updated only every 10 seconds instead of every second to reduce performance violations
  const [countdownTickCounter, setCountdownTickCounter] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTickCounter((prev) => prev + 1);
    }, 10000); // Update every 10 seconds instead of every second
    return () => clearInterval(interval);
  }, []);

  const getCurrentTime = () => Math.floor(Date.now() / 1000);

  // Map serials to their end times
  const serialEndTimes = useMemo(() => {
    const endTimes: Record<number, number | null> = {};

    for (const serial of serialsWithActiveListings) {
      // Check for active listing first
      const listing = activeListings?.find(
        (l) =>
          l.editionId === editionId &&
          l.serial === serial &&
          l.status === "active",
      );
      if (listing) {
        endTimes[serial] = listing.endTimestamp || null;
        continue;
      }

      // Check for active auction
      const auction = activeAuctions?.find(
        (a) =>
          a.editionId === editionId &&
          a.serial === serial &&
          a.status === "active",
      );
      if (auction) {
        endTimes[serial] = auction.endTimestamp || null;
      }
    }
    return endTimes;
  }, [serialsWithActiveListings, editionId, activeListings, activeAuctions]);

  // Function to format remaining time as "Xd Xh Xm Xs"
  const formatCountdown = (endTimestamp: number | null): string => {
    if (!endTimestamp) return "";

    const secondsRemaining = Math.max(0, endTimestamp - getCurrentTime());
    if (secondsRemaining <= 0) return "0d 0h 0m 0s";

    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);
    const seconds = secondsRemaining % 60;

    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
  };

  // Function to check if end time is within 365 days from now
  const isWithin365Days = (endTimestamp: number | null): boolean => {
    if (!endTimestamp) return false;
    const secondsRemaining = endTimestamp - getCurrentTime();
    const SECONDS_IN_365_DAYS = 365 * 86400;
    return secondsRemaining <= SECONDS_IN_365_DAYS;
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-slate-800 dark:text-white">
          <div style={{ color: "rgba(30, 41, 59, 1)" }}>
            Available for Purchase ({serialsWithActiveListings.length})
          </div>
        </div>
        <button
          onClick={() => navigate(`/edition/${editionId}/serials`)}
          className="text-xs text-blue-600 underline hover:text-blue-700 transition-colors dark:text-blue-400 dark:hover:text-blue-300"
        >
          View All Serials
        </button>
      </div>
      {!isSerialPage && serialsWithActiveListings.length > 0 && (
        <>
          {/* Mobile carousel view */}
          <div className="block sm:hidden relative mb-2">
            <div className="overflow-hidden">
              <div className="overflow-hidden flex-1">
                <div
                  className="flex gap-1.5 transition-transform duration-300"
                  style={{
                    transform: `translateX(calc(-${carouselOffset} * (calc(100% / 3.5 + 6px))))`,
                  }}
                >
                  {sortedSerialsByPrice.map((serial) => (
                    <div
                      key={serial}
                      onClick={() =>
                        setSelectedSerial(selectedSerial === serial ? null : serial)
                      }
                      className="flex-shrink-0 flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                      style={{
                        width: "calc(100% / 3.5)",
                        boxShadow: "1px 1px 1px 1px rgba(155, 155, 155, 1)",
                      }}
                    >
                      {/* Serial number */}
                      <div className="px-[2px] py-[2px] bg-white dark:bg-slate-700/50 flex items-center justify-center">
                        <div className="text-xs font-bold text-slate-800 dark:text-white">
                          #{serial}
                        </div>
                      </div>

                      {/* Price */}
                      <div className="px-[2px] py-[2px] flex items-center justify-center">
                        <div
                          className="text-[11px] text-slate-800 dark:text-white"
                          style={{ fontWeight: "300" }}
                        >
                          {serial in serialListingPrices
                            ? serialListingPrices[serial]
                            : "—"}
                        </div>
                      </div>

                      {/* Rank badge */}
                      <div className="px-[2px] py-[2px] flex items-center justify-center min-h-[35px]">
                        {serial in sellerInfo &&
                          sellerInfo[serial].rankLevel && (
                            <img
                              src={`/images/${getRankLevelBadgeImage(sellerInfo[serial].rankLevel!)}`}
                              alt={sellerInfo[serial].rankLevel}
                              className="max-h-[24px] object-contain"
                            />
                          )}
                      </div>

                      {/* Countdown timer placeholder */}
                      <div className="px-[2px] py-[2px] flex items-center justify-center" />

                      {/* Username */}
                      <div className="px-[2px] py-[2px] flex items-center justify-center">
                        <div
                          className="text-[10px] text-slate-700 dark:text-slate-300 truncate text-center"
                          style={{ fontWeight: "300", lineHeight: "12px" }}
                        >
                          {serial in sellerInfo
                            ? sellerInfo[serial].username || "—"
                            : "Loading..."}
                        </div>
                      </div>

                      {/* Countdown timer */}
                      {serial in serialEndTimes &&
                      serialEndTimes[serial] &&
                      isWithin365Days(serialEndTimes[serial]) ? (
                        <div
                          className="text-[10px] text-center mt-auto"
                          style={{
                            fontWeight: "300",
                            lineHeight: "12px",
                            color: "#FF6300",
                          }}
                        >
                          {formatCountdown(serialEndTimes[serial])}
                        </div>
                      ) : (
                        <div className="mt-auto" />
                      )}

                      {/* Listing button */}
                      <div
                        className="w-full px-[2px] py-[2px] bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center"
                        style={{ lineHeight: "12px" }}
                      >
                        {serial in serialListingTypes &&
                        serialListingTypes[serial] === "auction"
                          ? "Auction"
                          : "Listing"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                type="button"
                aria-label="Previous"
                onClick={() =>
                  setCarouselOffset(Math.max(0, carouselOffset - 1))
                }
                disabled={carouselOffset === 0}
                className={`absolute left-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow border border-slate-200 hover:bg-white z-10 transition-opacity ${
                  carouselOffset > 0
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next"
                onClick={() =>
                  setCarouselOffset(
                    Math.min(
                      sortedSerialsByPrice.length - Math.ceil(3.5),
                      carouselOffset + 1,
                    ),
                  )
                }
                disabled={
                  carouselOffset >= sortedSerialsByPrice.length - Math.ceil(3.5)
                }
                className={`absolute right-1 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow border border-slate-200 hover:bg-white z-10 transition-opacity ${
                  carouselOffset < sortedSerialsByPrice.length - Math.ceil(3.5)
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          {/* Desktop grid view */}
          <div className="hidden sm:grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5 mb-px">
            {sortedSerialsByPrice.map((serial) => (
              <div
                key={serial}
                onClick={() =>
                  setSelectedSerial(selectedSerial === serial ? null : serial)
                }
                className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden hover:shadow-md transition-shadow mb-1.5 cursor-pointer"
                style={{
                  boxShadow: "1px 1px 1px 1px rgba(155, 155, 155, 1)",
                }}
              >
                {/* Serial number */}
                <div className="px-[2px] py-[2px] bg-white dark:bg-slate-700/50 flex items-center justify-center">
                  <div className="text-xs font-bold text-slate-800 dark:text-white">
                    #{serial}
                  </div>
                </div>

                {/* Price */}
                <div className="px-[2px] py-[2px] flex items-center justify-center">
                  <div
                    className="text-[11px] text-slate-800 dark:text-white"
                    style={{ fontWeight: "300" }}
                  >
                    {serial in serialListingPrices
                      ? serialListingPrices[serial]
                      : "—"}
                  </div>
                </div>

                {/* Rank badge */}
                <div className="px-[2px] py-[2px] flex items-center justify-center min-h-[35px]">
                  {serial in sellerInfo && sellerInfo[serial].rankLevel && (
                    <img
                      src={`/images/${getRankLevelBadgeImage(sellerInfo[serial].rankLevel!)}`}
                      alt={sellerInfo[serial].rankLevel}
                      className="max-h-[24px] object-contain"
                    />
                  )}
                </div>

                {/* Countdown timer placeholder */}
                <div className="px-[2px] py-[2px] flex items-center justify-center" />

                {/* Username */}
                <div className="px-[2px] py-[2px] flex items-center justify-center">
                  <div
                    className="text-[10px] text-slate-700 dark:text-slate-300 truncate text-center"
                    style={{ fontWeight: "300", lineHeight: "12px" }}
                  >
                    {serial in sellerInfo
                      ? sellerInfo[serial].username || "—"
                      : "Loading..."}
                  </div>
                </div>

                {/* Countdown timer */}
                {serial in serialEndTimes &&
                serialEndTimes[serial] &&
                isWithin365Days(serialEndTimes[serial]) ? (
                  <div
                    className="text-[10px] text-center mt-auto"
                    style={{
                      fontWeight: "300",
                      lineHeight: "12px",
                      color: "#FF6300",
                    }}
                  >
                    {formatCountdown(serialEndTimes[serial])}
                  </div>
                ) : (
                  <div className="mt-auto" />
                )}

                {/* Listing button */}
                <div
                  className="w-full px-[2px] py-[2px] bg-blue-600 text-white text-[10px] font-medium flex items-center justify-center"
                  style={{ lineHeight: "12px" }}
                >
                  {serial in serialListingTypes &&
                  serialListingTypes[serial] === "auction"
                    ? "Auction"
                    : "Listing"}
                </div>
              </div>
            ))}
          </div>

          {/* Sliding panel for selected serial */}
          <div
            style={{
              maxHeight: selectedSerial !== null ? "1000px" : "0",
              overflow: "hidden",
              transition: "max-height 0.4s ease-in-out",
              border: selectedSerial !== null ? "1px solid rgba(226, 232, 240, 1)" : "none",
            }}
          >
            <div className="p-6">
              {selectedSerial !== null && (
                <BuyOfferBidPanel
                  editionId={editionId}
                  serial={selectedSerial}
                  viewerCount={viewerCounts[`${editionId}-${selectedSerial}`]
                    ? Math.max(0, viewerCounts[`${editionId}-${selectedSerial}`] - 1)
                    : 0}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
