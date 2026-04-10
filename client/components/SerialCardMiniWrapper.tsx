import SerialCardMini, { type SerialCardMiniProps } from "./SerialCardMini";
import type { MarketplaceEvent } from "@/lib/marketplaceEvents";

interface SerialCardMiniWrapperProps extends SerialCardMiniProps {
  wrapperClassName?: string;
  outerClassName?: string;
  modal?: boolean;
  event?: MarketplaceEvent;
}

function formatPrice(value: any): string {
  if (value === null || value === undefined) return "";
  try {
    const str = String(value).trim();
    if (!str) return "";
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

function formatTimestamp(value: any): string {
  if (!value) return "";
  try {
    if (typeof value === "string" && value.includes("-")) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return date.toLocaleDateString();
      }
    }
    const num = typeof value === "string" ? parseInt(value, 10) : value;
    if (!Number.isFinite(num)) return "";
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

function extractEventData(
  eventArg: MarketplaceEvent | undefined,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!eventArg) return result;
  try {
    const decoded =
      typeof eventArg.decoded === "string"
        ? JSON.parse(eventArg.decoded)
        : eventArg.decoded;
    if (!decoded || typeof decoded !== "object") return result;

    const fieldMap: Record<
      string,
      { label: string; formatter?: (v: any) => string }
    > = {
      price_per_token: { label: "Price", formatter: formatPrice },
      pricePerToken: { label: "Price", formatter: formatPrice },
      listing_start_ts: { label: "Start Date", formatter: formatTimestamp },
      listingStartTs: { label: "Start Date", formatter: formatTimestamp },
      listing_end_ts: { label: "End Date", formatter: formatTimestamp },
      listingEndTs: { label: "End Date", formatter: formatTimestamp },
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
      total_price: { label: "Offer Price", formatter: formatPrice },
      totalPrice: { label: "Offer Price", formatter: formatPrice },
      offer_expiration_ts: { label: "Expires", formatter: formatTimestamp },
      offerExpirationTs: { label: "Expires", formatter: formatTimestamp },
      total_price_paid: { label: "Price", formatter: formatPrice },
      totalPricePaid: { label: "Price", formatter: formatPrice },
      // Username fields (prioritized)
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
      // Address fields (fallback)
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

      // Skip offeror field for NewOffer events (use offeror_username)
      if (eventArg.event_name === "NewOffer" && key === "offeror") {
        continue;
      }

      // Skip closer field for AuctionClosed events (use auction_creator_username instead)
      if (eventArg.event_name === "AuctionClosed" && key === "closer") {
        continue;
      }

      // For NewSale events, skip buyer and seller addresses (use usernames)
      if (eventArg.event_name === "NewSale") {
        if (key === "buyer" || key === "seller") {
          continue;
        }
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
  } catch (err) {
    console.error("Error extracting event data:", err);
  }
  return result;
}

export default function SerialCardMiniWrapper({
  wrapperClassName,
  outerClassName = "flex justify-center max-sm:mx-auto",
  modal = false,
  event,
  ...serialProps
}: SerialCardMiniWrapperProps) {
  const defaultWrapperClassName =
    "bg-slate-200 dark:bg-slate-800 rounded overflow-hidden flex items-center justify-center p-2 max-sm:mx-auto lg:aspect-[3/4] lg:h-[250px]";
  const modalWrapperClassName =
    "bg-slate-50 dark:bg-slate-800 rounded overflow-hidden flex items-center justify-center p-2 max-sm:mx-auto lg:h-[175px] lg:w-[130px]";
  const finalWrapperClassName =
    wrapperClassName ??
    (modal ? modalWrapperClassName : defaultWrapperClassName);

  const eventData = extractEventData(event);
  const hasEventData = Object.keys(eventData).length > 0;
  const hasEventTitle = event?.event_name;

  // Always show title and card layout if event title is present
  if (hasEventTitle) {
    return (
      <div className="flex flex-col w-full gap-2">
        <div className="text-center text-sm font-semibold text-slate-700 dark:text-slate-300">
          {event.event_name}
        </div>
        {hasEventData && (
          <div className="flex gap-3 w-full">
            <div className={finalWrapperClassName}>
              <SerialCardMini {...serialProps} disableBadgeTooltips={true} />
            </div>
            <div className="flex-1 flex flex-col justify-start gap-3 text-xs">
              {Object.entries(eventData).map(([label, value]) => (
                <div key={label}>
                  <div className="text-slate-500 dark:text-slate-400 font-medium">
                    {label}
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 font-semibold">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {!hasEventData && (
          <div className={outerClassName}>
            <div className={finalWrapperClassName}>
              <SerialCardMini {...serialProps} disableBadgeTooltips={true} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default centered layout without event title
  return (
    <div
      className={`${outerClassName} max-lg:h-[225px]`}
      data-tablet-container
      style={{ margin: "0 auto" }}
    >
      <div
        className={finalWrapperClassName}
        data-tablet-card
        style={{ margin: "0 auto" }}
      >
        <SerialCardMini {...serialProps} disableBadgeTooltips={true} />
      </div>
    </div>
  );
}
