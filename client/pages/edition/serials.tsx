import React, {
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from "react";
import { useParams, Link, useNavigate } from "react-router-dom";

import { fetchMintedByEditionId, MintedRow } from "@/lib/supabaseMinted";
import {
  fetchRelicSerialsJoinedByEditionId,
  fetchRelicSerialByEditionAndSerial,
  fetchUsernameByWalletAddress,
} from "@/lib/supabaseRelicSerialsJoined";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveOffers } from "@/hooks/useActiveOffers";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { getOwnerDisplayName } from "@/lib/auctionHouse";

const CARD_HEIGHT_DESKTOP = 40; // px
const CARD_HEIGHT_MOBILE = 50; // px (2 rows)
const CARD_GAP = 4; // px between cards
const SLIDE_ANIMATION_DURATION = 300; // ms

interface SerialOwner {
  serial: number;
  owner: string;
}

export default function EditionSerialsPage() {
  const betaAllowlist = useBetaAllowlist();
  const { listings: activeListings } = useActiveListings();
  const { offers: allOffers } = useActiveOffers();
  const { auctions: activeAuctions } = useActiveAuctions();
  const navigate = useNavigate();
  const account = useActiveAccount();
  const params = useParams<{ editionId?: string }>();
  const editionId = useMemo(() => {
    const n = Number((params.editionId || "").trim());
    return Number.isFinite(n) ? n : null;
  }, [params.editionId]);

  const [editionRow, setEditionRow] = useState<MintedRow | null>(null);
  const [serials, setSerials] = useState<number[]>([]);
  const [serialOwners, setSerialOwners] = useState<Record<number, string>>({});
  const [serialOwnerAddresses, setSerialOwnerAddresses] = useState<
    Record<number, string>
  >({});
  const [serialTokenIds, setSerialTokenIds] = useState<
    Record<string, string | number | null>
  >({});
  const [loaded, setLoaded] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const [cardsPerPage, setCardsPerPage] = useState(1);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [sortOption, setSortOption] = useState<
    | "lowestPrice"
    | "highestPrice"
    | "lowestSerial"
    | "highestSerial"
    | "ownerAZ"
    | "ownerZA"
    | "highestOffers"
    | "lowestOffers"
  >("lowestPrice");
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const containerRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement | null>(null);
  const sortBtnRef = useRef<HTMLButtonElement | null>(null);

  const CARD_HEIGHT = isMobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT_DESKTOP;

  // Map serial to listing price (must be before early returns to follow Rules of Hooks)
  const serialListingPrices = useMemo(() => {
    const prices: Record<number, string> = {};
    if (!editionId) return prices;

    // First, add direct listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (listing.editionId === editionId && listing.serial !== null) {
          const priceInWei = BigInt(listing.pricePerToken);
          const priceInTokens = Number(priceInWei) / 1e18;
          prices[listing.serial] = `$${priceInTokens.toFixed(2)}`;
        }
      }
    }

    // Then, add active auctions (only if no direct listing for that serial)
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === editionId &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          // Only add if this serial doesn't already have a direct listing
          if (prices[auction.serial] === undefined) {
            // Use currentBidAmount if available and > 0, otherwise use minimumBidAmount
            const bidAmount = auction.currentBidAmount
              ? Number(auction.currentBidAmount)
              : Number(auction.minimumBidAmount || 0);

            if (bidAmount > 0) {
              const bidInTokens = bidAmount / 1e18;
              prices[auction.serial] = `$${bidInTokens.toFixed(2)}`;
            }
          }
        }
      }
    }

    return prices;
  }, [editionId, activeListings, activeAuctions]);

  // Map serial to offer prices
  const serialOfferPrices = useMemo(() => {
    const offerPrices: Record<number, string> = {};
    if (!editionId || !serialTokenIds || allOffers.length === 0)
      return offerPrices;

    for (const serial of serials) {
      const tokenIdKey = `${editionId}-${serial}`;
      const tokenId = serialTokenIds[tokenIdKey];
      if (!tokenId) continue;

      const tokenIdStr = String(tokenId);
      const serialOffers = allOffers.filter(
        (offer) =>
          offer.tokenId === tokenIdStr && offer.editionId === editionId,
      );

      if (serialOffers.length > 0) {
        // Sort by totalPrice descending, with ties broken by offerId
        serialOffers.sort((a, b) => {
          const aBigInt = BigInt(a.totalPrice);
          const bBigInt = BigInt(b.totalPrice);
          if (aBigInt !== bBigInt) {
            return bBigInt > aBigInt ? 1 : -1; // Descending order
          }
          // Tie breaker: offerId
          return Number(BigInt(a.offerId)) - Number(BigInt(b.offerId));
        });

        const formattedPrices = serialOffers.map((offer) => {
          const priceInWei = BigInt(offer.totalPrice);
          const priceInTokens = Number(priceInWei) / 1e18;
          return `$${priceInTokens.toFixed(2)}`;
        });

        offerPrices[serial] = formattedPrices.join(", ");
      }
    }
    return offerPrices;
  }, [editionId, serialTokenIds, serials, allOffers]);

  // Compute sorted serials based on sort option
  const sortedSerials = useMemo(() => {
    const sorted = [...serials];

    if (sortOption === "lowestPrice" || sortOption === "highestPrice") {
      sorted.sort((a, b) => {
        const aPriceStr = serialListingPrices[a];
        const bPriceStr = serialListingPrices[b];

        const aPrice = aPriceStr
          ? parseFloat(aPriceStr.replace("$", ""))
          : null;
        const bPrice = bPriceStr
          ? parseFloat(bPriceStr.replace("$", ""))
          : null;

        if (aPrice === null && bPrice === null) {
          return a - b;
        }
        if (aPrice === null) {
          return 1;
        }
        if (bPrice === null) {
          return -1;
        }

        if (sortOption === "lowestPrice") {
          if (aPrice !== bPrice) {
            return aPrice - bPrice;
          }
        } else {
          if (aPrice !== bPrice) {
            return bPrice - aPrice;
          }
        }

        return a - b;
      });
    } else if (sortOption === "ownerAZ" || sortOption === "ownerZA") {
      sorted.sort((a, b) => {
        const aOwner = serialOwners[a] || "";
        const bOwner = serialOwners[b] || "";

        if (aOwner === "" && bOwner === "") {
          return a - b;
        }
        if (aOwner === "") {
          return 1;
        }
        if (bOwner === "") {
          return -1;
        }

        if (sortOption === "ownerAZ") {
          return aOwner.localeCompare(bOwner);
        } else {
          return bOwner.localeCompare(aOwner);
        }
      });
    } else if (
      sortOption === "highestOffers" ||
      sortOption === "lowestOffers"
    ) {
      sorted.sort((a, b) => {
        const aOfferStr = serialOfferPrices[a];
        const bOfferStr = serialOfferPrices[b];

        const extractHighestPrice = (
          priceStr: string | undefined,
        ): number | null => {
          if (!priceStr) return null;
          const firstPrice = priceStr.split(",")[0].trim();
          return parseFloat(firstPrice.replace("$", ""));
        };

        const aPrice = extractHighestPrice(aOfferStr);
        const bPrice = extractHighestPrice(bOfferStr);

        if (aPrice === null && bPrice === null) {
          return a - b;
        }
        if (aPrice === null) {
          return 1;
        }
        if (bPrice === null) {
          return -1;
        }

        if (sortOption === "highestOffers") {
          if (aPrice !== bPrice) {
            return bPrice - aPrice;
          }
        } else {
          if (aPrice !== bPrice) {
            return aPrice - bPrice;
          }
        }

        return a - b;
      });
    } else {
      // lowestSerial or highestSerial
      if (sortOption === "highestSerial") {
        sorted.sort((a, b) => b - a);
      } else {
        sorted.sort((a, b) => a - b);
      }
    }

    return sorted;
  }, [
    serials,
    sortOption,
    serialListingPrices,
    serialOwners,
    serialOfferPrices,
  ]);

  // Fetch edition metadata
  useEffect(() => {
    if (!editionId) {
      setLoaded(true);
      setEditionRow(null);
      return;
    }
    const ctrl = new AbortController();
    fetchMintedByEditionId(editionId, ctrl.signal)
      .then((r) => setEditionRow(r))
      .catch(() => setEditionRow(null));
    return () => ctrl.abort();
  }, [editionId]);

  // Fetch serials for this edition
  useEffect(() => {
    if (!editionId) {
      setLoaded(true);
      setSerials([]);
      return;
    }
    const ctrl = new AbortController();
    (async () => {
      try {
        const fetchedSerials = await fetchRelicSerialsJoinedByEditionId(
          editionId,
          ctrl.signal,
        );
        if (!ctrl.signal.aborted) {
          setSerials(fetchedSerials);
        }
      } catch (e: any) {
        if (e?.name === "AbortError") {
          // Silently ignore abort errors
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoaded(true);
        }
      }
    })();
    return () => ctrl.abort();
  }, [editionId]);

  // Fetch owners for visible serials
  useEffect(() => {
    if (!editionId || sortedSerials.length === 0) return;

    const startIdx = currentPage * cardsPerPage;
    const endIdx = Math.min(startIdx + cardsPerPage, sortedSerials.length);
    const visibleSerials = sortedSerials.slice(startIdx, endIdx);

    const fetchOwners = async () => {
      const owners: Record<number, string> = {};
      const ownerAddresses: Record<number, string> = {};
      const tokenIds: Record<string, string | number | null> = {};
      for (const serial of visibleSerials) {
        const claim = await fetchRelicSerialByEditionAndSerial(
          editionId,
          serial,
          undefined,
        );
        const tokenIdRaw =
          (claim as any)?.token_id ?? (claim as any)?.tokenId ?? null;

        const tokenIdKey = `${editionId}-${serial}`;
        tokenIds[tokenIdKey] = tokenIdRaw;

        if (tokenIdRaw == null) {
          owners[serial] = "Unknown";
          ownerAddresses[serial] = "";
          continue;
        }

        const tokenIdInt =
          typeof tokenIdRaw === "bigint"
            ? Number(tokenIdRaw)
            : Number(tokenIdRaw);
        if (!Number.isFinite(tokenIdInt)) {
          owners[serial] = "Unknown";
          ownerAddresses[serial] = "";
          continue;
        }

        const rpcKey = (import.meta as any).env.RPC_KEY as
          | string
          | undefined;
        if (!rpcKey) {
          owners[serial] = "Unknown";
          ownerAddresses[serial] = "";
          continue;
        }

        const contractAddress = (import.meta as any).env.VITE_ERC721_ADDRESS as string | undefined;
        if (!contractAddress) {
          owners[serial] = "Unknown";
          ownerAddresses[serial] = "";
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
        }).catch(() => null);

        if (!rpcResponse?.ok) {
          owners[serial] = "";
          ownerAddresses[serial] = "";
          continue;
        }

        const rpcData = await rpcResponse.json().catch(() => null);
        if (!rpcData?.result || rpcData.result === "0x") {
          owners[serial] = "";
          ownerAddresses[serial] = "";
          continue;
        }

        const ownerAddress = ("0x" + rpcData.result.slice(-40)).toUpperCase();
        const username = await fetchUsernameByWalletAddress(
          ownerAddress,
          undefined,
        );
        const displayName = getOwnerDisplayName(username || ownerAddress);
        owners[serial] = displayName;
        ownerAddresses[serial] = ownerAddress;
      }
      setSerialOwners((prev) => ({ ...prev, ...owners }));
      setSerialOwnerAddresses((prev) => ({ ...prev, ...ownerAddresses }));
      setSerialTokenIds((prev) => ({ ...prev, ...tokenIds }));
    };

    fetchOwners();
  }, [editionId, sortedSerials, currentPage, cardsPerPage]);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const onDocPointer = (e: Event) => {
      const t = e.target as Node;
      if (!sortMenuRef.current || !sortBtnRef.current) return;
      if (sortMenuRef.current.contains(t) || sortBtnRef.current.contains(t))
        return;
      setSortDropdownOpen(false);
    };
    if (sortDropdownOpen) {
      document.addEventListener("pointerdown", onDocPointer);
      document.addEventListener("touchstart", onDocPointer, { passive: true });
    }
    return () => {
      document.removeEventListener("pointerdown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer as any);
    };
  }, [sortDropdownOpen]);

  // Detect mobile breakpoint
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  // Handle swipe gestures on cards container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartY: number | null = null;
    const SWIPE_THRESHOLD = 50; // minimum pixels to register as swipe

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (touchStartY === null) return;
      const touchEndY = e.changedTouches[0].clientY;
      const diffY = touchStartY - touchEndY;

      // Swipe up (positive diffY) = next page
      if (diffY > SWIPE_THRESHOLD) {
        handleNextPage();
      }
      // Swipe down (negative diffY) = previous page
      else if (diffY < -SWIPE_THRESHOLD) {
        handlePrevPage();
      }

      touchStartY = null;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isSliding, cardsPerPage, serials.length]);

  // Calculate cards per page based on available viewport height
  useEffect(() => {
    const calculateCardsPerPage = () => {
      // Calculate based on fixed heights:
      // Header/Nav: 70px
      // Back link: 18px
      // Title: 20px
      // Up arrow: 20px
      // Spacing: 18px
      // Reserved for down arrow area: 80px (button + padding)
      // Total fixed: ~226px

      const totalViewportHeight = window.innerHeight;
      const headerHeight = 70;
      const backLinkHeight = 18;
      const titleHeight = 20;
      const upArrowHeight = 20;
      const spacing = 18;
      const downArrowReserved = 80;

      const totalFixedHeight =
        headerHeight +
        backLinkHeight +
        titleHeight +
        upArrowHeight +
        spacing +
        downArrowReserved;
      const availableForCards = totalViewportHeight - totalFixedHeight;
      const cardTotalHeight = CARD_HEIGHT + CARD_GAP;
      const calculated = Math.max(
        1,
        Math.floor(availableForCards / cardTotalHeight),
      );
      setCardsPerPage(calculated);
    };

    calculateCardsPerPage();
    window.addEventListener("resize", calculateCardsPerPage);
    return () => {
      window.removeEventListener("resize", calculateCardsPerPage);
    };
  }, [CARD_HEIGHT]);

  const handlePrevPage = () => {
    if (isSliding || currentPage === 0) return;
    setIsSliding(true);
    setTimeout(() => {
      setCurrentPage((p) => Math.max(0, p - 1));
      setIsSliding(false);
    }, SLIDE_ANIMATION_DURATION);
  };

  const handleNextPage = () => {
    if (isSliding || (currentPage + 1) * cardsPerPage >= serials.length) return;
    setIsSliding(true);
    setTimeout(() => {
      setCurrentPage((p) => p + 1);
      setIsSliding(false);
    }, SLIDE_ANIMATION_DURATION);
  };

  if (betaAllowlist !== true) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white text-black p-6 text-center text-base">
          Platform is invitation only. Log in and enter your invite code to
          join.
        </div>
      </section>
    );
  }

  if (!editionId) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Invalid edition id.</div>
      </section>
    );
  }

  if (!loaded) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Loading…</div>
      </section>
    );
  }

  if (!editionRow) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Edition not found.</div>
      </section>
    );
  }

  if (!loaded) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Loading…</div>
      </section>
    );
  }

  if (!editionRow) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700">Edition not found.</div>
      </section>
    );
  }

  const startIdx = currentPage * cardsPerPage;
  const endIdx = Math.min(startIdx + cardsPerPage, sortedSerials.length);
  const visibleSerials = sortedSerials.slice(startIdx, endIdx);
  const totalPages = Math.ceil(sortedSerials.length / cardsPerPage);
  const canGoUp = currentPage > 0;
  const canGoDown = currentPage < totalPages - 1;

  return (
    <section
      className="w-full nightmode_cards relative"
      style={{
        paddingLeft: "16px",
        paddingRight: "16px",
        paddingTop: "8px",
        paddingBottom: "8px",
        height: "calc(100vh - 70px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Title */}
      <div style={{ lineHeight: "1.2", marginBottom: "8px" }}>
        <h1
          className="text-base font-bold text-slate-800 dark:text-white"
          style={{ margin: "0px", marginTop: "5px" }}
        >
          {editionRow
            ? `${editionRow.PlayerName || ""} - ${editionRow.Minted || ""} exist - ${editionRow.GameDate || ""} - ${editionRow.SeriesName || ""} - ${editionRow.SetName || ""}`
            : "Available Serials"}
        </h1>
      </div>

      {serials.length === 0 ? (
        <div className="text-center py-4 text-slate-600">
          <p>No serials available for this edition.</p>
        </div>
      ) : (
        <>
          {/* Up arrow with adjacent cards - locked just below title */}
          <div
            className="flex items-center"
            style={{
              height: "28px",
              marginBottom: "8px",
              flexShrink: 0,
              gap: "0px",
            }}
          >
            {/* Sales card */}
            <div
              className="px-3 py-1 text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded"
              style={{
                boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                flex: 1,
                marginRight: "10px",
                minWidth: 0,
              }}
            >
              Sales
            </div>

            {/* Up arrow - centered */}
            <button
              onClick={handlePrevPage}
              disabled={!canGoUp || isSliding}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow border border-slate-200 hover:bg-white transition-colors flex-shrink-0 ${
                !canGoUp || isSliding
                  ? "opacity-30 cursor-not-allowed"
                  : "opacity-100"
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
                <path d="M18 15l-6-6-6 6" />
              </svg>
            </button>

            {/* Sort by dropdown */}
            <div
              style={{
                position: "relative",
                flex: 1,
                marginLeft: "10px",
                minWidth: 0,
              }}
            >
              <FilterStyleButton
                ref={sortBtnRef}
                onClick={() => setSortDropdownOpen((v) => !v)}
                className="w-full px-3 py-1 text-xs text-left"
              >
                Sort by
              </FilterStyleButton>

              {sortDropdownOpen && (
                <div
                  ref={sortMenuRef}
                  className="absolute top-full left-0 mt-2 z-50 min-w-[200px] overflow-hidden rounded-md border border-black/10 bg-white shadow-lg dark:border-white/20 dark:bg-black"
                  role="menu"
                  style={{ maxWidth: "calc(100vw - 32px)" }}
                >
                  <button
                    onClick={() => {
                      setSortOption("lowestSerial");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by lowest serials
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("highestSerial");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by highest serials
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("ownerAZ");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by owner (A-Z)
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("ownerZA");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by owner (Z-A)
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("lowestPrice");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by lowest listing price
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("highestPrice");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by highest listing price
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("highestOffers");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by highest offers
                  </button>
                  <button
                    onClick={() => {
                      setSortOption("lowestOffers");
                      setSortDropdownOpen(false);
                      setCurrentPage(0);
                    }}
                    className="w-full block px-3 py-2 text-sm text-left text-slate-800 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10"
                    role="menuitem"
                  >
                    Sort by lowest offers
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Cards container - flexible, fills available space */}
          <div
            ref={containerRef}
            className="flex-1 overflow-hidden relative"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: `${CARD_GAP}px`,
              minHeight: "0px",
            }}
          >
            <div
              style={{
                opacity: isSliding ? 0.5 : 1,
                transitionDuration: `${SLIDE_ANIMATION_DURATION}ms`,
                display: "flex",
                flexDirection: "column",
                gap: `${CARD_GAP}px`,
              }}
            >
              {visibleSerials.map((serial, idx) => {
                const isOwner =
                  account &&
                  serial in serialOwnerAddresses &&
                  account.address.toLowerCase() ===
                    serialOwnerAddresses[serial].toLowerCase();
                const hasActiveListing =
                  activeListings.some(
                    (listing) =>
                      listing.editionId === editionId &&
                      listing.serial === serial &&
                      listing.status === "active",
                  ) ||
                  activeAuctions.some(
                    (auction) =>
                      auction.editionId === editionId &&
                      auction.serial === serial &&
                      auction.status === "active",
                  );

                const handleCardClick = () => {
                  navigate(`/edition/${editionId}/serial/${serial}`);
                };

                const handleBuyOfferBidClick = () => {
                  navigate(
                    `/edition/${editionId}/serial/${serial}/buy-offer-bid`,
                  );
                };

                return (
                  <div
                    key={`${currentPage}-${idx}`}
                    className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded"
                    style={{
                      flexShrink: 0,
                      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                      color: "inherit",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {/* Main row: always horizontal */}
                    <div
                      onClick={handleCardClick}
                      className="no-underline cursor-pointer"
                      style={{
                        minHeight: `${CARD_HEIGHT}px`,
                        textDecoration: "none",
                        color: "inherit",
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: "8px",
                        justifyContent: "space-between",
                        padding: "0px 3px",
                      }}
                    >
                      <span className="text-xl font-bold text-slate-800 dark:text-slate-200 whitespace-nowrap flex-shrink-0">
                        #{serial}
                      </span>
                      <span className="text-xs text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                        {serial in serialOwners
                          ? serialOwners[serial]
                          : "Loading..."}
                      </span>
                      {!isMobile && (
                        <span className="text-xs text-slate-800 dark:text-slate-200 truncate flex-1 min-w-0">
                          Offers:{" "}
                          {serial in serialOfferPrices
                            ? serialOfferPrices[serial]
                            : ""}
                        </span>
                      )}
                      <div
                        className="flex items-center gap-2 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          className="flex items-center justify-center flex-shrink-0 p-1 max-sm:overflow-hidden"
                          style={{
                            width: "100px",
                            minHeight: `${CARD_HEIGHT_DESKTOP - 6}px`,
                          }}
                        >
                          {serial in serialListingPrices && (
                            <div
                              style={{
                                fontSize: "clamp(0.75rem, 8vw, 1.5rem)",
                                fontWeight: "600",
                                color: "rgb(30, 41, 59)",
                                textAlign: "center",
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {serialListingPrices[serial]}
                            </div>
                          )}
                        </div>
                        {(() => {
                          if (isOwner) {
                            return (
                              <FilterStyleButton
                                className="text-xs font-medium whitespace-nowrap"
                                style={{
                                  width: "100px",
                                  minHeight: `${CARD_HEIGHT_DESKTOP - 6}px`,
                                  padding: "0px 6px",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hasActiveListing) {
                                    navigate(
                                      `/edition/${editionId}/serial/${serial}/manage-listing`,
                                    );
                                  } else {
                                    navigate(
                                      `/edition/${editionId}/serial/${serial}`,
                                    );
                                  }
                                }}
                              >
                                <p>Manage Listing</p>
                              </FilterStyleButton>
                            );
                          }

                          return (
                            <div
                              className="bg-blue-600 text-white text-xs font-medium rounded whitespace-nowrap"
                              style={{
                                width: "100px",
                                minHeight: `${CARD_HEIGHT_DESKTOP - 6}px`,
                                boxShadow:
                                  "1px 1px 3px 0 rgba(155, 155, 155, 1)",
                                padding: "0px 6px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                              onClick={handleBuyOfferBidClick}
                            >
                              Buy - Offer - Bid
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    {/* Mobile footer: Offers line */}
                    {isMobile && (
                      <div style={{ width: "100%", padding: "0px 3px" }}>
                        <span className="text-xs text-slate-800 dark:text-slate-200 truncate block">
                          Offers:{" "}
                          {serial in serialOfferPrices
                            ? serialOfferPrices[serial]
                            : ""}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Down arrow with adjacent cards - fixed to bottom, above SiteNav */}
          <div
            className="flex items-center justify-center"
            style={{
              position: "fixed",
              bottom: "80px",
              left: "0",
              right: "0",
              gap: "0px",
              paddingLeft: "16px",
              paddingRight: "16px",
              zIndex: 10,
            }}
          >
            {/* Down arrow - centered */}
            <button
              onClick={handleNextPage}
              disabled={!canGoDown || isSliding}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-600 shadow border border-slate-200 hover:bg-white transition-colors flex-shrink-0 ${
                !canGoDown || isSliding
                  ? "opacity-30 cursor-not-allowed"
                  : "opacity-100"
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
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
