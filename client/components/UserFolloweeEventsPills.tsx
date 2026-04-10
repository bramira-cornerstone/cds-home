import { useState, useEffect, useRef } from "react";

import { useNavigate } from "react-router-dom";
import {
  fetchMarketplaceEvents,
  type MarketplaceEvent,
} from "@/lib/marketplaceEvents";
import { fetchFollowees } from "@/lib/followeesService";
import {
  fetchFolloweeStakingAndRedemptionEvents,
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
import { getUsernameForWallet } from "@/lib/profiles";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";
import type { SerialCardMiniProps } from "@/components/SerialCardMini";
import { EmojiReactionModal } from "@/components/EmojiReactionModal";
import { toast } from "@/hooks/use-toast";

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

// Mapping of event_name to the field name that identifies the actor
const EVENT_ACTOR_FIELD: Record<string, string> = {
  CancelledListing: "listingCreator",
  NewListing: "listingCreator",
  NewSale: "listingCreator",
  UpdatedListing: "listingCreator",
  AuctionClosed: "closer",
  CancelledAuction: "auctionCreator",
  NewAuction: "auctionCreator",
  NewBid: "bidder",
  AcceptedOffer: "offeror",
  CancelledOffer: "offeror",
  NewOffer: "offeror",
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

function extractEventActorAddress(event: MarketplaceEvent): string | null {
  try {
    const actorField = EVENT_ACTOR_FIELD[event.event_name];
    if (!actorField) return null;

    if (event.decoded) {
      const decoded =
        typeof event.decoded === "string"
          ? JSON.parse(event.decoded)
          : event.decoded;

      const address = (decoded as Record<string, any>)[actorField];
      if (address && typeof address === "string") {
        return address;
      }
    }

    return null;
  } catch (err) {
    console.error("Error extracting event actor address:", err);
    return null;
  }
}

// Extract the counterparty address for multi-party events
function extractCounterpartyAddress(
  event: MarketplaceEvent,
  connectedAddress: string,
): string | null {
  try {
    const connectedLower = connectedAddress.toLowerCase();
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (!decoded || typeof decoded !== "object") return null;

    const eventName = event.event_name;

    // For NewSale: if listingCreator is connected user, return buyer
    if (eventName === "NewSale") {
      const listingCreator = (decoded as Record<string, any>)["listingCreator"];
      const buyer = (decoded as Record<string, any>)["buyer"];

      if (listingCreator && listingCreator.toLowerCase() === connectedLower) {
        return buyer || null;
      }
      if (buyer && buyer.toLowerCase() === connectedLower) {
        return listingCreator || null;
      }
    }

    // For AcceptedOffer: if offeror is connected user, return listingCreator (accepter)
    // If listingCreator is connected user, return offeror
    if (eventName === "AcceptedOffer") {
      const offeror = (decoded as Record<string, any>)["offeror"];
      const listingCreator = (decoded as Record<string, any>)["listingCreator"];

      if (offeror && offeror.toLowerCase() === connectedLower) {
        return listingCreator || null;
      }
      if (listingCreator && listingCreator.toLowerCase() === connectedLower) {
        return offeror || null;
      }
    }

    // For NewBid: if bidder is connected user, return auctionCreator
    // If auctionCreator is connected user, return bidder
    if (eventName === "NewBid") {
      const bidder = (decoded as Record<string, any>)["bidder"];
      const auctionCreator = (decoded as Record<string, any>)["auctionCreator"];

      if (bidder && bidder.toLowerCase() === connectedLower) {
        return auctionCreator || null;
      }
      if (auctionCreator && auctionCreator.toLowerCase() === connectedLower) {
        return bidder || null;
      }
    }

    // For AuctionClosed: if closer is connected user, return auctionCreator
    // If auctionCreator is connected user, return closer
    if (eventName === "AuctionClosed") {
      const closer = (decoded as Record<string, any>)["closer"];
      const auctionCreator = (decoded as Record<string, any>)["auctionCreator"];

      if (closer && closer.toLowerCase() === connectedLower) {
        return auctionCreator || null;
      }
      if (auctionCreator && auctionCreator.toLowerCase() === connectedLower) {
        return closer || null;
      }
    }

    return null;
  } catch (err) {
    console.error("Error extracting counterparty address:", err);
    return null;
  }
}

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

function eventContainsAddress(
  event: MarketplaceEvent,
  address: string,
): boolean {
  try {
    const lowerAddress = address.toLowerCase();

    // Check if this is new format from marketplaceEvents table with decoded object
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (decoded && typeof decoded === "object") {
      // Check all relevant wallet fields in the decoded data
      const walletFields = [
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

      for (const field of walletFields) {
        const value = (decoded as Record<string, any>)[field];
        if (value && typeof value === "string") {
          if (value.toLowerCase() === lowerAddress) {
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

        const decodedTopic = decodeHexTopic(logData.topics[i], paramName);
        if (decodedTopic.decoded?.toLowerCase() === lowerAddress) {
          return true;
        }
      }
    }

    return false;
  } catch (err) {
    console.error("Error checking address in event:", err);
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
  username,
  rankLevel,
}: {
  event: UnifiedEvent;
  onEmojiClick: () => void;
  selectedEmoji?: string;
  buttonRef: React.RefObject<HTMLButtonElement>;
  emojiCounts?: Record<string, number>;
  disableEmojiModal?: boolean;
  serialData?: SerialData;
  hideDate?: boolean;
  username?: string;
  rankLevel?: string;
}) {
  const isDisabled = disableEmojiModal;
  const navigate = useNavigate();
  const eventPrice =
    event._type === "marketplace"
      ? calculateEventPrice(event as MarketplaceEvent)
      : 0;

  // Use the resolved username directly (already resolved to counterparty if needed)
  const displayUsername = username;

  // Handle RelicStaked events with special formatting
  const isRelicStaked = event.event_name === "RelicStaked";
  let relicStakedDisplay: React.ReactNode = null;
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

    relicStakedDisplay = (
      <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex-1 flex items-center gap-1">
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>
          {rmvFormatted}
        </span>
        <span style={{ fontSize: "12px" }}>{playerName}</span>
        <span style={{ fontSize: "12px" }}>
          #{serial} of {minted}
        </span>
      </div>
    );
  }

  // Handle RelicRedeemed events with special formatting
  const isRelicRedeemed = event.event_name === "RelicRedeemed";
  let relicRedeemedDisplay: React.ReactNode = null;
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

    relicRedeemedDisplay = (
      <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex-1 flex items-center gap-1">
        <span style={{ fontSize: "12px", fontWeight: "bold" }}>
          {rmvFormatted}
        </span>
        <span style={{ fontSize: "12px" }}>{playerName}</span>
        <span style={{ fontSize: "12px" }}>
          #{serial} of {minted}
        </span>
      </div>
    );
  }

  const getRankBadgeImage = (rank: string): string | null => {
    switch (rank) {
      case "Diamond":
        return "/images/diamondbadge.png";
      case "Epic":
        return "/images/epicbadge.png";
      case "Rare":
        return "/images/rarebadge.png";
      case "Basic":
        return "/images/basicbadge.png";
      default:
        return null;
    }
  };

  const handleNavigateToCollection = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (displayUsername) {
      navigate(`/collection/${encodeURIComponent(displayUsername)}`);
    }
  };

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
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 flex-shrink-0">
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
              <span className="font-semibold whitespace-nowrap flex-shrink-0 text-[9px] text-slate-700 dark:text-slate-300">
                <div style={{ fontSize: "12px", display: "inline" }}>$</div>
                <div style={{ fontSize: "12px", display: "inline" }}>
                  {Math.floor(eventPrice / 1e18)}
                </div>
              </span>
            )}
        </div>
        {isRelicStaked
          ? relicStakedDisplay
          : isRelicRedeemed
            ? relicRedeemedDisplay
            : serialData && (
                <div className="text-[9px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex-1">
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
                </div>
              )}
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="flex items-center gap-1 flex-shrink-0">
            {emojiCounts && Object.keys(emojiCounts).length > 0 && (
              <span className="flex items-center gap-0.5 text-sm leading-none flex-shrink-0">
                <span>😊</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  {Object.values(emojiCounts).reduce((a, b) => a + b, 0)}
                </span>
              </span>
            )}
          </div>
          {!hideDate && (
            <span className="text-slate-600 dark:text-slate-400 text-[8px] whitespace-nowrap flex-shrink-0">
              {event.emitted_at
                ? new Date(event.emitted_at).toLocaleDateString()
                : "—"}
            </span>
          )}
          {displayUsername && (
            <>
              <span className="text-slate-600 dark:text-slate-400 text-[9px]">
                {" "}
              </span>
              <div
                onClick={handleNavigateToCollection}
                className="text-slate-600 dark:text-slate-400 text-[12px] truncate min-w-0 hover:text-slate-800 dark:hover:text-slate-200 hover:underline transition-colors cursor-pointer"
              >
                {displayUsername}
              </div>
              {rankLevel && getRankBadgeImage(rankLevel) && (
                <div
                  onClick={handleNavigateToCollection}
                  className="flex-shrink-0 hover:opacity-80 transition-opacity cursor-pointer"
                  role="button"
                  aria-label={`Navigate to ${displayUsername}'s collection`}
                >
                  <img
                    src={getRankBadgeImage(rankLevel)!}
                    alt={`${rankLevel} rank badge`}
                    className="w-4 h-4 rounded object-contain"
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </button>
  );
}

type UnifiedEvent = MarketplaceEvent & { _type?: string };

interface UserFolloweeEventsPillsProps {
  walletAddress: string | null | undefined;
  disableEmojiModal?: boolean;
}

export function UserFolloweeEventsPills({
  walletAddress,
  disableEmojiModal = false,
}: UserFolloweeEventsPillsProps) {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [marketplaceEvents, setMarketplaceEvents] = useState<UnifiedEvent[]>(
    [],
  );
  const [stakingRedemptionEvents, setStakingRedemptionEvents] = useState<
    UnifiedEvent[]
  >([]);
  const [filteredEvents, setFilteredEvents] = useState<UnifiedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [followeeAddresses, setFolloweeAddresses] = useState<string[]>([]);
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
  const [rmvData, setRmvData] = useState<RMVPerOwnerRecord[]>([]);
  const [eventActorData, setEventActorData] = useState<
    Record<string, { username?: string; rankLevel?: string }>
  >({});
  const eventRefsMap = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});

  // Merge all events
  const allEvents = [...marketplaceEvents, ...stakingRedemptionEvents];

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        setLoading(true);
        const fetchedEvents = await fetchMarketplaceEvents(ctrl.signal);
        if (!ctrl.signal.aborted) {
          const marketplaceWithType = Array.isArray(fetchedEvents)
            ? fetchedEvents.map((e) => ({ ...e, _type: "marketplace" }))
            : [];
          setMarketplaceEvents(marketplaceWithType);
        }
      } catch (err: any) {
        if (ctrl.signal.aborted) return;
        // silently ignore other errors
      } finally {
        if (!ctrl.signal.aborted) {
          setLoading(false);
        }
      }
    })();
    return () => {
      // Don't call abort() - the isMounted flag prevents state updates
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        // Fetch followees for the connected wallet, not the profile being viewed
        if (!account?.address) {
          if (isMounted) setFolloweeAddresses([]);
          return;
        }
        const followees = await fetchFollowees(account.address);
        if (isMounted) {
          setFolloweeAddresses(
            followees.map((f) => f.followeeAddress.toLowerCase()),
          );
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("Error loading followees:", err);
        }
        if (isMounted) {
          setFolloweeAddresses([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [account?.address]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const rmvRecords = await fetchRMVPerOwner();
        if (isMounted) {
          setRmvData(rmvRecords);
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
          console.error("Error loading RMV data:", err);
        }
        if (isMounted) {
          setRmvData([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    // Only load actor data for filtered events that we're actually displaying
    if (rmvData.length === 0 || filteredEvents.length === 0) {
      return;
    }

    const loadEventActorData = async () => {
      const actorData: Record<
        string,
        { username?: string; rankLevel?: string }
      > = {};

      for (const event of filteredEvents) {
        let displayAddress: string | null = null;

        // For staking events, extract staker address
        if (event._type === "staking") {
          const decoded =
            typeof event.decoded === "string"
              ? JSON.parse(event.decoded)
              : event.decoded;
          displayAddress = decoded?.staker || null;
        }
        // For redemption events, extract wallet_address
        else if (event._type === "redemption") {
          const decoded =
            typeof event.decoded === "string"
              ? JSON.parse(event.decoded)
              : event.decoded;
          displayAddress = decoded?.wallet_address || null;
        }
        // For marketplace events, use existing extraction logic
        else {
          displayAddress = extractEventActorAddress(event);

          // If the actor is the connected user and this is a multi-party event,
          // use the counterparty instead
          if (
            displayAddress &&
            account?.address &&
            displayAddress.toLowerCase() === account.address.toLowerCase()
          ) {
            const counterparty = extractCounterpartyAddress(
              event,
              account.address,
            );
            if (counterparty) {
              displayAddress = counterparty;
            } else {
              // If there's no counterparty to display, skip this event
              continue;
            }
          }
        }

        if (!displayAddress) continue;

        const rmvRecord = findRMVByOwner(rmvData, displayAddress);
        const rankLevel = calculateRankLevel(rmvRecord?.Percentile);
        const username = await getUsernameForWallet(displayAddress);

        actorData[event.id] = {
          username: username || undefined,
          rankLevel:
            rankLevel === "Beginner" || rankLevel === "Spectator"
              ? undefined
              : rankLevel,
        };
      }

      setEventActorData(actorData);
    };

    loadEventActorData();
  }, [rmvData, filteredEvents, account?.address]);

  // Fetch staking and redemption events for followees
  useEffect(() => {
    if (followeeAddresses.length === 0) {
      setStakingRedemptionEvents([]);
      return;
    }

    let isMounted = true;
    (async () => {
      try {
        const stakingAndRedemptionEvents =
          await fetchFolloweeStakingAndRedemptionEvents(followeeAddresses);

        if (isMounted) {
          // Transform staking and redemption events to unified format
          const unifiedEvents: UnifiedEvent[] = Array.isArray(
            stakingAndRedemptionEvents,
          )
            ? stakingAndRedemptionEvents.map((e) => {
                if (e.type === "staking") {
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
                } else {
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
                }
              })
            : [];

          setStakingRedemptionEvents(unifiedEvents);
        }
      } catch (err) {
        if ((err as any)?.name !== "AbortError") {
        }
        if (isMounted) {
          setStakingRedemptionEvents([]);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [followeeAddresses]);

  useEffect(() => {
    if (followeeAddresses.length === 0 || allEvents.length === 0) {
      setFilteredEvents([]);
      return;
    }

    const followeeSet = new Set(followeeAddresses);
    const filtered = allEvents.filter((event) => {
      // For staking/redemption events, check specific fields
      if (event._type === "staking") {
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;
        return followeeAddresses.some(
          (addr) => addr.toLowerCase() === decoded?.staker?.toLowerCase(),
        );
      }
      if (event._type === "redemption") {
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;
        return followeeAddresses.some(
          (addr) =>
            addr.toLowerCase() === decoded?.wallet_address?.toLowerCase(),
        );
      }
      // For marketplace events, check if the event's primary actor is a followee
      // Extract the actor address from the event
      const eventActor = extractEventActorAddress(event);
      if (eventActor) {
        return followeeAddresses.some(
          (addr) => addr.toLowerCase() === eventActor.toLowerCase(),
        );
      }
      return false;
    });

    // Sort by timestamp (most recent first) and limit to 5 most recent events
    const sorted = filtered.sort((a, b) => {
      const timeA = new Date(a.emitted_at || 0).getTime();
      const timeB = new Date(b.emitted_at || 0).getTime();
      return timeB - timeA;
    });
    const limited = sorted.slice(0, 5);
    setFilteredEvents(limited);

    // Load user's emoji reactions and emoji counts for these events
    if (account?.address) {
      const loadEmojisAndCounts = async () => {
        const emojisMap: Record<string, string> = {};
        const countsMap: Record<string, Record<string, number>> = {};

        for (const event of limited) {
          // Load user's emoji
          const emoji = await fetchUserReactionForEvent(
            event.id,
            account.address,
          );
          if (emoji) {
            emojisMap[event.id] = emoji;
          }

          // Load all emoji reactions and count them
          const allReactions = await fetchEmojiReactionsForEvent(event.id);
          const counts: Record<string, number> = {};
          for (const reaction of allReactions) {
            counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
          }
          if (Object.keys(counts).length > 0) {
            countsMap[event.id] = counts;
          }
        }

        setUserEmojis(emojisMap);
        setEmojiCounts(countsMap);
      };
      loadEmojisAndCounts();
    }
  }, [
    followeeAddresses,
    marketplaceEvents,
    stakingRedemptionEvents,
    account?.address,
  ]);

  useEffect(() => {
    if (!isModalOpen || !selectedEventId) {
      setSerialData(undefined);
      setEnrichedEvent(undefined);
      return;
    }

    const loadModalData = async () => {
      const selectedEvent = allEvents.find((e) => e.id === selectedEventId);
      if (!selectedEvent) return;

      try {
        // For staking/redemption events, pass the event directly to the modal
        if (
          selectedEvent._type === "staking" ||
          selectedEvent._type === "redemption"
        ) {
          setEnrichedEvent(selectedEvent as any);
        } else {
          // Enrich marketplace events with listing/auction/offer details
          const enriched = await enrichEventWithDetails(selectedEvent);
          setEnrichedEvent(enriched);
        }

        // Always fetch full serial data from RelicSerialsJoined using max_token_id
        const tokenId = await resolveTokenIdFromEvent(selectedEvent);
        if (tokenId) {
          const serial = await fetchSerialData(tokenId);
          if (serial) {
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
        console.error("Error loading modal data:", err);
      }
    };

    loadModalData();
  }, [
    isModalOpen,
    selectedEventId,
    marketplaceEvents,
    stakingRedemptionEvents,
  ]);

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
        // Otherwise, save the new emoji
        // wallet_address = event owner (who should receive the notification)
        // reactee_wallet_address = the person initiating the reaction
        await saveEmojiReaction(
          emojiEventId,
          emoji,
          account.address,
          walletAddress,
        );

        // Show toast notification only if the logged-in user is the event owner
        // Determine the event owner address from the event itself
        let eventOwnerAddress: string | null = null;

        if (selectedEvent?._type === "staking") {
          const decoded =
            typeof selectedEvent.decoded === "string"
              ? JSON.parse(selectedEvent.decoded)
              : selectedEvent.decoded;
          eventOwnerAddress = decoded?.staker || null;
        } else if (selectedEvent?._type === "redemption") {
          const decoded =
            typeof selectedEvent.decoded === "string"
              ? JSON.parse(selectedEvent.decoded)
              : selectedEvent.decoded;
          eventOwnerAddress = decoded?.wallet_address || null;
        } else if (selectedEvent) {
          // For marketplace events
          eventOwnerAddress = extractEventActorAddress(selectedEvent);
        }

        // Only show toast if the logged-in user is the event owner
        if (
          selectedEvent &&
          eventOwnerAddress &&
          account?.address &&
          eventOwnerAddress.toLowerCase() === account.address.toLowerCase()
        ) {
          try {
            const reactorUsername = await getUsernameForWallet(account.address);
            const displayName = reactorUsername
              ? reactorUsername
              : `${account.address.slice(0, 6)}...${account.address.slice(-4)}`;
            toast({
              title: `${emoji} New reaction to your ${selectedEvent.event_name}`,
              description: `${displayName} reacted with ${emoji}`,
            });
          } catch (err) {
            console.error("Error showing reaction notification:", err);
          }
        }

        setUserEmojis((prev) => ({
          ...prev,
          [selectedEventId]: emoji,
        }));
      }

      // Refresh the emoji counts for this event
      const allReactions = await fetchEmojiReactionsForEvent(selectedEventId);
      const counts: Record<string, number> = {};
      for (const reaction of allReactions) {
        counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
      }
      setEmojiCounts((prev) => ({
        ...prev,
        [selectedEventId]: counts,
      }));
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

  if (followeeAddresses.length === 0) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400">
        You are not following anyone yet.
      </div>
    );
  }

  if (filteredEvents.length === 0) {
    return (
      <div className="text-xs text-slate-600 dark:text-slate-400">
        No recent events from friends.
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
              hideDate={true}
              username={eventActorData[event.id]?.username}
              rankLevel={eventActorData[event.id]?.rankLevel}
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
