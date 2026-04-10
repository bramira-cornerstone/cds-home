import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Bookmark } from "lucide-react";
import {
  fetchMarketplaceEventsByEditionId,
  type MarketplaceEvent,
  resolveTokenIdFromEvent,
  fetchSerialData,
  type SerialData,
} from "@/lib/marketplaceEvents";
import {
  fetchStakingAndRedemptionEventsByEditionId,
  type CollectionEvent,
} from "@/lib/stakingAndRedemptionEvents";
import { FilterStyleButton as FilterButton } from "@/components/ui/filter-style-button";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";
import { getRankLevelBadgeImage } from "@/lib/teamRmvChartData";
import { EmojiReactionModal } from "./EmojiReactionModal";
import {
  saveEmojiReaction,
  deleteEmojiReaction,
  fetchUserReactionForEvent,
  fetchEmojiReactionsForEvent,
} from "@/lib/emojiReactions";
import { useActiveAccount } from "thirdweb/react";

interface EditionEventsChartProps {
  editionId: number | null;
  className?: string;
  playerName?: string | null;
  setName?: string | null;
  minted?: string | number | null;
  gameDate?: string | null;
  onHasContent?: (hasContent: boolean) => void;
}

interface EventInitiator {
  username: string;
  rankLevel?: string;
}

const EVENT_COLORS: Record<string, string> = {
  NewListing: "#FF6300",
  NewAuction: "#FBBF24",
  NewOffer: "#004FFF",
  NewBid: "#8B5CF6",
  NewSale: "#10B981",
  RelicStaked: "#06B6D4",
  RelicRedeemed: "#F59E0B",
};

const getEventColor = (eventName: string): string => {
  if (eventName.includes("Cancelled")) {
    return "#9CA3AF";
  }
  return EVENT_COLORS[eventName] || "#6366f1";
};

const calculateEventPrice = (event: any): number => {
  try {
    const decoded =
      typeof event.decoded === "string"
        ? JSON.parse(event.decoded)
        : event.decoded;

    if (!decoded) return 0;

    const eventName = event.event_name || "";

    // Handle RelicStaked: convert rolling_median_sale from 18 decimals to rounded integer
    if (eventName === "RelicStaked") {
      if (decoded.rolling_median_sale) {
        const rmv = Math.round(parseFloat(decoded.rolling_median_sale) / 1e18);
        // Return as wei-equivalent for consistent chart formatting
        return rmv * 1e18;
      }
      return 0;
    }

    // Handle RelicRedeemed: use rmv_redeemed (already formatted as decimal)
    if (eventName === "RelicRedeemed") {
      if (decoded.rmv_redeemed) {
        const rmv = Math.round(parseFloat(decoded.rmv_redeemed));
        // Return as wei-equivalent for consistent chart formatting
        return rmv * 1e18;
      }
      return 0;
    }

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

interface ScatterDotProps {
  cx: number;
  cy: number;
  fill: string;
  payload?: any;
  selectedId?: string | null;
  selectedLegendItem?: string | null;
}

const ScatterDot = ({
  cx,
  cy,
  fill,
  payload,
  selectedId,
  selectedLegendItem,
}: ScatterDotProps) => {
  const isSelected = selectedId && payload?.id === selectedId;
  const radius = 4;
  const borderWidth = isSelected ? 2 : 0;

  // Calculate opacity based on legend filter
  const eventName = payload?.event_name;
  const isDimmed =
    selectedLegendItem && eventName && eventName !== selectedLegendItem;
  const opacity = isDimmed ? 0.2 : 0.8;

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius} fill={fill} opacity={opacity} />
      {isSelected && (
        <circle
          cx={cx}
          cy={cy}
          r={radius + borderWidth + 1}
          fill="none"
          stroke="#000000"
          strokeWidth={borderWidth}
        />
      )}
    </g>
  );
};

export default function EditionEventsChart({
  editionId,
  className = "",
  playerName,
  setName,
  minted,
  gameDate,
  onHasContent,
}: EditionEventsChartProps) {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [marketplaceEvents, setMarketplaceEvents] = useState<
    MarketplaceEvent[]
  >([]);
  const [stakingRedemptionEvents, setStakingRedemptionEvents] = useState<
    CollectionEvent[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [serialDataMap, setSerialDataMap] = useState<
    Record<string, SerialData>
  >({});
  const [userEmojisMarketplace, setUserEmojisMarketplace] = useState<
    Record<string, string>
  >({});
  const [emojiCounts, setEmojiCounts] = useState<
    Record<string, Record<string, number>>
  >({});
  const [selectedMarketplaceEventId, setSelectedMarketplaceEventId] = useState<
    string | null
  >(null);
  const [isMarketplaceModalOpen, setIsMarketplaceModalOpen] = useState(false);
  const [eventInitiators, setEventInitiators] = useState<
    Record<string, EventInitiator>
  >({});
  const [rmvData, setRmvData] = useState<RMVPerOwnerRecord[]>([]);
  const eventRefsMap = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});
  const [selectedLegendItem, setSelectedLegendItem] = useState<string | null>(
    null,
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [marketplaceEventPageOffset, setMarketplaceEventPageOffset] =
    useState(0);
  const [marketplaceEventSwipeDirection, setMarketplaceEventSwipeDirection] =
    useState<"up" | "down" | null>(null);
  const marketplaceEventsTouchStartY = useRef<number | null>(null);
  const EVENTS_PER_PAGE = 10;
  const chartContainerTouchStartX = useRef<number | null>(null);

  useEffect(() => {
    const loadRMVData = async () => {
      try {
        const rmv = await fetchRMVPerOwner();
        setRmvData(rmv);
      } catch (err) {
        setRmvData([]);
      }
    };

    loadRMVData();
  }, []);

  useEffect(() => {
    if (!editionId) {
      setMarketplaceEvents([]);
      setStakingRedemptionEvents([]);
      return;
    }

    setLoading(true);
    const controller = new AbortController();
    let isMounted = true;

    Promise.all([
      fetchMarketplaceEventsByEditionId(editionId, controller.signal),
      fetchStakingAndRedemptionEventsByEditionId(editionId, controller.signal),
    ])
      .then(([marketplaceData, stakingRedemptionData]) => {
        if (!isMounted) return;
        setMarketplaceEvents(marketplaceData);
        setStakingRedemptionEvents(stakingRedemptionData);
      })
      .catch((err) => {
        if (!isMounted) return;
        // Silently ignore AbortError when component unmounts
        if (err?.name !== "AbortError") {
        }
        setMarketplaceEvents([]);
        setStakingRedemptionEvents([]);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      try {
        controller.abort();
      } catch {
        // Silently ignore any errors from abort
      }
    };
  }, [editionId]);

  useEffect(() => {
    if (
      marketplaceEvents.length === 0 &&
      stakingRedemptionEvents.length === 0
    ) {
      setSerialDataMap({});
      return;
    }

    const loadSerialData = async () => {
      const dataMap: Record<string, SerialData> = {};

      try {
        // Combine marketplace and staking/redemption events for serial data loading
        const allEvents = [
          ...marketplaceEvents,
          ...stakingRedemptionEvents.map((e) => ({
            ...e,
            event_name: e.type === "staking" ? "RelicStaked" : "RelicRedeemed",
            emitted_at: e.timestamp,
            decoded: JSON.stringify(
              e.type === "staking"
                ? {
                    token_id: e.token_id,
                    rolling_median_sale: e.rolling_median_sale,
                  }
                : {
                    token_id: e.token_id,
                    rmv_redeemed: e.rmv_redeemed,
                  },
            ),
          })),
        ];

        const tokenIdPromises = allEvents.map(async (event) => {
          try {
            return {
              eventId: event.id,
              tokenId: await resolveTokenIdFromEvent(event as any),
            };
          } catch {
            return { eventId: event.id, tokenId: null };
          }
        });

        const tokenResults = await Promise.all(tokenIdPromises);

        const tokenIdMap = new Map<number, string[]>();
        for (const result of tokenResults) {
          if (result.tokenId != null) {
            if (!tokenIdMap.has(result.tokenId)) {
              tokenIdMap.set(result.tokenId, []);
            }
            tokenIdMap.get(result.tokenId)!.push(result.eventId);
          }
        }

        const serialFetchPromises = Array.from(tokenIdMap.keys()).map(
          async (tokenId) => {
            try {
              return {
                tokenId,
                serial: await fetchSerialData(tokenId),
                eventIds: tokenIdMap.get(tokenId) || [],
              };
            } catch {
              return {
                tokenId,
                serial: null,
                eventIds: tokenIdMap.get(tokenId) || [],
              };
            }
          },
        );

        const serialResults = await Promise.all(serialFetchPromises);

        for (const result of serialResults) {
          if (result.serial) {
            for (const eventId of result.eventIds) {
              dataMap[eventId] = result.serial;
            }
          }
        }

        setSerialDataMap(dataMap);
      } catch (err) {
        console.error("Error loading serial data for marketplace events:", err);
        setSerialDataMap({});
      }
    };

    loadSerialData();
  }, [marketplaceEvents, stakingRedemptionEvents]);

  useEffect(() => {
    if (
      marketplaceEvents.length === 0 &&
      stakingRedemptionEvents.length === 0
    ) {
      setUserEmojisMarketplace({});
      setEmojiCounts({});
      return;
    }

    let isMounted = true;

    const loadEmojisAndCounts = async () => {
      const emojisMap: Record<string, string> = {};
      const countsMap: Record<string, Record<string, number>> = {};

      try {
        // Load emojis for both marketplace and staking/redemption events
        const allEvents = [...marketplaceEvents, ...stakingRedemptionEvents];
        for (const event of allEvents) {
          if (!isMounted) return;

          if (account?.address) {
            const emoji = await fetchUserReactionForEvent(
              event.id,
              account.address,
            );
            if (!isMounted) return;

            if (emoji) {
              emojisMap[event.id] = emoji;
            }
          }

          const allReactions = await fetchEmojiReactionsForEvent(event.id);
          if (!isMounted) return;

          const counts: Record<string, number> = {};
          for (const reaction of allReactions) {
            counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
          }
          if (Object.keys(counts).length > 0) {
            countsMap[event.id] = counts;
          }
        }

        if (isMounted) {
          setUserEmojisMarketplace(emojisMap);
          setEmojiCounts(countsMap);
        }
      } catch (err) {
        if (!isMounted) return;
        console.error("Error loading emojis for marketplace events:", err);
        setUserEmojisMarketplace({});
        setEmojiCounts({});
      }
    };

    loadEmojisAndCounts();

    return () => {
      isMounted = false;
    };
  }, [marketplaceEvents, stakingRedemptionEvents, account?.address]);

  useEffect(() => {
    if (
      marketplaceEvents.length === 0 &&
      stakingRedemptionEvents.length === 0
    ) {
      setEventInitiators({});
      return;
    }

    const loadEventInitiators = async () => {
      const initiatorsMap: Record<string, EventInitiator> = {};

      try {
        // Process marketplace events
        for (const event of marketplaceEvents) {
          try {
            const decoded =
              typeof event.decoded === "string"
                ? JSON.parse(event.decoded)
                : event.decoded;

            // Extract username based on event type
            let username = "";
            let walletAddress = "";

            if (
              event.event_name === "NewListing" ||
              event.event_name === "CancelledListing" ||
              event.event_name === "UpdatedListing"
            ) {
              username =
                decoded?.listing_creator_username ||
                decoded?.listingCreatorUsername ||
                "";
              walletAddress =
                decoded?.listing_creator || decoded?.listingCreator || "";
            } else if (
              event.event_name === "NewAuction" ||
              event.event_name === "CancelledAuction"
            ) {
              username =
                decoded?.auction_creator_username ||
                decoded?.auctionCreatorUsername ||
                "";
              walletAddress =
                decoded?.auction_creator || decoded?.auctionCreator || "";
            } else if (event.event_name === "NewBid") {
              username =
                decoded?.bidder_username || decoded?.bidderUsername || "";
              walletAddress = decoded?.bidder || "";
            } else if (
              event.event_name === "NewOffer" ||
              event.event_name === "CancelledOffer"
            ) {
              username =
                decoded?.offeror_username || decoded?.offerorUsername || "";
              walletAddress = decoded?.offeror || "";
            } else if (event.event_name === "NewSale") {
              username =
                decoded?.buyer_username || decoded?.buyerUsername || "";
              walletAddress = decoded?.buyer || "";
            } else if (event.event_name === "AcceptedOffer") {
              username =
                decoded?.seller_username || decoded?.sellerUsername || "";
              walletAddress = decoded?.seller || "";
            } else if (event.event_name === "AuctionClosed") {
              username =
                decoded?.winning_bidder_username ||
                decoded?.winningBidderUsername ||
                "";
              walletAddress =
                decoded?.winning_bidder || decoded?.winningBidder || "";
            }

            if (!username && walletAddress) {
              username =
                walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
            }

            // Calculate rank level if wallet address is available
            let rankLevel: string | undefined;
            if (walletAddress && rmvData.length > 0) {
              const rmvRecord = findRMVByOwner(rmvData, walletAddress);
              if (rmvRecord) {
                rankLevel = calculateRankLevel(rmvRecord.Percentile);
              }
            }

            initiatorsMap[event.id] = {
              username: username || "Unknown",
              rankLevel,
            };
          } catch (err) {
            console.error(`Error processing event ${event.id}:`, err);
            initiatorsMap[event.id] = { username: "Unknown" };
          }
        }

        // Process staking/redemption events
        for (const event of stakingRedemptionEvents) {
          try {
            let username = "";
            let walletAddress = "";

            if (event.type === "staking") {
              username = event.username || "";
              walletAddress = event.staker || "";
            } else {
              username = event.username || "";
              walletAddress = event.wallet_address || "";
            }

            if (!username && walletAddress) {
              username =
                walletAddress.slice(0, 6) + "..." + walletAddress.slice(-4);
            }

            // Calculate rank level if wallet address is available
            let rankLevel: string | undefined;
            if (walletAddress && rmvData.length > 0) {
              const rmvRecord = findRMVByOwner(rmvData, walletAddress);
              if (rmvRecord) {
                rankLevel = calculateRankLevel(rmvRecord.Percentile);
              }
            }

            initiatorsMap[event.id] = {
              username: username || "Unknown",
              rankLevel,
            };
          } catch (err) {
            console.error(
              `Error processing staking/redemption event ${event.id}:`,
              err,
            );
            initiatorsMap[event.id] = { username: "Unknown" };
          }
        }

        setEventInitiators(initiatorsMap);
      } catch (err) {
        console.error("Error loading event initiators:", err);
        setEventInitiators({});
      }
    };

    loadEventInitiators();
  }, [marketplaceEvents, stakingRedemptionEvents, rmvData]);

  const allChartData = useMemo(() => {
    // Transform marketplace events
    const transformedMarketplaceEvents = marketplaceEvents.map((event) => ({
      ...event,
      priceNum: calculateEventPrice(event),
      emittedTime: new Date(event.emitted_at).getTime(),
    }));

    // Transform staking/redemption events to match marketplace event format
    const transformedStakingRedemption = stakingRedemptionEvents.map(
      (event) => {
        let eventName = "";
        let decodedData: any = {};
        let databaseEventId = "";

        if (event.type === "staking") {
          eventName = "RelicStaked";
          // Use the database_id field from the staking event
          databaseEventId = (event as any).database_id || event.id;
          decodedData = {
            staker: event.staker,
            token_id: event.token_id,
            edition_id: event.edition_id,
            serial: event.serial,
            PlayerName: event.PlayerName,
            team: event.team,
            rolling_median_sale: event.rolling_median_sale,
            Minted: event.Minted,
            timestamp: event.timestamp,
            stakingExpiration: event.stakingExpiration,
            username: event.username,
            database_event_id: databaseEventId,
          };
        } else {
          eventName = "RelicRedeemed";
          // Use the database_id field from the redemption event
          databaseEventId = (event as any).database_id || event.id;
          decodedData = {
            wallet_address: event.wallet_address,
            token_id: event.token_id,
            edition_id_reward: event.edition_id_reward,
            serial_redeemed: event.serial_redeemed,
            minted: event.minted,
            PlayerName: event.player_name,
            rmv_redeemed: event.rmv_redeemed,
            username: event.username,
            team: event.team,
            timestamp: event.timestamp,
            database_event_id: databaseEventId,
          };
        }

        const unifiedEvent = {
          id: event.id,
          event_name: eventName,
          emitted_at: event.timestamp,
          decoded: JSON.stringify(decodedData),
        };

        return {
          ...unifiedEvent,
          priceNum: calculateEventPrice(unifiedEvent),
          emittedTime: new Date(event.timestamp).getTime(),
        };
      },
    );

    // Merge and sort by emitted time (most recent first)
    const allEvents = [
      ...transformedMarketplaceEvents,
      ...transformedStakingRedemption,
    ];
    allEvents.sort((a, b) => b.emittedTime - a.emittedTime);
    return allEvents;
  }, [marketplaceEvents, stakingRedemptionEvents]);

  const chartData = useMemo(() => {
    return allChartData;
  }, [allChartData]);

  // Notify parent of content availability
  useEffect(() => {
    if (allChartData.length === 0) {
      onHasContent?.(false);
    } else {
      onHasContent?.(true);
    }
  }, [allChartData.length, onHasContent]);

  const timeRange = useMemo(() => {
    if (chartData.length === 0) {
      return {
        min: 0,
        max: 0,
        format: "",
        minBuffered: 0,
        maxBuffered: 0,
        ticks: [],
      };
    }

    const times = chartData.map((d) => d.emittedTime);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const diffMs = max - min;

    // Determine format based on time range
    let format = "MMM dd, yyyy";
    if (diffMs < 24 * 60 * 60 * 1000) {
      // Less than 1 day
      format = "HH:mm:ss";
    } else if (diffMs < 30 * 24 * 60 * 60 * 1000) {
      // Less than 30 days
      format = "MMM dd";
    }

    // Add 5% buffer to each side
    const buffer = diffMs * 0.05;
    const minBuffered = min - buffer;
    const maxBuffered = max + buffer;

    // Generate uniform ticks within buffered range, with deduplication
    const tickCount = 6;
    const range = maxBuffered - minBuffered;
    const tickSet = new Set<number>();
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      const value = minBuffered + range * (i / (tickCount - 1));
      // Round to nearest integer to avoid floating-point precision issues
      const roundedValue = Math.round(value);
      if (!tickSet.has(roundedValue)) {
        tickSet.add(roundedValue);
        ticks.push(roundedValue);
      }
    }

    // Extend domain slightly beyond ticks to provide breathing room
    const domainBuffer = range * 0.05;
    return {
      min,
      max,
      format,
      minBuffered: minBuffered - domainBuffer,
      maxBuffered: maxBuffered + domainBuffer,
      ticks,
    };
  }, [chartData]);

  const priceRange = useMemo(() => {
    if (chartData.length === 0) {
      return { min: 0, max: 0, minBuffered: 0, maxBuffered: 0, ticks: [] };
    }

    const prices = chartData.map((d) => d.priceNum);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const diff = max - min;

    // Always keep minimum at 0, add 5% buffer to max (or minimum 10 if range is small)
    const buffer = diff === 0 ? 10 : Math.max(diff * 0.05, 10);
    const minBuffered = 0;
    const maxBuffered = max + buffer;

    // Generate uniform ticks with rounding to avoid floating-point precision issues, with deduplication
    const tickCount = 6;
    const range = maxBuffered - minBuffered;
    const tickSet = new Set<number>();
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      const value = minBuffered + range * (i / (tickCount - 1));
      // Round to 2 decimal places to avoid floating-point precision issues
      const roundedValue = Math.round(value * 100) / 100;
      if (!tickSet.has(roundedValue)) {
        tickSet.add(roundedValue);
        ticks.push(roundedValue);
      }
    }

    // Extend domain slightly beyond ticks to provide breathing room
    const domainBuffer = range * 0.05;
    return {
      min,
      max,
      minBuffered,
      maxBuffered: maxBuffered + domainBuffer,
      ticks,
    };
  }, [chartData]);

  const handleScatterClick = (dataPoint: any) => {
    if (!dataPoint || !dataPoint.id) return;

    console.log("Scatter point clicked, event ID:", dataPoint.id);
    setSelectedMarketplaceEventId(dataPoint.id);
    setIsMarketplaceModalOpen(true);
  };

  const getTimeLabel = (timestamp: number): string => {
    const date = new Date(timestamp);

    if (timeRange.format === "HH:mm:ss") {
      return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } else if (timeRange.format === "MMM dd") {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Loading chart...
        </div>
      </div>
    );
  }

  if (allChartData.length === 0) {
    return null;
  }

  const uniqueEvents = Array.from(new Set(chartData.map((d) => d.event_name)));

  const selectedEvent = selectedMarketplaceEventId
    ? allChartData.find((e) => e.id === selectedMarketplaceEventId)
    : null;

  const handleSelectEmojiMarketplace = async (
    emoji: string,
    eventId: string,
  ) => {
    if (!account?.address) return;

    // Get the event from allChartData to check if it's a RelicStaked or RelicRedeemed event
    const event = allChartData.find((e) => e.id === eventId);

    // For RelicStaked and RelicRedeemed events, use the database_event_id from the decoded data
    let emojiEventId = eventId;
    if (
      event &&
      (event.event_name === "RelicStaked" ||
        event.event_name === "RelicRedeemed")
    ) {
      try {
        const decoded =
          typeof event.decoded === "string"
            ? JSON.parse(event.decoded)
            : event.decoded;
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

    const isRemoving = userEmojisMarketplace[eventId] === emoji;

    if (isRemoving) {
      await deleteEmojiReaction(emojiEventId, account.address);
      setUserEmojisMarketplace((prev) => {
        const updated = { ...prev };
        delete updated[eventId];
        return updated;
      });
    } else {
      await saveEmojiReaction(emojiEventId, emoji, account.address);
      setUserEmojisMarketplace((prev) => ({
        ...prev,
        [eventId]: emoji,
      }));
    }

    // Refetch emoji counts for this event to get updated count
    try {
      const allReactions = await fetchEmojiReactionsForEvent(eventId);
      const counts: Record<string, number> = {};
      for (const reaction of allReactions) {
        counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
      }

      setEmojiCounts((prev) => {
        if (Object.keys(counts).length > 0) {
          return {
            ...prev,
            [eventId]: counts,
          };
        } else {
          const updated = { ...prev };
          delete updated[eventId];
          return updated;
        }
      });
    } catch (err) {
      console.error("Error refetching emoji counts for event:", err);
    }
  };

  const getEventRef = (eventId: string) => {
    if (!eventRefsMap.current[eventId]) {
      eventRefsMap.current[eventId] = { current: null };
    }
    return eventRefsMap.current[eventId];
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col"
        style={{ padding: "12px 8px 0" }}
      >
        <div className="flex items-center justify-between mb-1 px-0">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-white">
            Edition Events Timeline
          </h3>
          <FilterButton
            editionId={editionId || undefined}
            playerName={playerName}
            setName={setName}
            minted={minted}
            gameDate={gameDate}
            className="px-3 py-1.5 text-sm flex items-center justify-center"
            aria-label="Bookmark"
            type="button"
          >
            <Bookmark className="h-4 w-4" />
          </FilterButton>
        </div>
        <div
          ref={scrollContainerRef}
          className="w-full overflow-x-auto overflow-y-hidden"
          style={{
            scrollbarWidth: "thin",
            scrollbarGutter: "stable",
          }}
          onClick={() => {
            setSelectedLegendItem(null);
          }}
          onTouchStart={(e) => {
            chartContainerTouchStartX.current = e.touches[0].clientX;
          }}
          onTouchEnd={(e) => {
            if (chartContainerTouchStartX.current === null) return;
            const endX = e.changedTouches[0].clientX;
            const delta = chartContainerTouchStartX.current - endX;
            const threshold = 50;

            if (scrollContainerRef.current && Math.abs(delta) > threshold) {
              scrollContainerRef.current.scrollLeft += delta > 0 ? 200 : -200;
            }

            chartContainerTouchStartX.current = null;
          }}
        >
          <div style={{ display: "inline-block", minWidth: "100%" }}>
            <ResponsiveContainer width="100%" height={350}>
              <ScatterChart
                margin={{ top: 2, right: 2, bottom: 8, left: 15 }}
                data={chartData}
                style={{ padding: "4px 4px 0 0" }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e2e8f0"
                  horizontal={true}
                  vertical={true}
                />
                <XAxis
                  type="number"
                  dataKey="emittedTime"
                  name="Time"
                  domain={[timeRange.minBuffered, timeRange.maxBuffered]}
                  ticks={timeRange.ticks}
                  tickFormatter={getTimeLabel}
                  tick={{ fontSize: 12 }}
                  stroke="#94a3b8"
                />
                <YAxis
                  type="number"
                  dataKey="priceNum"
                  width={50}
                  domain={[priceRange.minBuffered, priceRange.maxBuffered]}
                  ticks={priceRange.ticks}
                  label={{
                    value: "Price",
                    angle: -90,
                    position: "insideLeft",
                    style: { fontSize: "12px", fill: "#64748b" },
                  }}
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) =>
                    `$${Math.floor(Number(value) / 1e18)}`
                  }
                  stroke="#94a3b8"
                />
                {uniqueEvents.map((eventName) => {
                  const CustomShape = (props: any) => (
                    <ScatterDot
                      {...props}
                      selectedId={selectedMarketplaceEventId}
                      selectedLegendItem={selectedLegendItem}
                    />
                  );
                  return (
                    <Scatter
                      key={eventName}
                      name={eventName}
                      data={chartData.filter((d) => d.event_name === eventName)}
                      fill={getEventColor(eventName)}
                      onClick={handleScatterClick}
                      shape={CustomShape}
                    />
                  );
                })}
                <Legend
                  verticalAlign="bottom"
                  wrapperStyle={{ paddingTop: "4px", cursor: "pointer" }}
                  formatter={(value) => (
                    <span
                      className="text-xs text-slate-700 dark:text-slate-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLegendItem((prev) =>
                          prev === value ? null : value,
                        );
                      }}
                      style={{ cursor: "pointer", display: "inline-block" }}
                    >
                      {value}
                    </span>
                  )}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {allChartData.length > 0 && (
          <div
            style={{
              padding: "12px 8px 8px",
              borderTop: "1px solid #e2e8f0",
              marginTop: "12px",
            }}
          >
            <div
              className="flex flex-col gap-2"
              onTouchStart={(e) => {
                marketplaceEventsTouchStartY.current = e.touches[0].clientY;
              }}
              onTouchEnd={(e) => {
                if (marketplaceEventsTouchStartY.current === null) return;

                const endY = e.changedTouches[0].clientY;
                const delta = marketplaceEventsTouchStartY.current - endY;
                const threshold = 30;

                if (delta > threshold) {
                  // Swiped up (newer events)
                  if (marketplaceEventPageOffset > 0) {
                    setMarketplaceEventSwipeDirection("up");
                    setTimeout(() => {
                      setMarketplaceEventPageOffset((prev) =>
                        Math.max(0, prev - EVENTS_PER_PAGE),
                      );
                      setMarketplaceEventSwipeDirection(null);
                    }, 150);
                  }
                } else if (delta < -threshold) {
                  // Swiped down (prior events)
                  const totalEvents = allChartData.length;
                  const maxOffset = Math.max(0, totalEvents - EVENTS_PER_PAGE);
                  if (marketplaceEventPageOffset < maxOffset) {
                    setMarketplaceEventSwipeDirection("down");
                    setTimeout(() => {
                      setMarketplaceEventPageOffset((prev) =>
                        Math.min(maxOffset, prev + EVENTS_PER_PAGE),
                      );
                      setMarketplaceEventSwipeDirection(null);
                    }, 150);
                  }
                }

                marketplaceEventsTouchStartY.current = null;
              }}
            >
              {marketplaceEventPageOffset > 0 && (
                <FilterButton
                  onClick={() => {
                    setMarketplaceEventSwipeDirection("up");
                    setTimeout(() => {
                      setMarketplaceEventPageOffset((prev) =>
                        Math.max(0, prev - EVENTS_PER_PAGE),
                      );
                      setMarketplaceEventSwipeDirection(null);
                    }, 150);
                  }}
                  className="w-full px-1.5 py-2 text-xs font-medium"
                >
                  Newer Events
                </FilterButton>
              )}

              <div
                className={`flex flex-col gap-2 transition-all duration-150 ${
                  marketplaceEventSwipeDirection === "down"
                    ? "opacity-0 translate-y-2"
                    : marketplaceEventSwipeDirection === "up"
                      ? "opacity-0 -translate-y-2"
                      : "opacity-100 translate-y-0"
                }`}
              >
                {allChartData
                  .slice(
                    marketplaceEventPageOffset,
                    marketplaceEventPageOffset + EVENTS_PER_PAGE,
                  )
                  .map((event) => {
                    const serialData = serialDataMap[event.id];
                    const selectedEmoji = userEmojisMarketplace[event.id];
                    const counts = emojiCounts[event.id];

                    return (
                      <button
                        key={event.id}
                        ref={(el) => {
                          const ref = getEventRef(event.id);
                          if (el && ref.current !== el) {
                            ref.current = el;
                          }
                        }}
                        onClick={() => {
                          setSelectedMarketplaceEventId(event.id);
                          setIsMarketplaceModalOpen(true);
                        }}
                        className="text-xs rounded px-1.5 border w-full text-left bg-white/30 dark:bg-slate-800/50 hover:bg-white/40 dark:hover:bg-slate-800/70 transition-colors border-white/20 dark:border-white/10 cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-1.5 text-[12px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <div className="flex items-center justify-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap text-[12px] flex-shrink-0 flex-wrap justify-center">
                                <span className="font-normal">
                                  {event.event_name}
                                </span>
                              </div>
                              {![
                                "CancelledListing",
                                "CancelledOffer",
                                "CancelledAuction",
                              ].includes(event.event_name) && (
                                <span className="font-semibold whitespace-nowrap flex-shrink-0 text-[12px]">
                                  $
                                  {Math.floor(
                                    calculateEventPrice(event) / 1e18,
                                  )}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 min-w-0">
                              {serialData && (
                                <div className="text-[12px] text-slate-700 dark:text-slate-300 truncate min-w-0 flex items-center gap-1">
                                  <span className="truncate">
                                    {serialData.name && (
                                      <span>{serialData.name}</span>
                                    )}
                                    {serialData.serial != null && (
                                      <span className="truncate">
                                        {serialData.name && " "}#
                                        {serialData.serial}
                                        {serialData.minted != null &&
                                          ` of ${serialData.minted}`}
                                      </span>
                                    )}
                                  </span>
                                </div>
                              )}
                              <span className="text-slate-600 dark:text-slate-400 text-[12px] truncate min-w-0">
                                {event.emitted_at
                                  ? (() => {
                                      const d = new Date(event.emitted_at);
                                      const year = d.getFullYear();
                                      const month = String(
                                        d.getMonth() + 1,
                                      ).padStart(2, "0");
                                      const day = String(d.getDate()).padStart(
                                        2,
                                        "0",
                                      );
                                      const hour = String(
                                        d.getHours(),
                                      ).padStart(2, "0");
                                      const minute = String(
                                        d.getMinutes(),
                                      ).padStart(2, "0");
                                      const second = String(
                                        d.getSeconds(),
                                      ).padStart(2, "0");
                                      return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
                                    })()
                                  : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 justify-end flex-shrink-0">
                            {counts && Object.keys(counts).length > 0 && (
                              <span className="flex items-center gap-0.5 text-sm leading-none flex-shrink-0">
                                <span>😊</span>
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                  {Object.values(counts).reduce((a, b) => a + b, 0)}
                                </span>
                              </span>
                            )}
                            {eventInitiators[event.id] && (
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[12px] text-slate-600 dark:text-slate-400 font-normal whitespace-nowrap">
                                  {eventInitiators[event.id].username}
                                </span>
                                {eventInitiators[event.id].rankLevel && (
                                  <img
                                    src={`/images/${getRankLevelBadgeImage(eventInitiators[event.id].rankLevel)}`}
                                    alt={eventInitiators[event.id].rankLevel}
                                    className="h-4 w-4 flex-shrink-0 object-contain"
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>

              {marketplaceEventPageOffset + EVENTS_PER_PAGE <
                allChartData.length && (
                <FilterButton
                  onClick={() => {
                    setMarketplaceEventSwipeDirection("down");
                    setTimeout(() => {
                      setMarketplaceEventPageOffset((prev) => {
                        const maxOffset = Math.max(
                          0,
                          allChartData.length - EVENTS_PER_PAGE,
                        );
                        return Math.min(maxOffset, prev + EVENTS_PER_PAGE);
                      });
                      setMarketplaceEventSwipeDirection(null);
                    }, 150);
                  }}
                  className="w-full px-1.5 py-2 text-xs font-medium"
                >
                  Prior Events
                </FilterButton>
              )}
            </div>
          </div>
        )}
      </div>

      {selectedEvent && (
        <EmojiReactionModal
          isOpen={isMarketplaceModalOpen}
          onClose={() => {
            setIsMarketplaceModalOpen(false);
            setSelectedMarketplaceEventId(null);
          }}
          onSelectEmoji={(emoji) =>
            handleSelectEmojiMarketplace(emoji, selectedMarketplaceEventId!)
          }
          selectedEmoji={
            selectedMarketplaceEventId
              ? userEmojisMarketplace[selectedMarketplaceEventId]
              : undefined
          }
          serialData={
            selectedMarketplaceEventId
              ? serialDataMap[selectedMarketplaceEventId]
              : undefined
          }
          event={selectedEvent ? (selectedEvent as any) : undefined}
          onNavigate={navigate}
          eventId={selectedMarketplaceEventId}
        />
      )}
    </div>
  );
}
