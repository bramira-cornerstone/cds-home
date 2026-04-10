import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
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
import {
  fetchMarketplaceEvents,
  enrichEventWithRelicData,
  type MarketplaceEvent,
  resolveTokenIdFromEvent,
  fetchSerialData,
  type SerialData,
} from "@/lib/marketplaceEvents";
import {
  fetchAllStakingEvents,
  fetchAllRedemptionEvents,
  type CollectionEvent,
} from "@/lib/stakingAndRedemptionEvents";
import { FilterStyleButton as FilterButton } from "@/components/ui/filter-style-button";
import { EmojiReactionModal } from "./EmojiReactionModal";
import {
  saveEmojiReaction,
  deleteEmojiReaction,
  fetchUserReactionForEvent,
  fetchEmojiReactionsForEvent,
} from "@/lib/emojiReactions";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";
import { getRankLevelBadgeImage } from "@/lib/teamRmvChartData";
import { useActiveAccount } from "thirdweb/react";

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

// Helper function to format timestamp as YYYY-MM-DD
const formatTimestampCompact = (dateString: string): string => {
  const d = new Date(dateString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

export default function GlobalEventsChart() {
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
  const [rmvData, setRmvData] = useState<RMVPerOwnerRecord[]>([]);
  const [eventInitiators, setEventInitiators] = useState<
    Record<string, EventInitiator>
  >({});
  const eventRefsMap = useRef<
    Record<string, React.RefObject<HTMLButtonElement>>
  >({});
  const [marketplaceEventPageOffset, setMarketplaceEventPageOffset] =
    useState(0);
  const [marketplaceEventSwipeDirection, setMarketplaceEventSwipeDirection] =
    useState<"up" | "down" | null>(null);
  const marketplaceEventsTouchStartY = useRef<number | null>(null);
  const EVENTS_PER_PAGE = 10;
  const chartContainerTouchStartX = useRef<number | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [selectedLegendItem, setSelectedLegendItem] = useState<string | null>(
    null,
  );
  const [activeEventFilterPanel, setActiveEventFilterPanel] = useState<
    "none" | "player" | "team" | "tier" | "set" | "series"
  >("none");
  const [activeEventFilters, setActiveEventFilters] = useState<Set<string>>(
    new Set(),
  );
  const [availableEventFilterValues, setAvailableEventFilterValues] = useState<
    Record<string, Set<string>>
  >({
    PlayerName: new Set(),
    team: new Set(),
    TierValue: new Set(),
    SetName: new Set(),
    SeriesName: new Set(),
  });

  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let isMounted = true;

    Promise.all([
      fetchMarketplaceEvents(controller.signal),
      fetchAllStakingEvents(controller.signal),
      fetchAllRedemptionEvents(controller.signal),
    ])
      .then(async ([marketplaceData, stakingData, redemptionData]) => {
        if (!isMounted) return;

        // Enrich marketplace events with additional metadata from RelicSerialsJoined
        const enrichedMarketplaceData = await Promise.all(
          marketplaceData.map((event) => enrichEventWithRelicData(event)),
        );
        if (!isMounted) return;

        setMarketplaceEvents(enrichedMarketplaceData);

        // Combine staking and redemption events
        const combinedStakingRedemption = [...stakingData, ...redemptionData];
        setStakingRedemptionEvents(combinedStakingRedemption);

        // Calculate available filter values from marketplace events
        const filterValues: Record<string, Set<string>> = {
          PlayerName: new Set(),
          team: new Set(),
          TierValue: new Set(),
          SetName: new Set(),
          SeriesName: new Set(),
        };

        for (const event of enrichedMarketplaceData) {
          const decoded =
            typeof event.decoded === "string"
              ? JSON.parse(event.decoded)
              : event.decoded;

          if (decoded?.PlayerName || event.PlayerName) {
            filterValues.PlayerName.add(
              decoded?.PlayerName || event.PlayerName,
            );
          }
          if (event.team) filterValues.team.add(event.team);
          if (event.TierValue) filterValues.TierValue.add(event.TierValue);
          if (decoded?.SetName || event.SetName) {
            filterValues.SetName.add(decoded?.SetName || event.SetName);
          }
          if (event.SeriesName) filterValues.SeriesName.add(event.SeriesName);
        }

        setAvailableEventFilterValues(filterValues);
      })
      .catch((err) => {
        if (!isMounted) return;
        // Silently ignore AbortError when component unmounts
        if (err?.name !== "AbortError") {
        }
        setMarketplaceEvents([]);
        setStakingRedemptionEvents([]);
        setAvailableEventFilterValues({
          PlayerName: new Set(),
          team: new Set(),
          TierValue: new Set(),
          SetName: new Set(),
          SeriesName: new Set(),
        });
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, []);

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
      setEventInitiators({});
      return;
    }

    const loadEventInitiators = async () => {
      const initiatorsMap: Record<string, EventInitiator> = {};

      try {
        for (const event of marketplaceEvents) {
          try {
            const decoded =
              typeof event.decoded === "string"
                ? JSON.parse(event.decoded)
                : event.decoded;

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

  const filteredMarketplaceEvents = useMemo(() => {
    if (activeEventFilters.size === 0) {
      return marketplaceEvents;
    }

    // Filter with OR logic: show event if it matches ANY selected filter
    return marketplaceEvents.filter((event) => {
      const decoded =
        typeof event.decoded === "string"
          ? JSON.parse(event.decoded)
          : event.decoded;

      for (const filterValue of activeEventFilters) {
        const playerName = decoded?.PlayerName || event.PlayerName;
        const setName = decoded?.SetName || event.SetName;

        if (
          playerName === filterValue ||
          event.team === filterValue ||
          event.TierValue === filterValue ||
          setName === filterValue ||
          event.SeriesName === filterValue
        ) {
          return true;
        }
      }
      return false;
    });
  }, [marketplaceEvents, activeEventFilters]);

  const allChartData = useMemo(() => {
    // Transform marketplace events
    const transformedMarketplaceEvents = filteredMarketplaceEvents.map(
      (event) => ({
        ...event,
        priceNum: calculateEventPrice(event),
        emittedTime: new Date(event.emitted_at).getTime(),
      }),
    );

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
  }, [filteredMarketplaceEvents, stakingRedemptionEvents]);

  const chartData = useMemo(() => {
    return allChartData;
  }, [allChartData]);

  useEffect(() => {
    if (allChartData.length === 0) {
      setUserEmojisMarketplace({});
      setEmojiCounts({});
      return;
    }

    const controller = new AbortController();
    let isMounted = true;

    const loadEmojisAndCounts = async () => {
      const userEmojisMap: Record<string, string> = {};
      const countsMap: Record<string, Record<string, number>> = {};

      // Fetch all emoji reactions and user's emoji for this session
      const promises = allChartData.map(async (event) => {
        try {
          // Fetch all emoji reactions for this event
          const reactions = await fetchEmojiReactionsForEvent(
            event.id,
            controller.signal,
          );

          if (!isMounted) return;

          if (reactions.length > 0) {
            // Count emojis
            const emojiCounts: Record<string, number> = {};
            for (const reaction of reactions) {
              emojiCounts[reaction.emoji] =
                (emojiCounts[reaction.emoji] || 0) + 1;
            }
            countsMap[event.id] = emojiCounts;
          }

          // Fetch user's emoji for this event if logged in
          if (account?.address) {
            const userEmoji = await fetchUserReactionForEvent(
              event.id,
              account.address,
              controller.signal,
            );
            if (!isMounted) return;

            if (userEmoji) {
              userEmojisMap[event.id] = userEmoji;
            }
          }
        } catch (err) {
          // Errors are already handled silently in fetchEmojiReactionsForEvent
          // and fetchUserReactionForEvent, so we just continue
        }
      });

      try {
        await Promise.all(promises);
      } catch {
        // Silently handle all errors - null returns from fetch functions are expected
      }

      // Only update state if mounted and not aborted
      if (isMounted && !controller.signal.aborted) {
        setUserEmojisMarketplace(userEmojisMap);
        setEmojiCounts(countsMap);
      }
    };

    loadEmojisAndCounts();

    return () => {
      isMounted = false;
      try {
        controller.abort();
      } catch {
        // Silently ignore any errors from abort
      }
    };
  }, [allChartData, account?.address]);

  const selectedEvent = selectedMarketplaceEventId
    ? allChartData.find((e) => e.id === selectedMarketplaceEventId)
    : null;

  const handleScatterClick = (dataPoint: any) => {
    if (!dataPoint || !dataPoint.id) return;

    console.log("Scatter point clicked, event ID:", dataPoint.id);
    setSelectedMarketplaceEventId(dataPoint.id);
    setIsMarketplaceModalOpen(true);
  };

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

    let format = "MMM dd, yyyy";
    if (diffMs < 24 * 60 * 60 * 1000) {
      format = "HH:mm:ss";
    } else if (diffMs < 30 * 24 * 60 * 60 * 1000) {
      format = "MMM dd";
    }

    const buffer = diffMs * 0.05;
    const minBuffered = min - buffer;
    const maxBuffered = max + buffer;

    const tickCount = 6;
    const range = maxBuffered - minBuffered;
    const tickSet = new Set<number>();
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      const value = minBuffered + range * (i / (tickCount - 1));
      const roundedValue = Math.round(value);
      if (!tickSet.has(roundedValue)) {
        tickSet.add(roundedValue);
        ticks.push(roundedValue);
      }
    }

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

    const buffer = diff === 0 ? 10 : Math.max(diff * 0.05, 10);
    const minBuffered = 0;
    const maxBuffered = max + buffer;

    const tickCount = 6;
    const range = maxBuffered - minBuffered;
    const tickSet = new Set<number>();
    const ticks: number[] = [];
    for (let i = 0; i < tickCount; i++) {
      const value = minBuffered + range * (i / (tickCount - 1));
      const roundedValue = Math.round(value * 100) / 100;
      if (!tickSet.has(roundedValue)) {
        tickSet.add(roundedValue);
        ticks.push(roundedValue);
      }
    }

    const domainBuffer = range * 0.05;
    return {
      min,
      max,
      minBuffered,
      maxBuffered: maxBuffered + domainBuffer,
      ticks,
    };
  }, [chartData]);

  const handleSelectEmojiMarketplace = async (
    emoji: string,
    eventId: string,
  ) => {
    if (!account?.address) return;

    // Get the event from allChartData to check if it's a RelicStaked or RelicRedeemed event
    const event = allChartData.find((e) => e.id === eventId);

    console.log("[handleSelectEmojiMarketplace] Looking for eventId:", eventId);
    console.log("[handleSelectEmojiMarketplace] Event found:", !!event);
    if (event) {
      console.log(
        "[handleSelectEmojiMarketplace] Event name:",
        event.event_name,
      );
    }

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
        const dbEventId = decoded?.database_event_id;
        console.log(
          "[handleSelectEmojiMarketplace] Decoded has database_event_id:",
          !!dbEventId,
          "value:",
          dbEventId,
        );
        if (dbEventId) {
          emojiEventId = dbEventId;
          console.log(
            "[handleSelectEmojiMarketplace] Using database_event_id:",
            emojiEventId,
          );
        } else {
          console.warn(
            "[handleSelectEmojiMarketplace] No database_event_id found, using eventId instead",
          );
        }
      } catch (err) {
        console.error(
          "[handleSelectEmojiMarketplace] Error parsing event decoded data:",
          err instanceof Error ? err.message : String(err),
        );
      }
    } else {
      console.log(
        "[handleSelectEmojiMarketplace] Event is marketplace or not found",
      );
    }

    console.log(
      "[handleSelectEmojiMarketplace] Final emoji event ID to send:",
      emojiEventId,
    );

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
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Loading chart...
        </div>
      </div>
    );
  }

  if (allChartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          No event data available
        </div>
      </div>
    );
  }

  const uniqueEvents = Array.from(new Set(chartData.map((d) => d.event_name)));

  const selectedEventForModal = selectedMarketplaceEventId
    ? allChartData.find((e) => e.id === selectedMarketplaceEventId)
    : null;

  return (
    <div className="w-full">
      <div
        className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col"
        style={{ padding: "12px 8px 0" }}
      >
        <div className="flex items-center justify-between mb-1 px-0 max-lg:px-2">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            <p>Marketplace Events Timeline</p>
          </h3>
        </div>

        {/* Event Filters Row - Toggle Buttons */}
        <div className="mb-0 relative flex flex-nowrap items-stretch gap-0.5 w-full">
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "player" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
            onClick={() =>
              setActiveEventFilterPanel((p) =>
                p === "player" ? "none" : "player",
              )
            }
          >
            <span className="relative z-[1]">
              Player
              {Array.from(availableEventFilterValues.PlayerName).some((v) =>
                activeEventFilters.has(v),
              ) ? (
                <span
                  aria-hidden="true"
                  className="ml-1 text-black text-xs align-middle"
                >
                  ✓
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "team" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
            onClick={() =>
              setActiveEventFilterPanel((p) => (p === "team" ? "none" : "team"))
            }
          >
            <span className="relative z-[1]">
              Team
              {Array.from(availableEventFilterValues.team).some((v) =>
                activeEventFilters.has(v),
              ) ? (
                <span
                  aria-hidden="true"
                  className="ml-1 text-black text-xs align-middle"
                >
                  ✓
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "tier" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
            onClick={() =>
              setActiveEventFilterPanel((p) => (p === "tier" ? "none" : "tier"))
            }
          >
            <span className="relative z-[1]">
              Tier
              {Array.from(availableEventFilterValues.TierValue).some((v) =>
                activeEventFilters.has(v),
              ) ? (
                <span
                  aria-hidden="true"
                  className="ml-1 text-black text-xs align-middle"
                >
                  ✓
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "set" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
            onClick={() =>
              setActiveEventFilterPanel((p) => (p === "set" ? "none" : "set"))
            }
          >
            <span className="relative z-[1]">
              Set
              {Array.from(availableEventFilterValues.SetName).some((v) =>
                activeEventFilters.has(v),
              ) ? (
                <span
                  aria-hidden="true"
                  className="ml-1 text-black text-xs align-middle"
                >
                  ✓
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "series" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
            onClick={() =>
              setActiveEventFilterPanel((p) =>
                p === "series" ? "none" : "series",
              )
            }
          >
            <span className="relative z-[1]">
              Series
              {Array.from(availableEventFilterValues.SeriesName).some((v) =>
                activeEventFilters.has(v),
              ) ? (
                <span
                  aria-hidden="true"
                  className="ml-1 text-black text-xs align-middle"
                >
                  ✓
                </span>
              ) : null}
            </span>
          </button>
          <button
            type="button"
            className="relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]"
            onClick={() => {
              setActiveEventFilters(new Set());
              setActiveEventFilterPanel("none");
              setMarketplaceEventPageOffset(0);
            }}
          >
            <span className="relative z-[1]">Reset</span>
          </button>
        </div>

        {/* Sliding Filter Panels */}
        <div
          className={`relative z-10 overflow-hidden transition-all duration-300 ${activeEventFilterPanel === "player" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
            <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {Array.from(availableEventFilterValues.PlayerName)
                .sort()
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${activeEventFilters.has(value) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      const newFilters = new Set(activeEventFilters);
                      if (newFilters.has(value)) {
                        newFilters.delete(value);
                      } else {
                        newFilters.add(value);
                      }
                      setActiveEventFilters(newFilters);
                      setMarketplaceEventPageOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div
          className={`relative z-10 overflow-hidden transition-all duration-300 ${activeEventFilterPanel === "team" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
            <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {Array.from(availableEventFilterValues.team)
                .sort()
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${activeEventFilters.has(value) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      const newFilters = new Set(activeEventFilters);
                      if (newFilters.has(value)) {
                        newFilters.delete(value);
                      } else {
                        newFilters.add(value);
                      }
                      setActiveEventFilters(newFilters);
                      setMarketplaceEventPageOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div
          className={`relative z-10 overflow-hidden transition-all duration-300 ${activeEventFilterPanel === "tier" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
            <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {Array.from(availableEventFilterValues.TierValue)
                .sort()
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${activeEventFilters.has(value) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      const newFilters = new Set(activeEventFilters);
                      if (newFilters.has(value)) {
                        newFilters.delete(value);
                      } else {
                        newFilters.add(value);
                      }
                      setActiveEventFilters(newFilters);
                      setMarketplaceEventPageOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div
          className={`relative z-10 overflow-hidden transition-all duration-300 ${activeEventFilterPanel === "set" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
            <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {Array.from(availableEventFilterValues.SetName)
                .sort()
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${activeEventFilters.has(value) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      const newFilters = new Set(activeEventFilters);
                      if (newFilters.has(value)) {
                        newFilters.delete(value);
                      } else {
                        newFilters.add(value);
                      }
                      setActiveEventFilters(newFilters);
                      setMarketplaceEventPageOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div
          className={`relative z-10 overflow-hidden transition-all duration-300 ${activeEventFilterPanel === "series" ? "max-h-64 opacity-100" : "max-h-0 opacity-0"}`}
        >
          <div className="rounded-md border border-slate-300 bg-transparent p-0 dark:bg-slate-700 dark:border-white/10">
            <div className="max-h-40 overflow-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 p-2">
              {Array.from(availableEventFilterValues.SeriesName)
                .sort()
                .map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`px-2 py-1.5 text-sm rounded border text-left ${activeEventFilters.has(value) ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"}`}
                    onClick={() => {
                      const newFilters = new Set(activeEventFilters);
                      if (newFilters.has(value)) {
                        newFilters.delete(value);
                      } else {
                        newFilters.add(value);
                      }
                      setActiveEventFilters(newFilters);
                      setMarketplaceEventPageOffset(0);
                    }}
                  >
                    {value}
                  </button>
                ))}
            </div>
          </div>
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
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    border: "1px solid rgba(0, 0, 0, 0.1)",
                    borderRadius: "8px",
                    color: "rgb(0, 0, 0)",
                  }}
                  labelStyle={{ color: "rgb(0, 0, 0)" }}
                  wrapperStyle={{
                    color: "rgb(0, 0, 0)",
                    pointerEvents: "auto",
                  }}
                  cursor={{ fill: "rgba(0, 0, 0, 0.1)" }}
                  allowEscapeViewBox={{ x: true, y: true }}
                  formatter={(value: any) => {
                    const priceNum = Number(value) / 1e18;
                    return `$${priceNum.toFixed(2)}`;
                  }}
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
                              <div className="flex items-center justify-center px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-800 dark:text-slate-200 font-semibold whitespace-nowrap text-[12px] flex-shrink-0">
                                <span className="font-normal">
                                  {event.event_name}
                                </span>
                              </div>
                              {serialData && (
                                <span className="font-semibold whitespace-nowrap flex-shrink-0 text-[12px]">
                                  {event.event_name !== "RelicStaked" &&
                                    event.event_name !== "RelicRedeemed" &&
                                    ![
                                      "CancelledListing",
                                      "CancelledOffer",
                                      "CancelledAuction",
                                    ].includes(event.event_name) &&
                                    "$"}
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
                                  ? formatTimestampCompact(event.emitted_at)
                                  : "—"}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 justify-end flex-shrink-0">
                            {counts && Object.keys(counts).length > 0 && (
                              <span className="flex items-center gap-0.5 text-sm leading-none flex-shrink-0">
                                <span>😊</span>
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                  {Object.values(counts).reduce(
                                    (a, b) => a + b,
                                    0,
                                  )}
                                </span>
                              </span>
                            )}
                            {eventInitiators[event.id] && (
                              <Link
                                to={`/collection/${eventInitiators[event.id].username}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 flex-shrink-0 hover:opacity-70 transition-opacity"
                              >
                                <span className="text-[12px] text-slate-600 dark:text-slate-400 font-normal whitespace-nowrap">
                                  {eventInitiators[event.id].username}
                                </span>
                                {eventInitiators[event.id].rankLevel ? (
                                  <img
                                    src={`/images/${getRankLevelBadgeImage(eventInitiators[event.id].rankLevel)}`}
                                    alt={eventInitiators[event.id].rankLevel}
                                    className="h-4 w-4 flex-shrink-0 object-contain"
                                  />
                                ) : null}
                              </Link>
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

      {selectedEventForModal && (
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
          event={
            selectedEventForModal ? (selectedEventForModal as any) : undefined
          }
          onNavigate={navigate}
          eventId={selectedMarketplaceEventId}
        />
      )}
    </div>
  );
}
