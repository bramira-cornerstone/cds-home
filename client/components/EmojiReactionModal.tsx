import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import SerialCardMiniWrapper from "./SerialCardMiniWrapper";
import type { SerialCardMiniProps } from "./SerialCardMini";
import type { MarketplaceEvent } from "@/lib/marketplaceEvents";

const EMOJI_REACTIONS = ["👍", "🤝", "👑", "👏", "🎉", "⚽️", "💯", "👀"];

function formatPrice(value: any): string {
  if (value === null || value === undefined) return "";
  try {
    const str = String(value).trim();
    if (!str) return "";
    // Try to parse as BigInt (wei/smallest unit)
    const num = BigInt(str);
    const decimals = 18;
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = num / divisor;
    const remainder = num % divisor;
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const trimmedRemainder = remainderStr.replace(/0+$/, "");
    const displayValue = trimmedRemainder
      ? `${whole}.${trimmedRemainder}`
      : whole.toString();
    return `$${displayValue}`;
  } catch {
    return `$${value}`;
  }
}

function formatRMV(value: any): string {
  if (value === null || value === undefined) return "";
  try {
    const str = String(value).trim();
    if (!str) return "";
    // Parse as BigInt and convert from 18 decimals to #.## format (no currency)
    const num = BigInt(str);
    const decimals = 18;
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = num / divisor;
    const remainder = num % divisor;
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const trimmedRemainder = remainderStr.slice(0, 2); // Take only 2 decimal places
    const displayValue = trimmedRemainder
      ? `${whole}.${trimmedRemainder}`
      : whole.toString();
    return displayValue;
  } catch {
    return String(value);
  }
}

function formatDecimalValue(value: any): string {
  if (value === null || value === undefined) return "";
  try {
    // For values that are already formatted as decimals (e.g., "22.00")
    const num = parseFloat(String(value));
    if (!Number.isFinite(num)) return "";
    // Format to 2 decimal places
    return num.toFixed(2);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: any): string {
  if (!value) return "";
  try {
    // Try parsing as ISO string first
    if (typeof value === "string" && value.includes("-")) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }
    // Try parsing as unix timestamp (seconds or milliseconds)
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (!Number.isFinite(num)) return "";
    // Detect if milliseconds (value > year 2200 in seconds) or seconds
    const ms = num > 10000000000 ? num : num * 1000;
    return new Date(ms).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatUsername(value: any): string {
  if (!value) return "";
  const str = String(value).trim();
  if (!str) return "";
  // Truncate to 20 characters with ellipsis if longer
  return str.length > 20 ? `${str.slice(0, 20)}...` : str;
}

function formatTimestampWithTime(value: any): string {
  if (!value) return "";
  try {
    // Try parsing as ISO string first
    if (typeof value === "string" && value.includes("-")) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleString();
      }
    }
    // Try parsing as unix timestamp (seconds or milliseconds)
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (!Number.isFinite(num)) return "";
    // Detect if milliseconds (value > year 2200 in seconds) or seconds
    const ms = num > 10000000000 ? num : num * 1000;
    return new Date(ms).toLocaleString();
  } catch {
    return String(value);
  }
}

function formatRMVWithPlus(value: any): string {
  if (value === null || value === undefined) return "";
  try {
    const str = String(value).trim();
    if (!str) return "";
    // Parse as BigInt and convert from 18 decimals to #.## format with + prefix
    const num = BigInt(str);
    const decimals = 18;
    const divisor = BigInt(10) ** BigInt(decimals);
    const whole = num / divisor;
    const remainder = num % divisor;
    const remainderStr = remainder.toString().padStart(decimals, "0");
    const trimmedRemainder = remainderStr.slice(0, 2); // Take only 2 decimal places
    const displayValue = trimmedRemainder
      ? `${whole}.${trimmedRemainder}`
      : whole.toString();
    return `+${displayValue}`;
  } catch {
    return String(value);
  }
}

function extractEventData(
  event: MarketplaceEvent | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!event) return result;
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;
    if (!decoded || typeof decoded !== "object") return result;

    const fieldMap: Record<
      string,
      { label: string; formatter?: (v: any) => string }
    > = {
      // Listing fields
      price_per_token: { label: "Price", formatter: formatPrice },
      pricePerToken: { label: "Price", formatter: formatPrice },
      listing_start_ts: { label: "Start Date", formatter: formatTimestamp },
      listingStartTs: { label: "Start Date", formatter: formatTimestamp },
      listing_end_ts: { label: "End Date", formatter: formatTimestamp },
      listingEndTs: { label: "End Date", formatter: formatTimestamp },
      // Auction fields
      minimum_bid_amount: { label: "Min Bid", formatter: formatPrice },
      minimumBidAmount: { label: "Min Bid", formatter: formatPrice },
      buyout_bid_amount: { label: "Buyout Price", formatter: formatPrice },
      buyoutBidAmount: { label: "Buyout Price", formatter: formatPrice },
      bid_amount: { label: "Bid Amount", formatter: formatPrice },
      bidAmount: { label: "Bid Amount", formatter: formatPrice },
      auction_start_ts: { label: "Auction Start", formatter: formatTimestamp },
      auctionStartTs: { label: "Auction Start", formatter: formatTimestamp },
      auction_end_ts: { label: "Auction End", formatter: formatTimestamp },
      auctionEndTs: { label: "Auction End", formatter: formatTimestamp },
      // Offer fields
      total_price: { label: "Offer Price", formatter: formatPrice },
      totalPrice: { label: "Offer Price", formatter: formatPrice },
      offer_expiration_ts: { label: "Expires", formatter: formatTimestamp },
      offerExpirationTs: { label: "Expires", formatter: formatTimestamp },
      // Sale fields
      total_price_paid: { label: "Price", formatter: formatPrice },
      totalPricePaid: { label: "Price", formatter: formatPrice },
      // Staking fields
      rolling_median_sale: { label: "RMV", formatter: formatRMV },
      timestamp: { label: "Staked", formatter: formatTimestamp },
      // Redemption fields
      rmv_redeemed: { label: "RMV Redeemed", formatter: formatRMV },
      // Counterparties - Username fields (prioritized)
      buyer_username: { label: "Buyer", formatter: formatUsername },
      buyerUsername: { label: "Buyer", formatter: formatUsername },
      listing_creator_username: { label: "Lister", formatter: formatUsername },
      listingCreatorUsername: { label: "Lister", formatter: formatUsername },
      offeror_username: { label: "Offeror", formatter: formatUsername },
      offerorUsername: { label: "Offeror", formatter: formatUsername },
      seller_username: { label: "Seller", formatter: formatUsername },
      sellerUsername: { label: "Seller", formatter: formatUsername },
      winning_bidder_username: { label: "Winner", formatter: formatUsername },
      auction_creator_username: {
        label: "Auction Creator",
        formatter: formatUsername,
      },
      // Address fields (fallback if no username)
      buyer: { label: "Buyer" },
      seller: { label: "Seller" },
      offeror: { label: "Offeror" },
      closer: { label: "Closed By" },
    };

    const seenLabels = new Set<string>();

    for (const [key, config] of Object.entries(fieldMap)) {
      // Skip raw address fields if we've already seen the username version
      if (key === "buyer" && seenLabels.has("Buyer")) continue;
      if (key === "seller" && seenLabels.has("Seller")) continue;
      if (key === "offeror" && seenLabels.has("Offeror")) continue;
      if (key === "closer" && seenLabels.has("Closed By")) continue;

      // Skip closer field for AuctionClosed events (use auction_creator_username instead)
      if (event?.event_name === "AuctionClosed" && key === "closer") {
        continue;
      }

      // For NewSale events, skip buyer and seller addresses (use usernames)
      if (event?.event_name === "NewSale") {
        if (key === "buyer" || key === "seller") {
          continue;
        }
      }

      // For NewOffer events, skip offeror address (use offeror_username)
      if (event?.event_name === "NewOffer" && key === "offeror") {
        continue;
      }

      const value = (decoded as any)[key];
      if (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        !seenLabels.has(config.label)
      ) {
        const formatted = config.formatter
          ? config.formatter(value)
          : String(value);
        if (formatted && formatted !== "") {
          result[config.label] = formatted;
          seenLabels.add(config.label);
        }
      }
    }

    // Handle RelicStaked events with special field mapping
    if (event?.event_name === "RelicStaked") {
      // Clear previous results and rebuild with RelicStaked-specific fields
      const relicResult: Record<string, string> = {};

      // Collector: username from the staker
      if ((decoded as any).username) {
        relicResult["Collector"] = (decoded as any).username;
      }

      // Leaderboard: just the team name
      if ((decoded as any).team) {
        relicResult["Leaderboard"] = (decoded as any).team;
      }

      // RMV: with + prefix
      if ((decoded as any).rolling_median_sale) {
        relicResult["RMV"] = formatRMVWithPlus(
          (decoded as any).rolling_median_sale,
        );
      }

      // Staked: timestamp with date and time
      if ((decoded as any).timestamp) {
        relicResult["Staked"] = formatTimestampWithTime(
          (decoded as any).timestamp,
        );
      }

      // Expires: stakingExpiration with date and time
      if ((decoded as any).stakingExpiration) {
        relicResult["Expires"] = formatTimestampWithTime(
          (decoded as any).stakingExpiration,
        );
      }

      return relicResult;
    }

    // Handle RelicRedeemed events with special field mapping
    if (event?.event_name === "RelicRedeemed") {
      // Clear previous results and rebuild with RelicRedeemed-specific fields
      const redeemedResult: Record<string, string> = {};

      // Collector: username
      if ((decoded as any).username) {
        redeemedResult["Collector"] = (decoded as any).username;
      }

      // Team: team name
      if ((decoded as any).team) {
        redeemedResult["Team"] = (decoded as any).team;
      }

      // RMV Redeemed: already formatted as decimal, just ensure proper format
      if ((decoded as any).rmv_redeemed) {
        redeemedResult["RMV Redeemed"] = formatDecimalValue(
          (decoded as any).rmv_redeemed,
        );
      }

      // Submitted: timestamp with date and time
      if ((decoded as any).timestamp) {
        redeemedResult["Submitted"] = formatTimestampWithTime(
          (decoded as any).timestamp,
        );
      }

      return redeemedResult;
    }
  } catch (err) {
    console.error("Error extracting event data:", err);
  }
  return result;
}

interface EmojiReactionPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  selectedEmoji?: string;
  triggerRef?: React.RefObject<HTMLButtonElement>;
  serialData?: SerialCardMiniProps;
  event?: MarketplaceEvent;
  onNavigate?: (path: string) => void;
  eventId?: string;
}

export function EmojiReactionModal({
  isOpen,
  onClose,
  onSelectEmoji,
  selectedEmoji,
  triggerRef,
  serialData,
  event,
  onNavigate,
  eventId,
}: EmojiReactionPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [emojiCounts, setEmojiCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!isOpen || !eventId) {
      setEmojiCounts({});
      return;
    }

    const fetchEmojiCounts = async () => {
      try {
        const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!supabaseUrl || !anonKey) return;

        const baseUrl = supabaseUrl.replace(/\/$/, "");
        const url = `${baseUrl}/rest/v1/emoji_reactions?event_id=eq.${eventId}&select=emoji`;

        const response = await fetch(url, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const counts: Record<string, number> = {};
          for (const reaction of data) {
            counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
          }
          setEmojiCounts(counts);
        }
      } catch (err) {
        console.error("Error fetching emoji counts:", err);
      }
    };

    fetchEmojiCounts();
  }, [isOpen, eventId]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: Event) => {
      const target = e.target as Node;
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(target)) return;
      onClose();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, {
      passive: true,
    });

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown as any);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleEmojiClick = (emoji: string) => {
    onSelectEmoji(emoji);
    onClose();
  };

  const eventData = event ? extractEventData(event) : {};
  const hasEventData = Object.keys(eventData).length > 0;
  const maxWidth = serialData && hasEventData ? 500 : serialData ? 280 : 200;

  const handleSerialCardClick = () => {
    if (onNavigate && serialData?.id) {
      const path =
        serialData.serial !== null && serialData.serial !== undefined
          ? `/edition/${serialData.id}/serial/${serialData.serial}`
          : `/edition/${serialData.id}`;
      onNavigate(path);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        ref={popoverRef}
        className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-lg flex flex-col pointer-events-auto relative"
        style={{
          maxWidth: `${maxWidth}px`,
        }}
      >
        {/* Header with event name and close button */}
        <div className="flex items-center justify-between px-3 py-2">
          <div className="flex-1"></div>
          <h2 className="flex-1 text-center font-semibold text-sm text-slate-800 dark:text-slate-100">
            {event?.event_name || "Event"}
          </h2>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-1 rounded-md opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-slate-300 dark:focus:ring-slate-600"
              aria-label="Close modal"
            >
              <X className="h-4 w-4 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-3 flex flex-col gap-3">
          {/* Side-by-side layout: SerialCard on left, event data on right */}
          {serialData && hasEventData ? (
            <div className="flex gap-3">
              {/* Left: Serial Card (no event to avoid wrapper's own layout logic) */}
              <div
                onClick={handleSerialCardClick}
                className="cursor-pointer flex-shrink-0"
              >
                <SerialCardMiniWrapper {...serialData} modal={true} />
              </div>
              {/* Right: Event Data */}
              <div className="flex-1 flex flex-col justify-start gap-2 text-[11px]">
                {Object.entries(eventData).map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {label}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold break-words">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : serialData ? (
            <div onClick={handleSerialCardClick} className="cursor-pointer">
              <SerialCardMiniWrapper {...serialData} modal={true} />
            </div>
          ) : hasEventData ? (
            <div className="w-full">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                {Object.entries(eventData).map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">
                      {label}
                    </span>
                    <span className="text-slate-800 dark:text-slate-200 font-semibold truncate">
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
            <div className="grid grid-cols-4 gap-2 w-full">
              {EMOJI_REACTIONS.map((emoji) => {
                const count = emojiCounts[emoji] || 0;
                return (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className={`relative flex items-center justify-center text-xl p-2 rounded transition-all hover:scale-125 ${
                      selectedEmoji === emoji
                        ? "border-2 border-[#FF6300]"
                        : "border-2 border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
                    }`}
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                    {count > 0 && (
                      <span className="absolute bottom-0 right-0 text-[9px] text-slate-600 dark:text-slate-400 font-semibold bg-white dark:bg-slate-800 rounded-full w-4 h-4 flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
