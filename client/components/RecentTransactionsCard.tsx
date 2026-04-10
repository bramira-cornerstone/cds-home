import { useEffect, useState, useRef } from "react";

import { getFavoriteTeam } from "@/lib/favoriteTeamService";
import {
  fetchMarketplaceEvents,
  enrichEventWithRelicData,
  type MarketplaceEvent,
  resolveTokenIdFromEvent,
  fetchSerialData,
  type SerialData,
} from "@/lib/marketplaceEvents";

interface RecentTransactionsCardProps {
  followerAddress?: string;
}

interface EventData {
  event: MarketplaceEvent;
  serialData: SerialData | null;
  initiator: { username: string } | null;
  playerName: string | null;
}

const calculateEventPrice = (event: MarketplaceEvent): number => {
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (!decoded) return 0;

    const eventName = event.event_name || "";

    if (eventName === "NewListing") {
      return parseFloat(decoded.price_per_token || "0") || 0;
    } else if (eventName === "NewOffer") {
      return parseFloat(decoded.total_price || "0") || 0;
    } else if (eventName === "NewAuction") {
      return parseFloat(decoded.minimum_bid_amount || "0") || 0;
    } else if (eventName === "NewBid") {
      return parseFloat(decoded.bid_amount || "0") || 0;
    } else if (eventName === "AuctionClosed") {
      return parseFloat(decoded.maxBid || decoded.max_bid || "0") || 0;
    } else if (eventName === "AcceptedOffer") {
      return parseFloat(decoded.total_price_paid || "0") || 0;
    } else if (eventName === "NewSale") {
      return parseFloat(decoded.total_price_paid || "0") || 0;
    }

    return 0;
  } catch {
    return 0;
  }
};

const loadEventData = async (
  event: MarketplaceEvent,
): Promise<{
  serialData: SerialData | null;
  initiator: { username: string } | null;
  playerName: string | null;
}> => {
  let serialData: SerialData | null = null;
  let initiator: { username: string } | null = null;
  let playerName: string | null = null;

  try {
    const tokenId = await resolveTokenIdFromEvent(event);
    if (tokenId != null) {
      serialData = await fetchSerialData(tokenId);
    }
  } catch {
    // Skip on error
  }

  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    // Extract PlayerName from decoded or event
    playerName = decoded?.PlayerName || event.PlayerName || null;

    // Extract initiator username based on event type
    const eventName = event.event_name || "";
    let initiatorUsername: string | null = null;

    if (eventName === "NewListing") {
      initiatorUsername =
        decoded?.listing_creator_username || decoded?.listingCreatorUsername;
    } else if (eventName === "NewAuction") {
      initiatorUsername =
        decoded?.auction_creator_username || decoded?.auctionCreatorUsername;
    } else if (eventName === "NewBid") {
      initiatorUsername = decoded?.bidder_username || decoded?.bidderUsername;
    } else if (eventName === "AuctionClosed") {
      initiatorUsername =
        decoded?.winning_bidder_username || decoded?.winningBidderUsername;
    } else if (eventName === "NewOffer") {
      initiatorUsername = decoded?.offeror_username || decoded?.offerorUsername;
    } else if (eventName === "AcceptedOffer") {
      initiatorUsername = decoded?.buyer_username || decoded?.buyerUsername;
    } else if (eventName === "NewSale") {
      initiatorUsername = decoded?.buyer_username || decoded?.buyerUsername;
    } else if (eventName === "CancelledListing") {
      initiatorUsername =
        decoded?.listing_creator_username || decoded?.listingCreatorUsername;
    }

    if (initiatorUsername && typeof initiatorUsername === "string") {
      initiator = {
        username: initiatorUsername,
      };
    }
  } catch (err) {
    // Silently skip on error
  }

  return { serialData, initiator, playerName };
};

export default function RecentTransactionsCard({
  followerAddress,
}: RecentTransactionsCardProps) {
  const account = useActiveAccount();
  const [rawEvents, setRawEvents] = useState<MarketplaceEvent[]>([]);
  const [loadedEventsData, setLoadedEventsData] = useState<
    Record<string, EventData>
  >({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const loadingRef = useRef<Set<string>>(new Set());

  // Initial load: fetch events and enrich them
  useEffect(() => {
    const initializeEvents = async () => {
      setIsInitialLoading(true);
      try {
        if (!account?.address) {
          setRawEvents([]);
          return;
        }

        const favoriteTeam = await getFavoriteTeam(account.address);
        if (!favoriteTeam) {
          setRawEvents([]);
          return;
        }

        const allEvents = await fetchMarketplaceEvents();
        const enrichedEvents = await Promise.all(
          allEvents.map((event) => enrichEventWithRelicData(event)),
        );

        const filteredEvents = enrichedEvents
          .filter((event) => event.team === favoriteTeam)
          .sort(
            (a, b) =>
              new Date(b.emitted_at).getTime() -
              new Date(a.emitted_at).getTime(),
          )
          .slice(0, 10);

        setRawEvents(filteredEvents);

        // Immediately load data for the first event
        if (filteredEvents.length > 0) {
          const firstEvent = filteredEvents[0];
          loadingRef.current.add(firstEvent.id);
          const eventData = await loadEventData(firstEvent);
          loadingRef.current.delete(firstEvent.id);

          setLoadedEventsData((prev) => ({
            ...prev,
            [firstEvent.id]: {
              event: firstEvent,
              ...eventData,
            },
          }));
        }

        setIsInitialLoading(false);
      } catch (error) {
        console.error("Error loading initial events:", error);
        setRawEvents([]);
        setIsInitialLoading(false);
      }
    };

    initializeEvents();
  }, [account?.address]);

  // Progressive loading of subsequent events
  useEffect(() => {
    if (rawEvents.length === 0) return;

    const loadNextEvents = async () => {
      for (let i = 0; i < rawEvents.length; i++) {
        const event = rawEvents[i];
        if (!loadedEventsData[event.id] && !loadingRef.current.has(event.id)) {
          loadingRef.current.add(event.id);
          try {
            const eventData = await loadEventData(event);
            setLoadedEventsData((prev) => ({
              ...prev,
              [event.id]: {
                event,
                ...eventData,
              },
            }));
          } catch (error) {
            console.error(`Error loading data for event ${event.id}:`, error);
          }
          loadingRef.current.delete(event.id);
        }
      }
    };

    loadNextEvents();
  }, [rawEvents, loadedEventsData]);

  // Cycle through events only when data is available
  useEffect(() => {
    if (rawEvents.length === 0 || isInitialLoading) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % rawEvents.length;
        const nextEvent = rawEvents[nextIndex];

        if (loadedEventsData[nextEvent.id]) {
          return nextIndex;
        }
        return prev;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [rawEvents, loadedEventsData, isInitialLoading]);

  if (isInitialLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (rawEvents.length === 0) {
    return null;
  }

  const currentEvent = rawEvents[currentIndex];
  const currentData = loadedEventsData[currentEvent.id];

  if (!currentData) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-slate-600">Loading transaction...</p>
        </div>
      </div>
    );
  }

  const price = calculateEventPrice(currentEvent);
  const formattedPrice = `$${Math.floor(price / 1e18)}`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-0.5 bg-white font-light">
      {/* Transaction Event Content */}
      <div className="text-center flex flex-col gap-1 h-full justify-center w-full">
        {/* Event Name */}
        <div className="text-[11px] font-normal text-slate-700">
          {currentEvent.event_name}
        </div>

        {/* Player Name */}
        <div className="text-[10px] font-light text-slate-600">
          {currentData.playerName || "—"}
        </div>

        {/* Serial Info */}
        <div className="text-[10px] font-light text-slate-600">
          {currentData.serialData
            ? `#${currentData.serialData.serial} of ${currentData.serialData.minted}`
            : "—"}
        </div>

        {/* Price - Bold */}
        {!["CancelledListing", "CancelledOffer", "CancelledAuction"].includes(
          currentEvent.event_name,
        ) && (
          <div
            className="text-[16px] font-semibold"
            style={{ color: "#FF6300" }}
          >
            {formattedPrice}
          </div>
        )}

        {/* Initiator Username */}
        <div className="text-[10px] font-light text-slate-600 max-lg:mx-auto">
          {currentData.initiator?.username || "—"}
        </div>
      </div>
    </div>
  );
}
