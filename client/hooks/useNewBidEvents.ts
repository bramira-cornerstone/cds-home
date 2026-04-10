import { useQuery } from "@tanstack/react-query";

export interface NewBidEvent {
  bidder: string;
  bid_amount: string;
  username: string | null;
  favoriteTeam: string | null;
}

export function useNewBidEvents(auctionId: string | number | null) {
  return useQuery({
    queryKey: ["newBidEvents", auctionId],
    queryFn: async () => {
      if (!auctionId) {
        return [];
      }

      try {
        const supabaseUrl = import.meta.env.SUPABASE_URL as string;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY as string;

        if (!supabaseUrl || !anonKey) {
          console.error("[useNewBidEvents] Supabase config missing");
          return [];
        }

        const baseUrl = supabaseUrl;
        const root = baseUrl.replace(/\/$/, "");

        // Fetch NewBid events for this auction
        const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(String(auctionId))}&event_name=eq.NewBid&select=bidder,bidder_username,bid_amount&order=bid_amount.desc`;

        console.log("[useNewBidEvents] Fetching from:", url);

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.error(
            "[useNewBidEvents] Error fetching bid events:",
            response.status,
            response.statusText,
          );
          return [];
        }

        const events = (await response.json()) as Array<{
          bidder?: string;
          bidder_username?: string;
          bid_amount?: string;
        }>;

        console.log("[useNewBidEvents] Raw events:", events);

        if (!Array.isArray(events) || events.length === 0) {
          console.log("[useNewBidEvents] No events found");
          return [];
        }

        // Extract bidder address from bidder field
        const eventsWithBidder = events
          .map((event) => {
            const bidderAddress = event.bidder;
            return {
              ...event,
              bidderAddress,
            };
          })
          .filter((event) => event.bidderAddress && event.bid_amount);

        // Deduplicate by bidder (keep highest bid per bidder)
        const seenBidders = new Set<string>();
        const uniqueBids = eventsWithBidder.filter((event) => {
          const bidder = event.bidderAddress!.toLowerCase();
          if (seenBidders.has(bidder)) {
            return false;
          }
          seenBidders.add(bidder);
          return true;
        });

        // Convert to NewBidEvent format using pre-fetched usernames from the view
        const bidsWithDetails: NewBidEvent[] = uniqueBids.map((event) => {
          const bidderAddress = event.bidderAddress!;
          const bidAmount = event.bid_amount!;
          const username = event.bidder_username || null;

          return {
            bidder: bidderAddress,
            bid_amount: bidAmount,
            username,
            favoriteTeam: null,
          };
        });

        return bidsWithDetails;
      } catch (err) {
        console.error("[useNewBidEvents] Error:", err);
        return [];
      }
    },
    enabled: Boolean(auctionId),
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
