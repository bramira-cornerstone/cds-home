import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface RelicSerialCard {
  editionId: number;
  serial: number;
  name: string | null;
  thumb: string | null;
  gameDate: string | null;
  createDate: string | null;
  setName: string | null;
  badge: string | null;
  badge2: string | null;
  badge3: string | null;
  minted: number | null;
  team?: string | null;
  price?: string | null;
  listing_creator_username?: string | null;
}

export interface HomepageMarketplaceCards {
  newRelics: Array<RelicSerialCard & { price?: string | null }>;
  recentSales: Array<
    RelicSerialCard & { price: string | null; saleUsername?: string | null }
  >;
  previousAuctions: Array<
    RelicSerialCard & {
      bidPrice?: string | null;
      overlayText?: string | null;
      auctionEndTs?: number;
      increaseFromAsking?: string | null;
      auctionCreatorUsername?: string | null;
    }
  >;
}

async function fetchRelicSerialCard(
  maxTokenId: string | number,
  signal?: AbortSignal,
): Promise<RelicSerialCard | null> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return null;
  }

  try {
    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/RelicSerialsJoined?token_id=eq.${encodeURIComponent(String(maxTokenId))}&select=edition_id,serial,PlayerName,image_url,GameDate,CreateDate,SetName,Badge1,Badge2,Badge3,Minted&limit=1`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
      signal,
      mode: "cors",
    });

    if (!response.ok) {
      console.warn(
        "[fetchRelicSerialCard] Non-200 response:",
        response.status,
        "for token:",
        maxTokenId,
      );
      return null;
    }

    const data = (await response.json()) as Array<{
      edition_id: number;
      serial: number;
      PlayerName?: string | null;
      image_url?: string | null;
      GameDate?: string | null;
      CreateDate?: string | null;
      SetName?: string | null;
      Badge1?: string | null;
      Badge2?: string | null;
      Badge3?: string | null;
      Minted?: number | null;
    }>;

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    const row = data[0];

    const convertBadgeToImage = (
      badgeValue: string | null | undefined,
    ): string | null => {
      if (!badgeValue) return null;
      const badge = String(badgeValue).toUpperCase();
      if (badge === "CP") return "/images/cp-badge.webp";
      if (badge === "RY") return "/images/ry-badge.webp";
      if (badge === "CY") return "/images/cy-badge.webp";
      return null;
    };

    return {
      editionId: row.edition_id,
      serial: row.serial,
      name: row.PlayerName || null,
      thumb: row.image_url || null,
      gameDate: row.GameDate || null,
      createDate: row.CreateDate || null,
      setName: row.SetName || null,
      badge: convertBadgeToImage(row.Badge1),
      badge2: convertBadgeToImage(row.Badge2),
      badge3: convertBadgeToImage(row.Badge3),
      minted: row.Minted || null,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      return null;
    }
    console.warn("[fetchRelicSerialCard] Error:", err?.message || err);
    return null;
  }
}

export async function fetchHomepageMarketplaceCards(
  signal?: AbortSignal,
): Promise<HomepageMarketplaceCards> {
  const baseUrl = (import.meta.env.SUPABASE_URL as string) || "";
  const anonKey = (import.meta.env.SUPABASE_ANON_KEY as string) || "";

  if (!baseUrl || !anonKey) {
    return { newRelics: [], recentSales: [], previousAuctions: [] };
  }

  const fallbackData = { newRelics: [], recentSales: [], previousAuctions: [] };

  return withSupabaseFallback(
    "homepage-marketplace-cards",
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Single query for all recent events - marketplace_events_with_relics has max_token_id
      // which maps to RelicSerialsJoined.token_id for fetching card metadata
      const params = new URLSearchParams({
        select:
          "event_name,max_token_id,total_price_paid,price_per_token,total_price,minimum_bid_amount,buyout_bid_amount,bid_amount,max_bid,auction_end_ts,emitted_at,listing_creator_username,offeror_username,buyer_username,auction_creator_username",
        order: "emitted_at.desc",
        limit: "100",
      });
      const url = `${root}/rest/v1/marketplace_events_with_relics?${params.toString()}`;

      const headers = {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      };

      const response = await fetch(url, { headers, signal, mode: "cors" });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const allEvents = (await response.json()) as Array<{
        event_name?: string;
        max_token_id?: string | number;
        total_price_paid?: string;
        price_per_token?: string;
        total_price?: string;
        minimum_bid_amount?: string;
        buyout_bid_amount?: string;
        bid_amount?: string;
        max_bid?: string;
        auction_end_ts?: string | number;
        emitted_at?: string;
        listing_creator_username?: string;
        offeror_username?: string;
        buyer_username?: string;
        auction_creator_username?: string;
      }>;

      if (!Array.isArray(allEvents)) {
        throw new Error("Invalid response format");
      }

      // Group events by type and collect unique token IDs to fetch metadata
      const eventsByType: Record<
        string,
        Array<{
          event_name: string;
          max_token_id: string | number;
          total_price_paid?: string;
          price_per_token?: string;
          total_price?: string;
          minimum_bid_amount?: string;
          buyout_bid_amount?: string;
          bid_amount?: string;
          max_bid?: string;
          auction_end_ts?: string | number;
          listing_creator_username?: string;
          offeror_username?: string;
          buyer_username?: string;
          auction_creator_username?: string;
        }>
      > = {
        NewListing: [],
        Sales: [],
        Auctions: [],
      };

      const allTokenIds = new Set<string | number>();

      for (const event of allEvents) {
        if (!event.max_token_id) continue;

        allTokenIds.add(event.max_token_id);

        if (
          event.event_name === "NewListing" &&
          eventsByType.NewListing.length < 10
        ) {
          eventsByType.NewListing.push({
            event_name: event.event_name,
            max_token_id: event.max_token_id,
            total_price_paid: event.total_price_paid,
            price_per_token: event.price_per_token,
            total_price: event.total_price,
            listing_creator_username: event.listing_creator_username,
          });
        } else if (
          (event.event_name === "NewSale" ||
            event.event_name === "AcceptedOffer") &&
          eventsByType.Sales.length < 10
        ) {
          eventsByType.Sales.push({
            event_name: event.event_name,
            max_token_id: event.max_token_id,
            total_price_paid: event.total_price_paid,
            price_per_token: event.price_per_token,
            total_price: event.total_price,
            offeror_username: event.offeror_username,
            buyer_username: event.buyer_username,
          });
        } else if (
          event.event_name === "NewAuction" &&
          eventsByType.Auctions.length < 10
        ) {
          eventsByType.Auctions.push({
            event_name: event.event_name,
            max_token_id: event.max_token_id,
            total_price_paid: event.total_price_paid,
            price_per_token: event.price_per_token,
            total_price: event.total_price,
            minimum_bid_amount: event.minimum_bid_amount,
            buyout_bid_amount: event.buyout_bid_amount,
            bid_amount: event.bid_amount,
            max_bid: event.max_bid,
            auction_end_ts: event.auction_end_ts,
            auction_creator_username: event.auction_creator_username,
          });
        }

        if (
          eventsByType.NewListing.length >= 10 &&
          eventsByType.Sales.length >= 10 &&
          eventsByType.Auctions.length >= 10
        ) {
          break;
        }
      }

      // Fetch metadata for all token IDs from RelicSerialsJoined
      const tokenIdArray = Array.from(allTokenIds);
      const relicMetadataMap = new Map<
        string | number,
        {
          edition_id: number;
          serial: number;
          PlayerName?: string | null;
          image_url?: string | null;
          GameDate?: string | null;
          CreateDate?: string | null;
          SetName?: string | null;
          Badge1?: string | null;
          Badge2?: string | null;
          Badge3?: string | null;
          Minted?: number | null;
        }
      >();

      if (tokenIdArray.length > 0) {
        const tokenIdFilter = tokenIdArray.join(",");
        const relicUrl = `${root}/rest/v1/RelicSerialsJoined?token_id=in.(${tokenIdFilter})&select=token_id,edition_id,serial,PlayerName,image_url,GameDate,CreateDate,SetName,Badge1,Badge2,Badge3,Minted,team`;

        const relicResponse = await fetch(relicUrl, {
          headers,
          signal,
          mode: "cors",
        });

        if (!relicResponse.ok) {
          const error = new Error(
            `Supabase API error: ${relicResponse.status}`,
          ) as any;
          error.status = relicResponse.status;
          throw error;
        }

        const relicData = (await relicResponse.json()) as Array<{
          token_id: string | number;
          edition_id: number;
          serial: number;
          PlayerName?: string | null;
          image_url?: string | null;
          GameDate?: string | null;
          CreateDate?: string | null;
          SetName?: string | null;
          Badge1?: string | null;
          Badge2?: string | null;
          Badge3?: string | null;
          Minted?: number | null;
          team?: string | null;
        }>;

        if (Array.isArray(relicData)) {
          for (const relic of relicData) {
            relicMetadataMap.set(relic.token_id, relic);
          }
        }
      }

      const convertWeiToUsd = (
        weiValue: string | number | undefined,
      ): string | null => {
        if (weiValue === null || weiValue === undefined || weiValue === "") {
          return null;
        }
        try {
          const weiStr = String(weiValue).trim();
          if (!weiStr) return null;
          const weiBI = BigInt(weiStr);
          const eth = Number(weiBI) / 1e18;
          if (!Number.isFinite(eth) || eth <= 0) return null;
          const rounded = Math.round(eth);
          return `$${rounded}`;
        } catch {
          return null;
        }
      };

      const convertBadgeToImage = (
        badgeValue: string | null | undefined,
      ): string | null => {
        if (!badgeValue) return null;
        const badge = String(badgeValue).toUpperCase();
        if (badge === "CP") return "/images/cp-badge.webp";
        if (badge === "RY") return "/images/ry-badge.webp";
        if (badge === "CY") return "/images/cy-badge.webp";
        return null;
      };

      const newRelics: RelicSerialCard[] = [];
      const recentSales: Array<RelicSerialCard & { price: string | null }> = [];
      const previousAuctions: Array<
        RelicSerialCard & { bidPrice?: string | null }
      > = [];

      // Build cards from events using fetched metadata
      for (const event of eventsByType.NewListing) {
        const metadata = relicMetadataMap.get(event.max_token_id);
        if (!metadata) continue;

        const price =
          convertWeiToUsd(event.price_per_token) ||
          convertWeiToUsd(event.total_price_paid) ||
          convertWeiToUsd(event.total_price);

        newRelics.push({
          editionId: metadata.edition_id,
          serial: metadata.serial,
          name: metadata.PlayerName || null,
          thumb: metadata.image_url || null,
          gameDate: metadata.GameDate || null,
          createDate: metadata.CreateDate || null,
          setName: metadata.SetName || null,
          badge: convertBadgeToImage(metadata.Badge1),
          badge2: convertBadgeToImage(metadata.Badge2),
          badge3: convertBadgeToImage(metadata.Badge3),
          minted: metadata.Minted || null,
          team: metadata.team || null,
          price,
          listing_creator_username: event.listing_creator_username || null,
        });
      }

      for (const event of eventsByType.Sales) {
        const metadata = relicMetadataMap.get(event.max_token_id);
        if (!metadata) continue;

        const price =
          convertWeiToUsd(event.total_price_paid) ||
          convertWeiToUsd(event.price_per_token) ||
          convertWeiToUsd(event.total_price);

        // Coalesce username: offeror_username for AcceptedOffer, buyer_username for NewSale
        const saleUsername =
          event.offeror_username || event.buyer_username || null;

        recentSales.push({
          editionId: metadata.edition_id,
          serial: metadata.serial,
          name: metadata.PlayerName || null,
          thumb: metadata.image_url || null,
          gameDate: metadata.GameDate || null,
          createDate: metadata.CreateDate || null,
          setName: metadata.SetName || null,
          badge: convertBadgeToImage(metadata.Badge1),
          badge2: convertBadgeToImage(metadata.Badge2),
          badge3: convertBadgeToImage(metadata.Badge3),
          minted: metadata.Minted || null,
          team: metadata.team || null,
          price,
          saleUsername,
        });
      }

      for (const event of eventsByType.Auctions) {
        const metadata = relicMetadataMap.get(event.max_token_id);
        if (!metadata) continue;

        // Show highest bid: max of minimum_bid_amount, bid_amount, and max_bid (never buyout)
        const amounts = [
          event.minimum_bid_amount,
          event.bid_amount,
          event.max_bid,
        ].filter((amt) => amt && String(amt).trim());

        let bidPrice: string | null = null;
        if (amounts.length > 0) {
          const maxBigInt = amounts.reduce((max, current) => {
            try {
              const currentBig = BigInt(String(current));
              const maxBig = BigInt(String(max));
              return currentBig > maxBig ? current : max;
            } catch {
              return max;
            }
          });
          bidPrice = convertWeiToUsd(maxBigInt);
        }

        // Check if auction has ended
        const auctionEndTs = Number(event.auction_end_ts || 0);
        const now = Math.floor(Date.now() / 1000);
        const isAuctionEnded = auctionEndTs > 0 && auctionEndTs < now;

        let overlayText: string | null = null;
        let increaseFromAsking: string | null = null;

        if (isAuctionEnded) {
          // Calculate "Increase from Asking" for ended auctions
          try {
            const startingBid =
              Number(BigInt(event.minimum_bid_amount || "0")) / 1e18;
            const highestBidAmount =
              amounts.length > 0
                ? amounts.reduce((max, current) => {
                    const currentBig = BigInt(String(current));
                    const maxBig = BigInt(String(max));
                    return currentBig > maxBig ? current : max;
                  })
                : "0";
            const winningBid = Number(BigInt(highestBidAmount)) / 1e18;
            const percentage =
              startingBid > 0
                ? (((winningBid - startingBid) / startingBid) * 100).toFixed(2)
                : "0.00";
            overlayText = `+${percentage}%`;
            increaseFromAsking = overlayText;
          } catch {
            overlayText = null;
          }
        }
        // For active auctions, overlayText will be set in Index.tsx with countdown

        previousAuctions.push({
          editionId: metadata.edition_id,
          serial: metadata.serial,
          name: metadata.PlayerName || null,
          thumb: metadata.image_url || null,
          gameDate: metadata.GameDate || null,
          createDate: metadata.CreateDate || null,
          setName: metadata.SetName || null,
          badge: convertBadgeToImage(metadata.Badge1),
          badge2: convertBadgeToImage(metadata.Badge2),
          badge3: convertBadgeToImage(metadata.Badge3),
          minted: metadata.Minted || null,
          team: metadata.team || null,
          bidPrice,
          overlayText,
          auctionEndTs,
          increaseFromAsking,
          auctionCreatorUsername: event.auction_creator_username || null,
        });
      }

      return { newRelics, recentSales, previousAuctions };
    },
    fallbackData,
    "fetchHomepageMarketplaceCards",
  );
}
