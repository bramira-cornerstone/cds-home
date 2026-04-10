import { useMemo, useState, useEffect } from "react";
import { useActiveAccount } from "thirdweb/react";
import MiniCarousel from "@/components/MiniCarousel";
import { CardWithOffersSummarySerial } from "@/components/CardWithOffersSummarySerial";
import { CardWithListingDetailsSerial } from "@/components/CardWithListingDetailsSerial";
import type { ActiveOffer } from "@/lib/activeOffers";
import type { ActiveListing } from "@/lib/activeListings";
import type { ActiveAuction } from "@/lib/activeAuctionsFromEvents";

interface UserMarketplaceStatsProps {
  offers: ActiveOffer[];
  listings: ActiveListing[];
  auctions?: ActiveAuction[];
  userTokenIds: Set<string>;
  walletAddress?: string | null;
}

async function checkAuctionClosed(auctionId: string): Promise<boolean> {
  try {
    const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
    const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

    if (!baseUrl || !anonKey) {
      return false;
    }

    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(auctionId)}&event_name=eq.AuctionClosed&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as Array<any>;
    return data.length > 0;
  } catch (error) {
    console.debug("Error checking auction closed:", error);
    return false;
  }
}

export function UserMarketplaceStats({
  offers,
  listings,
  auctions = [],
  userTokenIds,
  walletAddress,
}: UserMarketplaceStatsProps) {
  const [expandedCards, setExpandedCards] = useState<{
    offersMade: boolean;
    offersReceived: boolean;
    listings: boolean;
  }>({
    offersMade: false,
    offersReceived: false,
    listings: false,
  });
  const [closedAuctionIds, setClosedAuctionIds] = useState<Set<string>>(
    new Set(),
  );
  const [isCheckingAuctions, setIsCheckingAuctions] = useState(true);

  const toggleCard = (card: keyof typeof expandedCards) => {
    setExpandedCards((prev) => ({
      ...prev,
      [card]: !prev[card],
    }));
  };

  // Check for closed auctions
  useEffect(() => {
    if (auctions.length === 0) {
      setClosedAuctionIds(new Set());
      setIsCheckingAuctions(false);
      return;
    }

    let mounted = true;
    const checkClosedAuctions = async () => {
      const closed = new Set<string>();
      for (const auction of auctions) {
        const isClosed = await checkAuctionClosed(auction.auctionId);
        if (isClosed) {
          closed.add(auction.auctionId);
        }
      }
      if (mounted) {
        setClosedAuctionIds(closed);
        setIsCheckingAuctions(false);
      }
    };

    checkClosedAuctions();
    return () => {
      mounted = false;
    };
  }, [auctions]);

  const stats = useMemo(() => {
    const userAddress = (walletAddress || "").toLowerCase();

    // Card 1: Offers the user has made to other owners
    const offersUserMade = offers
      .filter((offer) => offer.offeror.toLowerCase() === userAddress)
      .sort((a, b) => b.expirationTimestamp - a.expirationTimestamp);

    // Card 2: Offers from others on user's tokenIds
    const offersOnUserTokens = offers
      .filter(
        (offer) =>
          offer.offeror.toLowerCase() !== userAddress &&
          userTokenIds.has(offer.tokenId),
      )
      .sort((a, b) => b.expirationTimestamp - a.expirationTimestamp);

    // Card 3: Active listings created by the user (both listings and auctions)
    // Show all listings where the user is the listing creator, and all auctions where the user is the auction creator
    const userListings = listings.filter(
      (listing) => listing.sellerAddress.toLowerCase() === userAddress,
    );

    const userAuctions = auctions.filter(
      (auction) =>
        auction.auctionCreator.toLowerCase() === userAddress &&
        !closedAuctionIds.has(auction.auctionId),
    );

    // Combine listings and auctions for the "Your Active Listings" count, sorted by most recent first
    const allUserListings = [...userListings, ...userAuctions].sort(
      (a, b) => b.startTimestamp - a.startTimestamp,
    );

    // Create maps for quick lookups
    const offersMap = new Map<string, ActiveOffer[]>();
    for (const offer of offers) {
      if (!offersMap.has(offer.tokenId)) {
        offersMap.set(offer.tokenId, []);
      }
      offersMap.get(offer.tokenId)!.push(offer);
    }

    const listingsByEditionMap = new Map<number, ActiveListing[]>();
    for (const listing of listings) {
      if (listing.editionId !== null) {
        if (!listingsByEditionMap.has(listing.editionId)) {
          listingsByEditionMap.set(listing.editionId, []);
        }
        listingsByEditionMap.get(listing.editionId)!.push(listing);
      }
    }

    return {
      offersUserMade,
      offersOnUserTokens,
      userListings: allUserListings,
      offersMap,
      listingsByEditionMap,
    };
  }, [
    walletAddress,
    offers,
    listings,
    auctions,
    userTokenIds,
    closedAuctionIds,
  ]);

  if (!walletAddress || isCheckingAuctions) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-sm:gap-3 mb-8 marketplace-stats-grid">
      {/* Your Active Listings */}
      {stats.userListings.length > 0 && (
        <div
          className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow marketplace-stats-card"
          style={{
            boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
            padding: "4px 12px 8px",
            ...(expandedCards.listings && typeof window !== "undefined"
              ? window.innerWidth < 640
                ? { height: "270px" }
                : window.innerWidth >= 768
                  ? { height: "248px" }
                  : {}
              : {}),
          }}
        >
          <button
            onClick={() => toggleCard("listings")}
            className="flex items-center justify-between w-full text-left hover:opacity-75 transition-opacity"
            style={{ marginBottom: "2px" }}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Listings
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {expandedCards.listings ? "⌃" : "⌄"}
              </span>
              <p className="text-4xl font-bold text-slate-800 dark:text-white">
                {stats.userListings.length}
              </p>
            </div>
          </button>
          {expandedCards.listings && stats.userListings.length > 0 && (
            <div
              className="flex flex-col w-full h-auto overflow-visible"
              style={{ flexGrow: "1" }}
            >
              <MiniCarousel
                count={stats.userListings.length}
                itemWidthClass="w-[140px] md:w-[160px]"
                containerPaddingClass="px-0"
                gapClass="gap-1"
                imageClass="h-auto"
                isUserMarketplaceStatsCarousel={true}
                renderItemForIndex={(index) => {
                  const listing = stats.userListings[index];
                  if (!listing || !listing.tokenId) return null;
                  const offersForToken =
                    stats.offersMap.get(listing.tokenId) || [];
                  const listingsForEdition = listing.editionId
                    ? stats.listingsByEditionMap.get(listing.editionId) || []
                    : [];
                  return (
                    <CardWithListingDetailsSerial
                      tokenId={listing.tokenId}
                      listing={listing}
                      offersForToken={offersForToken}
                      allListingsForEdition={listingsForEdition}
                    />
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Offers You've Made */}
      {stats.offersUserMade.length > 0 && (
        <div
          className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow marketplace-stats-card"
          style={{
            boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
            padding: "4px 12px 8px",
            ...(expandedCards.offersMade && typeof window !== "undefined"
              ? window.innerWidth < 640
                ? { height: "270px" }
                : window.innerWidth >= 768
                  ? { height: "248px" }
                  : {}
              : {}),
          }}
        >
          <button
            onClick={() => toggleCard("offersMade")}
            className="flex items-center justify-between w-full text-left hover:opacity-75 transition-opacity"
            style={{ marginBottom: "2px" }}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Offers Made
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {expandedCards.offersMade ? "⌃" : "⌄"}
              </span>
              <p className="text-4xl font-bold text-slate-800 dark:text-white">
                {stats.offersUserMade.length}
              </p>
            </div>
          </button>
          {expandedCards.offersMade && stats.offersUserMade.length > 0 && (
            <div
              className="flex flex-col w-full h-auto overflow-visible"
              style={{ flexGrow: "1" }}
            >
              <MiniCarousel
                count={stats.offersUserMade.length}
                itemWidthClass="w-[140px] md:w-[160px]"
                containerPaddingClass="px-0"
                gapClass="gap-1"
                imageClass="h-auto"
                isUserMarketplaceStatsCarousel={true}
                renderItemForIndex={(index) => {
                  const offer = stats.offersUserMade[index];
                  if (!offer || !offer.tokenId) return null;
                  const listingsForEdition = offer.editionId
                    ? stats.listingsByEditionMap.get(offer.editionId) || []
                    : [];
                  return (
                    <CardWithOffersSummarySerial
                      tokenId={offer.tokenId}
                      offer={offer}
                      listingsForEdition={listingsForEdition}
                    />
                  );
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Offers You've Received */}
      {stats.offersOnUserTokens.length > 0 && (
        <div
          className="flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:shadow-lg dark:hover:shadow-slate-900/50 transition-shadow marketplace-stats-card"
          style={{
            boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)",
            padding: "4px 12px 8px",
            ...(expandedCards.offersReceived && typeof window !== "undefined"
              ? window.innerWidth < 640
                ? { height: "270px" }
                : window.innerWidth >= 768
                  ? { height: "248px" }
                  : {}
              : {}),
          }}
        >
          <button
            onClick={() => toggleCard("offersReceived")}
            className="flex items-center justify-between w-full text-left hover:opacity-75 transition-opacity"
            style={{ marginBottom: "2px" }}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
              Offers Received
            </p>
            <div className="flex items-center gap-2">
              <span className="text-2xl">
                {expandedCards.offersReceived ? "⌃" : "⌄"}
              </span>
              <p className="text-4xl font-bold text-slate-800 dark:text-white">
                {stats.offersOnUserTokens.length}
              </p>
            </div>
          </button>
          {expandedCards.offersReceived &&
            stats.offersOnUserTokens.length > 0 && (
              <div
                className="flex flex-col w-full h-auto overflow-visible"
                style={{ flexGrow: "1" }}
              >
                <MiniCarousel
                  count={stats.offersOnUserTokens.length}
                  itemWidthClass="w-[140px] md:w-[160px]"
                  containerPaddingClass="px-0"
                  gapClass="gap-1"
                  imageClass="h-auto"
                  isUserMarketplaceStatsCarousel={true}
                  renderItemForIndex={(index) => {
                    const offer = stats.offersOnUserTokens[index];
                    if (!offer || !offer.tokenId) return null;
                    const listingsForEdition = offer.editionId
                      ? stats.listingsByEditionMap.get(offer.editionId) || []
                      : [];
                    return (
                      <CardWithOffersSummarySerial
                        tokenId={offer.tokenId}
                        offer={offer}
                        listingsForEdition={listingsForEdition}
                      />
                    );
                  }}
                />
              </div>
            )}
        </div>
      )}
    </div>
  );
}
