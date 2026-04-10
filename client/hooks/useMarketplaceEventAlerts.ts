import { useEffect, useRef } from "react";
import { fetchMarketplaceEvents, type MarketplaceEvent } from "@/lib/marketplaceEvents";
import { toast } from "@/hooks/use-toast";

const SEEN_EVENTS_STORAGE_KEY = "marketplace-event-toast-ids";
const POLL_INTERVAL = 15000; // Poll every 15 seconds (increased from 5s to reduce violations)

/**
 * Format price from Wei to decimal with 2 places
 */
function formatPrice(priceWei: number | string): string {
  const wei = parseFloat(String(priceWei)) || 0;
  const tokens = wei / 1e18;
  return `$${tokens.toFixed(2)}`;
}

/**
 * Build formatted event message
 */
function buildEventMessage(event: MarketplaceEvent): string {
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (!decoded) return "Marketplace event occurred";

    const eventName = event.event_name || "";
    const playerName = event.PlayerName || "Relic";
    const setName = event.SetName || "Series";
    const serial = event.serial || "?";
    const minted = event.Minted || "?";

    if (eventName === "NewSale") {
      const buyerUsername =
        decoded.buyer_username ||
        decoded.buyerUsername ||
        "User";
      const price = formatPrice(decoded.total_price_paid || "0");
      return `${buyerUsername} just bought ${playerName} ${setName} #${serial} of ${minted} for ${price}`;
    } else if (eventName === "NewBid") {
      const bidderUsername =
        decoded.bidder_username ||
        decoded.bidderUsername ||
        "User";
      const price = formatPrice(decoded.bid_amount || "0");
      return `${bidderUsername} just bid ${price} on auction for ${playerName} ${setName} #${serial} of ${minted}`;
    } else if (eventName === "NewOffer") {
      const offerorUsername =
        decoded.offeror_username ||
        decoded.offerorUsername ||
        "User";
      const price = formatPrice(decoded.total_price || "0");
      return `${offerorUsername} just offered ${price} on auction for ${playerName} ${setName} #${serial} of ${minted}`;
    }

    return "Marketplace event occurred";
  } catch {
    return "Marketplace event occurred";
  }
}

/**
 * Get event label for display
 */
function getEventLabel(eventName: string): string {
  switch (eventName) {
    case "NewSale":
      return "New Sale";
    case "NewBid":
      return "New Bid";
    case "NewOffer":
      return "New Offer";
    default:
      return "Marketplace Event";
  }
}

/**
 * Hook to monitor marketplace events and show toast alerts
 */
export function useMarketplaceEventAlerts() {
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const seenEventsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Load previously seen events from localStorage
    try {
      const stored = localStorage.getItem(SEEN_EVENTS_STORAGE_KEY);
      if (stored) {
        const ids = JSON.parse(stored) as string[];
        seenEventsRef.current = new Set(ids);
      }
    } catch {
      seenEventsRef.current = new Set();
    }

    const pollEvents = async () => {
      try {
        const events = await fetchMarketplaceEvents();

        // Process only the 3 event types we care about
        const relevantEvents = events.filter(
          (e) =>
            e.event_name === "NewSale" ||
            e.event_name === "NewBid" ||
            e.event_name === "NewOffer"
        );

        // Show toast for new events
        for (const event of relevantEvents) {
          if (!seenEventsRef.current.has(event.id)) {
            seenEventsRef.current.add(event.id);

            const label = getEventLabel(event.event_name);
            const description = buildEventMessage(event);

            // Show the toast
            toast({
              title: label,
              description,
            });

            // Update localStorage with new seen events
            const idsArray = Array.from(seenEventsRef.current).slice(0, 100); // Keep last 100
            localStorage.setItem(SEEN_EVENTS_STORAGE_KEY, JSON.stringify(idsArray));
          }
        }
      } catch (error) {
        console.error("[useMarketplaceEventAlerts] Error polling events:", error);
      }
    };

    // Initial poll
    pollEvents();

    // Set up interval
    pollIntervalRef.current = setInterval(pollEvents, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
}
