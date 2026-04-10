import React, { useEffect, useState } from "react";
import {
  fetchMarketplaceEvents,
  type MarketplaceEvent,
} from "@/lib/marketplaceEvents";

// Event signature mapping: event_name -> indexed parameter names
const EVENT_SIGNATURES: Record<string, string[]> = {
  CancelledListing: ["listingCreator", "listingId"],
  NewListing: ["listingCreator", "listingId", "assetContract"],
  NewSale: ["listingCreator", "listingId", "assetContract"],
  UpdatedListing: ["listingCreator", "listingId", "assetContract"],
  AuctionClosed: ["auctionId", "assetContract", "closer"],
  CancelledAuction: ["auctionCreator", "auctionId"],
  NewAuction: ["auctionCreator", "auctionId", "assetContract"],
  NewBid: ["auctionId", "bidder", "assetContract"],
  AcceptedOffer: ["offeror", "offerId", "assetContract"],
  CancelledOffer: ["offeror", "offerId"],
  NewOffer: ["offeror", "offerId", "assetContract"],
};

// Parameters that represent addresses
const ADDRESS_PARAMS = new Set([
  "listingCreator",
  "assetContract",
  "closer",
  "auctionCreator",
  "bidder",
  "offeror",
  "seller",
  "buyer",
  "winningBidder",
  "auctionCreator",
]);

// Parameters that represent numbers (uint256, uint64, etc)
const NUMBER_PARAMS = new Set([
  "listingId",
  "auctionId",
  "offerId",
  "tokenId",
  "quantity",
]);

function decodeHexTopic(
  hex: string,
  paramName: string,
): { value: string; decoded?: string } {
  try {
    // Signature hash - no decoding needed
    if (paramName === "signature") {
      return { value: hex };
    }

    // Remove 0x prefix for processing
    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

    // Check if it's an address (20 bytes = 40 hex chars)
    if (ADDRESS_PARAMS.has(paramName)) {
      // Take last 40 characters (20 bytes) for address
      const addressHex = cleanHex.slice(-40);
      return {
        value: hex,
        decoded: `0x${addressHex.toLowerCase()}`,
      };
    }

    // Check if it's a number (uint256)
    if (NUMBER_PARAMS.has(paramName)) {
      try {
        const bigIntValue = BigInt(`0x${cleanHex}`);
        return {
          value: hex,
          decoded: bigIntValue.toString(),
        };
      } catch {
        return { value: hex };
      }
    }

    // Default: return as is
    return { value: hex };
  } catch (err) {
    return { value: hex };
  }
}

interface InlineTopicsProps {
  topics: string[];
  eventName: string;
}

async function fetchUsernameForAddress(
  address: string,
): Promise<string | null> {
  try {
    const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
    const anonKey = import.meta.env.SUPABASE_ANON_KEY as
      | string
      | undefined;

    if (!baseUrl || !anonKey) return null;

    const root = baseUrl.replace(/\/$/, "");
    const lowerAddress = address.toLowerCase();
    const url = `${root}/rest/v1/profiles?wallet_address=ilike.${encodeURIComponent(lowerAddress)}&select=username`;

    const response = await fetch(url, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        Accept: "application/json",
      },
    });

    if (response.ok) {
      const data = (await response.json()) as Array<{
        username: string | null;
      }>;
      if (Array.isArray(data) && data.length > 0 && data[0].username) {
        return data[0].username;
      }
    }
  } catch (err) {
    console.error(`Failed to fetch username for ${address}:`, err);
  }

  return null;
}

function InlineTopicItem({
  paramName,
  decoded,
  isAddressField,
}: {
  paramName: string;
  decoded: { value: string; decoded?: string };
  isAddressField: boolean;
}) {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    if (!isAddressField || !decoded.decoded) return;

    const fetchUsername = async () => {
      const name = await fetchUsernameForAddress(decoded.decoded!);
      setUsername(name);
    };

    fetchUsername();
  }, [decoded.decoded, isAddressField]);

  const displayValue = username || decoded.decoded;

  return (
    <span className="text-slate-700 dark:text-slate-300 break-all">
      {displayValue || (
        <code className="text-slate-600 dark:text-slate-400 break-all font-mono text-xs">
          {decoded.value}
        </code>
      )}
    </span>
  );
}

function InlineTopics({ topics, eventName }: InlineTopicsProps) {
  const indexedParams = EVENT_SIGNATURES[eventName] || [];

  return (
    <div className="space-y-1">
      {topics.map((topic, idx) => {
        // Skip signature (idx === 0)
        if (idx === 0) return null;

        const paramName = indexedParams[idx - 1] || `indexed_param_${idx}`;
        const decoded = decodeHexTopic(topic, paramName);
        const isAddressField = ADDRESS_PARAMS.has(paramName);

        return (
          <div
            key={idx}
            className="flex items-start gap-2 justify-start"
            style={{ marginTop: idx > 0 ? "4px" : "0" }}
          >
            <span className="text-slate-600 dark:text-slate-400 font-semibold whitespace-nowrap flex-shrink-0">
              {paramName}:
            </span>
            <InlineTopicItem
              paramName={paramName}
              decoded={decoded}
              isAddressField={isAddressField}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<MarketplaceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const fetchedEvents = await fetchMarketplaceEvents(ctrl.signal);
        if (!ctrl.signal.aborted) {
          setEvents(fetchedEvents);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError("Failed to load events");
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (loading) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-slate-700 dark:text-slate-300">
          Loading events...
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </section>
    );
  }

  if (events.length === 0) {
    return (
      <section className="container mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold mb-4 dark:text-white">
          Marketplace Events
        </h1>
        <div className="text-slate-700 dark:text-slate-300">
          No events found.
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">
        Marketplace Events
      </h1>

      <div className="space-y-3">
        {events.map((event, idx) => (
          <div
            key={`${event.id}-${idx}`}
            className="text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded p-4"
            style={{
              boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "12px",
              alignItems: "start",
            }}
          >
            {/* Left column: Event name pill, Emitted, and Transaction */}
            <div className="flex flex-col gap-2 min-w-0">
              {/* Serial-style pill for event name */}
              <div
                className="flex items-center justify-center px-3 py-2 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap flex-shrink-0"
                style={{
                  minHeight: "32px",
                  fontSize: "12px",
                  fontWeight: "600",
                }}
              >
                {event.event_name}
              </div>

              {/* Emitted At */}
              <div>
                <span className="text-slate-700 dark:text-slate-300">
                  {new Date(event.emitted_at).toLocaleString()}
                </span>
              </div>

              {/* TX Hash Link */}
              <div>
                <a
                  href={`https://polygonscan.com/tx/${event.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 font-semibold transition-colors"
                >
                  Transaction
                </a>
              </div>
            </div>

            {/* Right column: Decoded Topics */}
            <div className="flex flex-col gap-2 min-w-0">
              {/* Decoded Topics */}
              {(() => {
                try {
                  const logData =
                    typeof event.raw_log === "string"
                      ? JSON.parse(event.raw_log)
                      : event.raw_log;
                  if (
                    Array.isArray(logData?.topics) &&
                    logData.topics.length > 0
                  ) {
                    return (
                      <InlineTopics
                        topics={logData.topics}
                        eventName={event.event_name}
                      />
                    );
                  }
                  return null;
                } catch (err) {
                  return null;
                }
              })()}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
