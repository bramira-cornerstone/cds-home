import { fetchMarketplaceEvents } from "@/lib/marketplaceEvents";
import { getTeamCrest } from "@/lib/teams";
import type { AlertItem } from "@/lib/alerts";
import { createClient } from "@supabase/supabase-js";

interface EventInitiator {
  username: string;
  teamCrest?: string;
}

/**
 * Extract username from marketplace event based on event type
 * Uses the same logic as EditionEventsChart.tsx
 */
function getEventInitiatorUsername(
  eventName: string,
  decoded: any,
): { username: string; walletAddress: string } {
  let username = "";
  let walletAddress = "";

  if (
    eventName === "NewListing" ||
    eventName === "CancelledListing" ||
    eventName === "UpdatedListing"
  ) {
    username =
      decoded?.listing_creator_username ||
      decoded?.listingCreatorUsername ||
      "";
    walletAddress = decoded?.listing_creator || decoded?.listingCreator || "";
  } else if (eventName === "NewAuction" || eventName === "CancelledAuction") {
    username =
      decoded?.auction_creator_username ||
      decoded?.auctionCreatorUsername ||
      "";
    walletAddress = decoded?.auction_creator || decoded?.auctionCreator || "";
  } else if (eventName === "NewBid") {
    username = decoded?.bidder_username || decoded?.bidderUsername || "";
    walletAddress = decoded?.bidder || "";
  } else if (eventName === "NewOffer" || eventName === "CancelledOffer") {
    username = decoded?.offeror_username || decoded?.offerorUsername || "";
    walletAddress = decoded?.offeror || "";
  } else if (eventName === "NewSale") {
    username = decoded?.buyer_username || decoded?.buyerUsername || "";
    walletAddress = decoded?.buyer || "";
  } else if (eventName === "AcceptedOffer") {
    username = decoded?.seller_username || decoded?.sellerUsername || "";
    walletAddress = decoded?.seller || "";
  } else if (eventName === "AuctionClosed") {
    username =
      decoded?.winning_bidder_username || decoded?.winningBidderUsername || "";
    walletAddress = decoded?.winning_bidder || decoded?.winningBidder || "";
  }

  if (!username && walletAddress) {
    username = walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
  }

  return { username: username || "Unknown", walletAddress };
}

/**
 * Calculate price from marketplace event
 * Reuses logic from EditionEventsChart.calculateEventPrice
 */
function calculateEventPrice(event: any): number {
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
}

/**
 * Format price as composite price string
 */
function formatCompositePrice(priceInWei: number): string {
  if (!priceInWei || priceInWei === 0) return "";
  const priceInTokens = priceInWei / 1e18;
  return `$${priceInTokens.toFixed(2)}`;
}

/**
 * Fetch favorite team for a wallet address
 */
async function getInitiatorTeamCrest(
  walletAddress: string,
): Promise<string | undefined> {
  try {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;

    if (!baseUrl || !anonKey || !walletAddress) {
      return undefined;
    }

    const profileUrl = `${baseUrl.replace(/\/$/, "")}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(walletAddress)}&select=favorite_team&limit=1`;
    const profileRes = await fetch(profileUrl, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (
        Array.isArray(profiles) &&
        profiles.length > 0 &&
        profiles[0].favorite_team
      ) {
        return getTeamCrest(profiles[0].favorite_team);
      }
    }
  } catch (err) {
  }

  return undefined;
}

/**
 * Generate edition event alerts for a wallet
 *
 * Joins marketplace_events_with_relics with eventsubscriptions on edition_id.
 * For each marketplace event, sends an alert to all wallet addresses
 * (case-insensitive) that are subscribed to that edition_id.
 *
 * Filters events where:
 * - event.edition_id = subscription.edition_id
 * - event.emitted_at >= subscription.created_at
 *
 * Creates alerts in format:
 * "{event_name} ${composite price} {composite username} {PlayerName} #{serial} of {Minted}"
 */
export async function generateEditionEventAlerts(
  walletAddress: string,
): Promise<AlertItem[]> {
  try {
    const normalizedWallet = walletAddress.toLowerCase();
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;

    if (!baseUrl || !anonKey) {
      return [];
    }

    // Fetch all subscriptions for this wallet with created_at timestamps
    // Using case-insensitive matching (ilike) to handle various address formats
    const supabase = createClient(baseUrl, anonKey);
    const { data: subscriptions, error: subError } = await supabase
      .from("eventsubscriptions")
      .select("edition_id, created_at")
      .ilike("wallet_address", normalizedWallet);

    if (subError || !subscriptions || subscriptions.length === 0) {
      console.debug(
        "[generateEditionEventAlerts] No subscriptions found for wallet:",
        normalizedWallet.substring(0, 10),
      );
      return [];
    }

    // Create a map of edition_id -> created_at for quick lookup
    const subscriptionMap = new Map<number, string>(
      subscriptions.map((s: any) => [s.edition_id, s.created_at]),
    );

    console.debug(
      "[generateEditionEventAlerts] Found subscriptions for",
      subscriptionMap.size,
      "editions",
    );

    // Fetch all marketplace events
    const allEvents = await fetchMarketplaceEvents();

    if (!Array.isArray(allEvents) || allEvents.length === 0) {
      console.debug("[generateEditionEventAlerts] No marketplace events found");
      return [];
    }

    // Filter events matching subscriptions
    const alerts: AlertItem[] = [];
    const initiatorCache: Record<string, EventInitiator> = {};

    for (const event of allEvents) {
      try {
        // Only process events with edition_id
        const editionId = event.decoded?.edition_id;
        if (!editionId || !subscriptionMap.has(editionId)) {
          continue;
        }

        // Check if event happened after subscription was created
        const subscriptionCreatedAt = subscriptionMap.get(editionId);
        if (!subscriptionCreatedAt) {
          continue;
        }

        const eventTime = new Date(event.emitted_at).getTime();
        const subscriptionTime = new Date(subscriptionCreatedAt).getTime();

        // Include events that occurred at or after subscription creation
        if (eventTime < subscriptionTime) {
          continue;
        }

        // Parse decoded data
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;

        if (!decoded) {
          continue;
        }

        // Get initiator info for the event
        const { username, walletAddress: initiatorWallet } =
          getEventInitiatorUsername(event.event_name, decoded);

        // Get team crest from cache or fetch
        let teamCrest = initiatorCache[initiatorWallet]?.teamCrest;
        if (!teamCrest && initiatorWallet) {
          teamCrest = await getInitiatorTeamCrest(initiatorWallet);
          initiatorCache[initiatorWallet] = { username, teamCrest };
        } else if (!initiatorCache[initiatorWallet]) {
          initiatorCache[initiatorWallet] = { username, teamCrest };
        }

        // Use username with team crest context
        const compositeUsername = username;

        // Calculate price
        const priceInWei = calculateEventPrice(event);
        const compositePrice = formatCompositePrice(priceInWei);

        // Extract serial data from marketplace event
        const playerName = decoded?.PlayerName || decoded?.playerName || "";
        const serial = decoded?.serial;
        const minted = decoded?.Minted || decoded?.minted;

        // Format timestamp of when event occurred
        let formattedTime = "";
        try {
          const date = new Date(event.emitted_at);
          formattedTime = date.toLocaleString();
        } catch {
          formattedTime = event.emitted_at;
        }

        // Build alert message in format:
        // "{composite username} just submitted a {event_name} transaction for {PlayerName} {SetName} #{serial} of {Minted}"
        const messageParts: string[] = [];

        if (compositeUsername) {
          messageParts.push(compositeUsername);
        }

        messageParts.push("just submitted a");

        if (event.event_name) {
          messageParts.push(event.event_name);
        }

        messageParts.push("transaction for");

        if (playerName) {
          messageParts.push(playerName);
        }

        const setName = decoded?.SetName || decoded?.setName || "";
        if (setName) {
          messageParts.push(setName);
        }

        if (serial !== undefined && serial !== null) {
          messageParts.push(`#${serial}`);
        }

        if (minted !== undefined && minted !== null) {
          messageParts.push(`of ${minted}`);
        }

        const displayMessage = messageParts.filter(Boolean).join(" ");

        // Title is always the same for subscription alerts
        const title = "An edition you subscribe to had a marketplace event";

        // Create alert with edition_id and display text in body JSON
        const bodyData = {
          displayText: displayMessage,
          edition_id: editionId,
          emitted_at: formattedTime,
        };

        // Use unique ID combining edition and event ID
        // This ensures same event won't create duplicate alerts
        const alertId = `edition-event:${editionId}:${event.id}`;

        const alert: AlertItem = {
          id: alertId,
          title,
          body: JSON.stringify(bodyData),
          createdAt: new Date(event.emitted_at).getTime(),
        };

        alerts.push(alert);
      } catch (err) {
        console.debug(
          "[generateEditionEventAlerts] Error processing event:",
          err instanceof Error ? err.message : err,
        );
        continue;
      }
    }

    console.debug(
      "[generateEditionEventAlerts] Generated",
      alerts.length,
      "alerts for wallet",
      normalizedWallet.substring(0, 10),
    );

    return alerts;
  } catch (err) {
    console.error("[generateEditionEventAlerts] Error:", err);
    return [];
  }
}
