import { useQuery } from "@tanstack/react-query";

export interface AuctionBid {
  walletAddress: string;
  bidAmount: number;
  username: string | null;
  favoriteTeam: string | null;
}

export function useAuctionBids(auctionId: string | number | null) {
  return useQuery({
    queryKey: ["auctionBids", auctionId],
    queryFn: async () => {
      if (!auctionId) {
        return [];
      }

      try {
        const supabaseUrl = import.meta.env.SUPABASE_URL as string;
        const anonKey = import.meta.env.SUPABASE_ANON_KEY as string;

        if (!supabaseUrl || !anonKey) {
          console.error("[useAuctionBids] Supabase config missing");
          return [];
        }

        const baseUrl = supabaseUrl;
        const root = baseUrl.replace(/\/$/, "");

        // Fetch bids from marketplace_events_with_relics, sorted by bid amount descending, limited to top 10
        const url = `${root}/rest/v1/marketplace_events_with_relics?auction_id=eq.${encodeURIComponent(String(auctionId))}&event_name=eq.NewBid&select=bidder,bidder_username,bid_amount&order=bid_amount.desc&limit=10`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          console.error(
            "[useAuctionBids] Error fetching bids:",
            response.status,
          );
          return [];
        }

        const events = (await response.json()) as Array<{
          bidder?: string;
          bidder_username?: string;
          bid_amount?: number | string;
        }>;

        if (!Array.isArray(events) || events.length === 0) {
          return [];
        }

        // Filter out null bidders and deduplicate by bidder (keep highest bid per bidder)
        const seenBidders = new Set<string>();
        const uniqueBids = events
          .filter((event) => event.bidder && event.bid_amount)
          .filter((event) => {
            const bidder = event.bidder!.toLowerCase();
            if (seenBidders.has(bidder)) {
              return false;
            }
            seenBidders.add(bidder);
            return true;
          })
          .slice(0, 5);

        // Convert to AuctionBid format using pre-fetched usernames from the view
        const bidsWithUsernames: AuctionBid[] = uniqueBids.map((event) => {
          const bidderAddress = event.bidder!;
          const bidAmount = Number(event.bid_amount!) / 1e18;
          const username = event.bidder_username || null;

          return {
            walletAddress: bidderAddress,
            bidAmount,
            username,
            favoriteTeam: null,
          };
        });

        return bidsWithUsernames;
      } catch (err) {
        console.error("[useAuctionBids] Error:", err);
        return [];
      }
    },
    enabled: Boolean(auctionId),
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}
