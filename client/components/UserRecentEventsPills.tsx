import { useEffect, useState, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import { useNavigate } from "react-router-dom";
import {
  fetchMarketplaceEvents,
  type MarketplaceEvent,
} from "@/lib/marketplaceEvents";
import {
  fetchStakingEventsForWallet,
  fetchRedemptionEventsForWallet,
  type CollectionEvent,
} from "@/lib/stakingAndRedemptionEvents";
import {
  saveEmojiReaction,
  fetchUserReactionForEvent,
  deleteEmojiReaction,
  fetchEmojiReactionsForEvent,
  fetchEmojiReactionsForWallet,
} from "@/lib/emojiReactions";
import {
  resolveTokenIdFromEvent,
  fetchSerialData,
  enrichEventWithDetails,
  type SerialData,
} from "@/lib/marketplaceEvents";
import type { SerialCardMiniProps } from "@/components/SerialCardMini";
import { EmojiReactionModal } from "@/components/EmojiReactionModal";

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
]);

const NUMBER_PARAMS = new Set([
  "listingId",
  "auctionId",
  "offerId",
  "tokenId",
  "quantity",
]);

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

function decodeHexTopic(
  hex: string,
  paramName: string,
): { value: string; decoded?: string } {
  try {
    if (paramName === "signature") {
      return { value: hex };
    }

    const cleanHex = hex.startsWith("0x") ? hex.slice(2) : hex;

    if (ADDRESS_PARAMS.has(paramName)) {
      const addressHex = cleanHex.slice(-40);
      return {
        value: hex,
        decoded: `0x${addressHex.toLowerCase()}`,
      };
    }

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

    return { value: hex };
  } catch (err) {
    console.error("Error decoding topic:", err);
    return { value: hex };
  }
}

function eventContainsWalletAddress(
  event: MarketplaceEvent,
  walletAddress: string,
): boolean {
  try {
    const lowerWallet = walletAddress.toLowerCase();

    // Define which wallet field to check for each event type
    const eventWalletFieldMap: Record<string, string[]> = {
      NewBid: ["bidder"], // Only check bidder for NewBid, not auctionCreator
      CancelledListing: ["listingCreator"],
      NewListing: ["listingCreator"],
      NewSale: ["buyer", "listing_creator"],
      UpdatedListing: ["listingCreator"],
      AuctionClosed: ["auction_creator", "winning_bidder"],
      CancelledAuction: ["auctionCreator"],
      NewAuction: ["auctionCreator"],
      AcceptedOffer: ["offeror", "seller"],
      CancelledOffer: ["offeror"],
      NewOffer: ["offeror"],
    };

    // Get the wallet fields to check for this event type
    const walletFieldsToCheck = eventWalletFieldMap[event.event_name] || [
      "listingCreator",
      "listing_creator",
      "auctionCreator",
      "auction_creator",
      "closer",
      "bidder",
      "offeror",
      "seller",
      "buyer",
      "winningBidder",
      "winning_bidder",
    ];

    // Check if this is new format from marketplaceEvents table with decoded object
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (decoded && typeof decoded === "object") {
      // Check only relevant wallet fields for this event type
      for (const field of walletFieldsToCheck) {
        const value = (decoded as Record<string, any>)[field];
        if (value && typeof value === "string") {
          if (value.toLowerCase() === lowerWallet) {
            return true;
          }
        }
      }
    }

    // Fallback to old format with raw_log
    if (event.raw_log && event.raw_log.length > 0) {
      const logData =
        typeof event.raw_log === "string"
          ? JSON.parse(event.raw_log)
          : event.raw_log;
      if (!Array.isArray(logData?.topics)) return false;

      const indexedParams = EVENT_SIGNATURES[event.event_name] || [];

      for (let i = 0; i < logData.topics.length; i++) {
        if (i === 0) continue;

        const paramName = indexedParams[i - 1];
        if (!ADDRESS_PARAMS.has(paramName)) continue;

        // Check if this parameter is one we should check for this event type
        if (!walletFieldsToCheck.includes(paramName)) continue;

        const decodedTopic = decodeHexTopic(logData.topics[i], paramName);
        if (decodedTopic.decoded?.toLowerCase() === lowerWallet) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error("Error checking wallet in event:", err);
    return false;
  }
}

function CompactEventPill({
  event,
  onEmojiClick,
  selectedEmoji,
  buttonRef,
  emojiCounts,
  disableEmojiModal = false,
  serialData,
  hideDate = false,
}: {
  event: UnifiedEvent;
  onEmojiClick: () => void;
  selectedEmoji?: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
  emojiCounts?: Record<string, number>;
  disableEmojiModal?: boolean;
  serialData?: SerialData;
  hideDate?: boolean;
}) {
  const isDisabled = disableEmojiModal;
  const eventPrice =
    event._type === "marketplace"
      ? calculateEventPrice(event as MarketplaceEvent)
      : 0;

  // Handle RelicStaked events with special formatting
  const isRelicStaked = event.event_name === "RelicStaked";
  let relicStakedContent: React.ReactNode = null;
  if (isRelicStaked && event.decoded) {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;
    // Convert 18-digit integer (wei) to simple rounded integer
    const rmv = decoded.rolling_median_sale
      ? Math.round(parseFloat(decoded.rolling_median_sale) / 1e18)
      : 0;
    const rmvFormatted = rmv.toString();
    const playerName = decoded.PlayerName || "Unknown";
    const serial = decoded.serial || "?";
    const minted = decoded.Minted || "?";

    relicStakedContent = (
      <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex items-center gap-1">
        <span className="truncate flex items-center gap-1">
          <span style={{ fontSize: "12px", fontWeight: "bold" }}>
            {rmvFormatted}
          </span>
          <span style={{ fontSize: "12px" }}>{playerName}</span>
          <span style={{ fontSize: "12px" }}>
            #{serial} of {minted}
          </span>
        </span>
        {!hideDate && (
          <span className="text-slate-600 dark:text-slate-400 text-[12px] whitespace-nowrap flex-shrink-0">
            {event.emitted_at
              ? new Date(event.emitted_at).toLocaleDateString()
              : "—"}
          </span>
        )}
      </div>
    );
  }

  // Handle RelicRedeemed events with special formatting
  const isRelicRedeemed = event.event_name === "RelicRedeemed";
  let relicRedeemedContent: React.ReactNode = null;
  if (isRelicRedeemed && event.decoded) {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;
    // rmv_redeemed is already formatted as decimal in the database, just round it
    const rmv = decoded.rmv_redeemed
      ? Math.round(parseFloat(decoded.rmv_redeemed))
      : 0;
    const rmvFormatted = rmv.toString();
    const playerName = decoded.PlayerName || "Unknown";
    const serial = decoded.serial_redeemed || "?";
    const minted = decoded.minted || "?";

    relicRedeemedContent = (
      <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex items-center gap-1">
        <span className="truncate flex items-center gap-1">
          <span style={{ fontSize: "12px", fontWeight: "bold" }}>
            {rmvFormatted}
          </span>
          <span style={{ fontSize: "12px" }}>{playerName}</span>
          <span style={{ fontSize: "12px" }}>
            #{serial} of {minted}
          </span>
        </span>
        {!hideDate && (
          <span className="text-slate-600 dark:text-slate-400 text-[12px] whitespace-nowrap flex-shrink-0">
            {event.emitted_at
              ? new Date(event.emitted_at).toLocaleDateString()
              : "—"}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      onClick={onEmojiClick}
      disabled={isDisabled}
      className={`text-xs rounded px-1.5 border w-full text-left ${
        isDisabled
          ? "bg-white/20 dark:bg-slate-800/30 border-white/10 dark:border-white/5 cursor-default"
          : "bg-white/30 dark:bg-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/70 transition-colors border-white/20 dark:border-white/10 cursor-pointer"
      }`}
    >
      <div
        className="flex items-center justify-between gap-1.5"
        style={{ fontSize: "16px" }}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center justify-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap text-[9px] flex-shrink-0 flex-wrap justify-center">
            <span
              style={{ fontSize: "12px" }}
              className="font-normal sm:font-semibold"
            >
              {event.event_name}
            </span>
          </div>
          {event._type === "marketplace" &&
            ![
              "CancelledListing",
              "CancelledOffer",
              "CancelledAuction",
            ].includes(event.event_name) && (
              <span className="font-semibold whitespace-nowrap flex-shrink-0 text-slate-700 dark:text-slate-300">
                <div style={{ fontSize: "12px", display: "inline" }}>$</div>
                <div style={{ fontSize: "12px", display: "inline" }}>
                  {Math.floor(eventPrice / 1e18)}
                </div>
              </span>
            )}
          {isRelicStaked ? (
            relicStakedContent
          ) : isRelicRedeemed ? (
            relicRedeemedContent
          ) : serialData ? (
            <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex items-center gap-1">
              <span className="truncate">
                {serialData.name && (
                  <span style={{ fontSize: "12px" }}>{serialData.name}</span>
                )}
                {serialData.serial != null && (
                  <span className="truncate">
                    <div style={{ fontSize: "12px", display: "inline" }}>
                      {" "}
                      #
                    </div>
                    <div style={{ fontSize: "12px", display: "inline" }}>
                      {serialData.serial}
                    </div>
                    {serialData.minted != null && (
                      <div style={{ fontSize: "12px", display: "inline" }}>
                        {" "}
                        of {serialData.minted}
                      </div>
                    )}
                  </span>
                )}
              </span>
              {!hideDate && (
                <span className="text-slate-600 dark:text-slate-400 text-[12px] whitespace-nowrap flex-shrink-0">
                  {event.emitted_at
                    ? new Date(event.emitted_at).toLocaleDateString()
                    : "—"}
                </span>
              )}
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5 justify-end flex-shrink-0">
          <div className="flex items-center gap-1 ml-auto flex-shrink-0">
            {emojiCounts && Object.keys(emojiCounts).length > 0 && (
              <span className="flex items-center gap-0.5 text-sm leading-none flex-shrink-0">
                <span>😊</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {Object.values(emojiCounts).reduce((a, b) => a + b, 0)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

type UnifiedEvent = MarketplaceEvent & { _type?: string };

interface UserRecentEventsPillsProps {
  walletAddress: string | null | undefined;
  disableEmojiModal?: boolean;
}

export function UserRecentEventsPills({
  walletAddress,
  disableEmojiModal = false,
}: UserRecentEventsPillsProps) {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [allEvents, setAllEvents] = useState<UnifiedEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userEmojis, setUserEmojis] = useState<Record<string, string>>({});
  const [emojiCounts, setEmojiCounts] = useState<
    Record<string, Record<string, number>>
  >({});
  const [serialData, setSerialData] = useState<
    SerialCardMiniProps | undefined
  >();
  const [allSerialData, setAllSerialData] = useState<
    Record<string, SerialData>
  >({});
  const [enrichedEvent, setEnrichedEvent] = useState<
    MarketplaceEvent | undefined
  >();
  const eventRefsMap = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);

        // Fetch all three event types in parallel
        const [marketplaceEvents, stakingEvents, redemptionEvents] =
          await Promise.all([
            fetchMarketplaceEvents(ctrl.signal),
            walletAddress
              ? fetchStakingEventsForWallet(walletAddress, ctrl.signal)
              : Promise.resolve([]),
            walletAddress
              ? fetchRedemptionEventsForWallet(walletAddress, ctrl.signal)
              : Promise.resolve([]),
          ]);

        if (!ctrl.signal.aborted) {
          // Convert all events to unified format and merge
          const unifiedEvents: UnifiedEvent[] = [
            ...(Array.isArray(marketplaceEvents)
              ? marketplaceEvents.map((e) => ({ ...e, _type: "marketplace" }))
              : []),
            ...(Array.isArray(stakingEvents)
              ? stakingEvents.map((e) => {
                  // Use the database_id field from the staking event
                  const databaseEventId = (e as any).database_id || e.id;
                  return {
                    id: e.id,
                    _type: "staking",
                    event_name: "RelicStaked",
                    emitted_at: e.timestamp,
                    decoded: JSON.stringify({
                      staker: e.staker,
                      token_id: e.token_id,
                      edition_id: e.edition_id,
                      serial: e.serial,
                      PlayerName: e.PlayerName,
                      team: e.team,
                      rolling_median_sale: e.rolling_median_sale,
                      Minted: e.Minted,
                      timestamp: e.timestamp,
                      stakingExpiration: e.stakingExpiration,
                      username: e.username,
                      database_event_id: databaseEventId,
                    }),
                  } as UnifiedEvent;
                })
              : []),
            ...(Array.isArray(redemptionEvents)
              ? redemptionEvents.map((e) => {
                  // Use the database_id field from the redemption event
                  const databaseEventId = (e as any).database_id || e.id;
                  return {
                    id: e.id,
                    _type: "redemption",
                    event_name: "RelicRedeemed",
                    emitted_at: e.timestamp,
                    decoded: JSON.stringify({
                      wallet_address: e.wallet_address,
                      token_id: e.token_id,
                      edition_id_reward: e.edition_id_reward,
                      serial_redeemed: e.serial_redeemed,
                      minted: e.minted,
                      PlayerName: e.player_name,
                      rmv_redeemed: e.rmv_redeemed,
                      username: e.username,
                      team: e.team,
                      timestamp: e.timestamp,
                      database_event_id: databaseEventId,
                    }),
                  } as UnifiedEvent;
                })
              : []),
          ];

          // Sort by timestamp (most recent first)
          unifiedEvents.sort((a, b) => {
            const timeA = new Date(a.emitted_at || 0).getTime();
            const timeB = new Date(b.emitted_at || 0).getTime();
            return timeB - timeA;
          });

          setAllEvents(unifiedEvents);
        }
      } catch (err: any) {
        if (!ctrl.signal.aborted) {
          setAllEvents([]);
        }
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      try {
        ctrl.abort();
      } catch {
        // Silently ignore any errors during cleanup
      }
    };
  }, [walletAddress]);

  useEffect(() => {
    if (!walletAddress || allEvents.length === 0) {
      setFilteredEvents([]);
      return;
    }

    const filtered = allEvents.filter((event) => {
      // For non-marketplace events, check the _type field
      if (event._type === "staking") {
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;
        return decoded?.staker?.toLowerCase() === walletAddress.toLowerCase();
      }
      if (event._type === "redemption") {
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;
        return (
          decoded?.wallet_address?.toLowerCase() === walletAddress.toLowerCase()
        );
      }
      // For marketplace events
      return eventContainsWalletAddress(event, walletAddress);
    });
    // Limit to 5 most recent events
    const limited = filtered.slice(0, 5);
    setFilteredEvents(limited);

    // Load user's emoji reactions and emoji counts for these events
    if (account?.address) {
      let mounted = true;
      const ctrl = new AbortController();
      const loadEmojisAndCounts = async () => {
        try {
          if (ctrl.signal.aborted) return;

          const emojisMap: Record<string, string> = {};
          const countsMap: Record<string, Record<string, number>> = {};

          // When viewing a specific wallet, show all emoji aggregations for their events
          if (walletAddress) {
            const reactionsToWallet =
              await fetchEmojiReactionsForWallet(walletAddress);

            // Group reactions by event_id and count emojis
            for (const event of limited) {
              if (!mounted || ctrl.signal.aborted) break;

              // Load user's own emoji for this event
              const emoji = await fetchUserReactionForEvent(
                event.id,
                account.address,
              );
              if (emoji && mounted && !ctrl.signal.aborted) {
                emojisMap[event.id] = emoji;
              }

              // Get ALL emoji reactions for this event to show aggregations
              const allEventReactions = await fetchEmojiReactionsForEvent(
                event.id,
              );

              const counts: Record<string, number> = {};
              for (const reaction of allEventReactions) {
                counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
              }
              if (Object.keys(counts).length > 0) {
                countsMap[event.id] = counts;
              }
            }
          } else {
            // When no specific wallet provided, parallelize reactions for all events
            const emojiPromises = limited.map((event) =>
              Promise.all([
                fetchUserReactionForEvent(event.id, account.address),
                fetchEmojiReactionsForEvent(event.id),
              ])
                .then(([userEmoji, allReactions]) => ({
                  eventId: event.id,
                  userEmoji,
                  allReactions,
                }))
                .catch((err) => {
                  console.error(
                    `Error loading emojis for event ${event.id}:`,
                    err,
                  );
                  return { eventId: event.id, userEmoji: undefined, allReactions: [] };
                }),
            );

            const emojiResults = await Promise.all(emojiPromises);

            for (const result of emojiResults) {
              if (!mounted || ctrl.signal.aborted) break;

              if (result.userEmoji) {
                emojisMap[result.eventId] = result.userEmoji;
              }

              const counts: Record<string, number> = {};
              for (const reaction of result.allReactions) {
                counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
              }
              if (Object.keys(counts).length > 0) {
                countsMap[result.eventId] = counts;
              }
            }
          }

          if (mounted && !ctrl.signal.aborted) {
            setUserEmojis(emojisMap);
            setEmojiCounts(countsMap);
          }
        } catch (err) {
          if ((err as any)?.name !== "AbortError") {
            console.error("Error loading emojis and counts:", err);
          }
          if (mounted && !ctrl.signal.aborted) {
            setUserEmojis({});
            setEmojiCounts({});
          }
        }
      };
      loadEmojisAndCounts();
      return () => {
        mounted = false;
        try {
          ctrl.abort();
        } catch {
          // Silently ignore any errors during cleanup
        }
      };
    }
  }, [walletAddress, allEvents, account?.address]);

  useEffect(() => {
    if (!isModalOpen || !selectedEventId) {
      setSerialData(undefined);
      setEnrichedEvent(undefined);
      return;
    }

    const ctrl = new AbortController();
    let isMounted = true;

    const loadModalData = async () => {
      const selectedEvent = allEvents.find((e) => e.id === selectedEventId);
      if (!selectedEvent || !isMounted) return;

      try {
        // For staking/redemption events, get token_id directly from decoded data
        let tokenId: number | null = null;

        if (
          selectedEvent._type === "staking" ||
          selectedEvent._type === "redemption"
        ) {
          const decoded =
            typeof selectedEvent.decoded === "string"
              ? JSON.parse(selectedEvent.decoded)
              : selectedEvent.decoded;
          tokenId = decoded.token_id ? parseInt(decoded.token_id, 10) : null;
          // Pass the event to the modal so staking/redemption data can be displayed
          if (isMounted) {
            setEnrichedEvent(selectedEvent as any);
          }
        } else {
          // For marketplace events, use the existing resolution logic
          const enriched = await enrichEventWithDetails(selectedEvent);
          if (isMounted) {
            setEnrichedEvent(enriched);
          }
          tokenId = await resolveTokenIdFromEvent(selectedEvent);
        }

        // Fetch and display serial data
        if (tokenId && isMounted) {
          const serial = await fetchSerialData(tokenId);
          if (serial && isMounted) {
            setSerialData({
              id: serial.id,
              name: serial.name,
              thumb: serial.thumb,
              tier: serial.tier,
              serial: serial.serial,
              minted: serial.minted,
              gameDate: serial.gameDate,
              createDate: serial.createDate,
              setName: serial.setName,
              badge: serial.badge,
              badge2: serial.badge2,
              badge3: serial.badge3,
              team: serial.team,
            });
          }
        }
      } catch (err) {
        if (isMounted && (err as Error).name !== "AbortError") {
          console.error("Error loading modal data:", err);
        }
      }
    };

    loadModalData();

    return () => {
      isMounted = false;
      try {
        ctrl.abort();
      } catch {
        // Silently ignore any errors during cleanup
      }
    };
  }, [isModalOpen, selectedEventId, allEvents]);

  useEffect(() => {
    if (filteredEvents.length === 0) {
      setAllSerialData({});
      return;
    }

    const loadAllSerialData = async () => {
      const serialDataMap: Record<string, SerialData> = {};

      try {
        // Resolve token IDs for all events (using max_token_id from marketplace_events_with_relics)
        const tokenIdPromises = filteredEvents.map(async (event) => {
          try {
            return {
              eventId: event.id,
              tokenId: await resolveTokenIdFromEvent(event),
            };
          } catch (err) {
            console.error(
              `Error resolving token ID for event ${event.id}:`,
              err,
            );
            return { eventId: event.id, tokenId: null };
          }
        });

        const tokenResults = await Promise.all(tokenIdPromises);

        // Deduplicate token IDs to avoid fetching the same serial multiple times
        const tokenIdMap = new Map<number, string[]>();
        for (const result of tokenResults) {
          if (result.tokenId != null) {
            if (!tokenIdMap.has(result.tokenId)) {
              tokenIdMap.set(result.tokenId, []);
            }
            tokenIdMap.get(result.tokenId)!.push(result.eventId);
          }
        }

        // Parallelize serial data fetches for unique token IDs from RelicSerialsJoined
        const serialFetchPromises = Array.from(tokenIdMap.keys()).map(
          async (tokenId) => {
            try {
              return {
                tokenId,
                serial: await fetchSerialData(tokenId),
                eventIds: tokenIdMap.get(tokenId) || [],
              };
            } catch (err) {
              console.error(
                `Error fetching serial data for token ${tokenId}:`,
                err,
              );
              return {
                tokenId,
                serial: null,
                eventIds: tokenIdMap.get(tokenId) || [],
              };
            }
          },
        );

        const serialResults = await Promise.all(serialFetchPromises);

        // Build the map from results, applying to all events that share the token ID
        for (const result of serialResults) {
          if (result.serial) {
            for (const eventId of result.eventIds) {
              serialDataMap[eventId] = result.serial;
            }
          }
        }

        setAllSerialData(serialDataMap);
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("Error loading serial data:", err);
        }
        setAllSerialData({});
      }
    };

    loadAllSerialData();
  }, [filteredEvents]);

  const getEventRef = (eventId: string) => {
    if (!eventRefsMap.current[eventId]) {
      eventRefsMap.current[eventId] = { current: null };
    }
    return eventRefsMap.current[eventId];
  };

  const pollAllEmojiCounts = async (maxAttempts = 5) => {
    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Refresh emoji counts for all filtered events on the page
        const countsMap: Record<string, Record<string, number>> = {};

        if (walletAddress) {
          // If viewing a specific wallet, get all reactions for their events
          const reactionsToWallet =
            await fetchEmojiReactionsForWallet(walletAddress);

          // Group reactions by event_id and count emojis
          for (const event of filteredEvents) {
            const eventReactions = reactionsToWallet.filter(
              (r) => r.event_id === event.id,
            );

            const counts: Record<string, number> = {};
            for (const reaction of eventReactions) {
              counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
            }

            if (Object.keys(counts).length > 0) {
              countsMap[event.id] = counts;
            }
          }
        } else {
          // Parallelize fetches for all events instead of sequential awaits
          const reactionPromises = filteredEvents.map((event) =>
            fetchEmojiReactionsForEvent(event.id)
              .then((allReactions) => ({
                eventId: event.id,
                reactions: allReactions,
              }))
              .catch((err) => {
                console.error(`Error fetching reactions for event ${event.id}:`, err);
                return { eventId: event.id, reactions: [] };
              }),
          );

          const reactionResults = await Promise.all(reactionPromises);

          // Build counts map from parallel results
          for (const result of reactionResults) {
            const counts: Record<string, number> = {};
            for (const reaction of result.reactions) {
              counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
            }

            if (Object.keys(counts).length > 0) {
              countsMap[result.eventId] = counts;
            }
          }
        }

        // Update emoji counts for all events
        setEmojiCounts((prev) => ({
          ...prev,
          ...countsMap,
        }));

        // If we have any counts, we're done polling
        if (Object.keys(countsMap).length > 0) {
          return;
        }

        // Wait before retrying (1 second)
        if (attempt < maxAttempts - 1) {
          await delay(1000);
        }
      } catch (err) {
        console.error(`[Emoji Poll All] Error fetching counts (attempt ${attempt + 1}):`, err);
        if (attempt < maxAttempts - 1) {
          await delay(1000);
        }
      }
    }
  };

  const handleSelectEmoji = async (emoji: string) => {
    if (!selectedEventId || !account?.address || !walletAddress) return;

    try {
      const selectedEvent = allEvents.find((e) => e.id === selectedEventId);

      // For RelicStaked and RelicRedeemed events, use the database_event_id from the decoded data
      let emojiEventId = selectedEventId;
      if (
        selectedEvent &&
        (selectedEvent.event_name === "RelicStaked" ||
          selectedEvent.event_name === "RelicRedeemed")
      ) {
        try {
          const decoded =
            typeof selectedEvent.decoded === "string"
              ? JSON.parse(selectedEvent.decoded)
              : selectedEvent.decoded;
          if (decoded.database_event_id) {
            emojiEventId = decoded.database_event_id;
          }
        } catch (err) {
          console.error(
            "Error parsing event decoded data for emoji reaction:",
            err,
          );
        }
      }

      // If the selected emoji is already selected, delete it
      if (userEmojis[selectedEventId] === emoji) {
        await deleteEmojiReaction(emojiEventId, account.address);
        setUserEmojis((prev) => {
          const updated = { ...prev };
          delete updated[selectedEventId];
          return updated;
        });
      } else {
        // Save the new emoji - the database trigger will automatically set reactee_wallet_address
        // for AcceptedOffer events based on offeror/seller
        await saveEmojiReaction(emojiEventId, emoji, account.address);

        setUserEmojis((prev) => ({
          ...prev,
          [selectedEventId]: emoji,
        }));
      }

      // Close the modal
      setIsModalOpen(false);

      // Poll all event rows to refresh emoji counts
      await pollAllEmojiCounts();
    } catch (err) {
      console.error("Error handling emoji reaction:", err);
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400">
        Loading events...
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400">
        No recent events.
      </div>
    );
  }

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="flex-1 flex flex-col gap-2 min-h-0 overflow-hidden recent-events-pills-container">
          {filteredEvents.map((event, idx) => (
            <CompactEventPill
              key={`${event.id}-${idx}`}
              event={event}
              buttonRef={getEventRef(event.id)}
              onEmojiClick={() => {
                setSelectedEventId(event.id);
                setIsModalOpen(true);
              }}
              selectedEmoji={userEmojis[event.id]}
              emojiCounts={emojiCounts[event.id]}
              disableEmojiModal={disableEmojiModal}
              serialData={allSerialData[event.id]}
            />
          ))}
        </div>
      </div>

      {!disableEmojiModal && (
        <EmojiReactionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSelectEmoji={handleSelectEmoji}
          selectedEmoji={
            selectedEventId ? userEmojis[selectedEventId] : undefined
          }
          triggerRef={
            selectedEventId ? getEventRef(selectedEventId) : undefined
          }
          serialData={serialData}
          event={enrichedEvent}
          onNavigate={navigate}
          eventId={selectedEventId}
        />
      )}
    </>
  );
}
