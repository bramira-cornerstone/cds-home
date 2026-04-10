import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
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
  fetchStakingAndRedemptionEventsByTeam,
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

export default function TeamEventsChart() {
  const account = useActiveAccount();
  const navigate = useNavigate();
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [marketplaceEvents, setMarketplaceEvents] = useState<
    MarketplaceEvent[]
  >([]);
  const [stakingRedemptionEvents, setStakingRedemptionEvents] = useState<
    CollectionEvent[]
  >([]);
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
    "none" | "player" | "tier" | "set" | "series"
  >("none");
  const [activeEventFilters, setActiveEventFilters] = useState<Set<string>>(
    new Set(),
  );
  const [availableEventFilterValues, setAvailableEventFilterValues] = useState<
    Record<string, Set<string>>
  >({
    PlayerName: new Set(),
    TierValue: new Set(),
    SetName: new Set(),
    SeriesName: new Set(),
  });

  // Fetch user's favorite team
  useEffect(() => {
    let isMounted = true;

    const loadFavoriteTeam = async () => {
      if (!account?.address) {
        if (isMounted) {
          setFavoriteTeam(null);
        }
        return;
      }

      try {
        const supabaseUrl = (import.meta as any).env.SUPABASE_URL as
          | string
          | undefined;
        const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as
          | string
          | undefined;

        if (!supabaseUrl || !anonKey) {
          return;
        }

        const baseUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
        const profileUrl = `${baseUrl}/profiles?wallet_address=eq.${account.address}&select=favorite_team`;
        const profileRes = await fetch(profileUrl, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        });

        if (!isMounted) return;

        if (profileRes.ok) {
          const profiles = await profileRes.json();
          if (isMounted) {
            if (Array.isArray(profiles) && profiles.length > 0) {
              setFavoriteTeam(profiles[0].favorite_team);
            } else {
              setFavoriteTeam(null);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          console.debug("[TeamEventsChart] Error loading favorite team:", err);
          setFavoriteTeam(null);
        }
      }
    };

    loadFavoriteTeam();

    return () => {
      isMounted = false;
    };
  }, [account?.address]);

  // Load RMV data for rank level calculations
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

  // Fetch marketplace and staking/redemption events
  useEffect(() => {
    setLoading(true);
    const controller = new AbortController();
    let isMounted = true;
    let abortedIntentionally = false;

    const loadEvents = async () => {
      try {
        // Fetch marketplace events
        const marketplaceData = await fetchMarketplaceEvents(controller.signal);
        if (!isMounted) return;

        const enrichedData = await Promise.all(
          marketplaceData.map((event) => enrichEventWithRelicData(event)),
        );

        if (!isMounted) return;

        // Filter by favorite team
        const filteredMarketplaceByTeam = favoriteTeam
          ? enrichedData.filter((event) => event.team === favoriteTeam)
          : enrichedData;

        setMarketplaceEvents(filteredMarketplaceByTeam);

        // Fetch staking and redemption events by team
        const stakingRedemptionData = favoriteTeam
          ? await fetchStakingAndRedemptionEventsByTeam(
              favoriteTeam,
              controller.signal,
            )
          : [];

        if (!isMounted) return;

        setStakingRedemptionEvents(stakingRedemptionData);

        // Calculate available filter values (excluding team)
        const filterValues: Record<string, Set<string>> = {
          PlayerName: new Set(),
          TierValue: new Set(),
          SetName: new Set(),
          SeriesName: new Set(),
        };

        for (const event of filteredMarketplaceByTeam) {
          const decoded =
            typeof event.decoded === "string"
              ? JSON.parse(event.decoded)
              : event.decoded;

          if (decoded?.PlayerName || event.PlayerName) {
            filterValues.PlayerName.add(
              decoded?.PlayerName || event.PlayerName,
            );
          }
          if (event.TierValue) filterValues.TierValue.add(event.TierValue);
          if (decoded?.SetName || event.SetName) {
            filterValues.SetName.add(decoded?.SetName || event.SetName);
          }
          if (event.SeriesName) filterValues.SeriesName.add(event.SeriesName);
        }

        setAvailableEventFilterValues(filterValues);
      } catch (error) {
        if (!isMounted || abortedIntentionally) return;
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("Error loading marketplace events:", error);
        setMarketplaceEvents([]);
        setStakingRedemptionEvents([]);
        setAvailableEventFilterValues({
          PlayerName: new Set(),
          TierValue: new Set(),
          SetName: new Set(),
          SeriesName: new Set(),
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadEvents();

    return () => {
      isMounted = false;
      abortedIntentionally = true;
      // Don't call abort() - the isMounted flag prevents state updates
      // and fetch will be automatically cleaned up by the browser
    };
  }, [favoriteTeam]);

  // Load serial data
  useEffect(() => {
    if (
      marketplaceEvents.length === 0 &&
      stakingRedemptionEvents.length === 0
    ) {
      setSerialDataMap({});
      return;
    }

    let isMounted = true;

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
        if (!isMounted) return;

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
        if (!isMounted) return;

        for (const result of serialResults) {
          if (result.serial) {
            for (const eventId of result.eventIds) {
              dataMap[eventId] = result.serial;
            }
          }
        }

        setSerialDataMap(dataMap);
      } catch (err) {
        if (isMounted) {
          console.error("Error loading serial data for team events:", err);
          setSerialDataMap({});
        }
      }
    };

    loadSerialData();

    return () => {
      isMounted = false;
    };
  }, [marketplaceEvents, stakingRedemptionEvents]);

  // Load emojis and reactions
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
            if (emoji) {
              emojisMap[event.id] = emoji;
            }
          }

          const allReactions = await fetchEmojiReactionsForEvent(event.id);
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
        if (isMounted) {
          console.error("Error loading emojis for team events:", err);
        }
      }
    };

    loadEmojisAndCounts();

    return () => {
      isMounted = false;
    };
  }, [marketplaceEvents, stakingRedemptionEvents, account?.address]);

  // Load event initiators
  useEffect(() => {
    if (
      marketplaceEvents.length === 0 &&
      stakingRedemptionEvents.length === 0
    ) {
      setEventInitiators({});
      return;
    }

    let isMounted = true;

    const loadEventInitiators = async () => {
      const initiators: Record<string, EventInitiator> = {};

      try {
        // Load initiators for marketplace events
        for (const event of marketplaceEvents) {
          if (!isMounted) return;

          try {
            const decoded =
              typeof event.decoded === "string"
                ? JSON.parse(event.decoded)
                : event.decoded;

            let username = "";
            let walletAddress = "";

            // Extract username and wallet from decoded data based on event type
            if (event.event_name === "NewListing" || event.event_name === "CancelledListing" || event.event_name === "UpdatedListing") {
              username = decoded?.listing_creator_username || decoded?.listingCreatorUsername || "";
              walletAddress = decoded?.listing_creator || decoded?.listingCreator || "";
            } else if (event.event_name === "NewAuction" || event.event_name === "CancelledAuction") {
              username = decoded?.auction_creator_username || decoded?.auctionCreatorUsername || "";
              walletAddress = decoded?.auction_creator || decoded?.auctionCreator || "";
            } else if (event.event_name === "NewBid") {
              username = decoded?.bidder_username || decoded?.bidderUsername || "";
              walletAddress = decoded?.bidder || "";
            } else if (event.event_name === "NewOffer" || event.event_name === "CancelledOffer") {
              username = decoded?.offeror_username || decoded?.offerorUsername || "";
              walletAddress = decoded?.offeror || "";
            } else if (event.event_name === "NewSale") {
              username = decoded?.buyer_username || decoded?.buyerUsername || "";
              walletAddress = decoded?.buyer || "";
            } else if (event.event_name === "AcceptedOffer") {
              username = decoded?.seller_username || decoded?.sellerUsername || "";
              walletAddress = decoded?.seller || "";
            } else if (event.event_name === "AuctionClosed") {
              username = decoded?.winning_bidder_username || decoded?.winningBidderUsername || "";
              walletAddress = decoded?.winning_bidder || decoded?.winningBidder || "";
            }

            // Fall back to shortened wallet address if username not available
            const displayUsername = username || (walletAddress ? walletAddress.substring(0, 6) + "..." + walletAddress.slice(-4) : "Unknown");

            // Calculate rank level if wallet address is available
            let rankLevel: string | undefined;
            if (walletAddress && rmvData.length > 0) {
              const rmvRecord = findRMVByOwner(rmvData, walletAddress);
              if (rmvRecord) {
                rankLevel = calculateRankLevel(rmvRecord.Percentile);
              }
            }

            initiators[event.id] = {
              username: displayUsername,
              rankLevel,
            };
          } catch {
            // Skip if we can't load initiator
          }
        }

        // Load initiators for staking/redemption events
        for (const event of stakingRedemptionEvents) {
          if (!isMounted) return;

          try {
            let username = "";
            let initiatorAddr: string | null = null;
            if (event.type === "staking") {
              initiatorAddr = event.staker;
              username = event.username || "";
            } else if (event.type === "redemption") {
              initiatorAddr = event.wallet_address;
              username = event.username || "";
            }

            if (initiatorAddr) {
              // Fall back to shortened wallet address if username is not available
              const displayUsername = username || initiatorAddr.substring(0, 6) + "..." + initiatorAddr.slice(-4);

              // Calculate rank level
              let rankLevel: string | undefined;
              if (rmvData.length > 0) {
                const rmvRecord = findRMVByOwner(rmvData, initiatorAddr);
                if (rmvRecord) {
                  rankLevel = calculateRankLevel(rmvRecord.Percentile);
                }
              }

              initiators[event.id] = {
                username: displayUsername,
                rankLevel,
              };
            }
          } catch {
            // Skip if we can't load initiator
          }
        }

        if (isMounted) {
          setEventInitiators(initiators);
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error loading event initiators:", err);
        }
      }
    };

    loadEventInitiators();

    return () => {
      isMounted = false;
    };
  }, [marketplaceEvents, stakingRedemptionEvents, rmvData]);

  const getEventRef = (eventId: string) => {
    if (!eventRefsMap[eventId]) {
      eventRefsMap[eventId] = {
        current: null,
      };
    }
    return eventRefsMap[eventId];
  };

  // Apply filters
  const filteredMarketplaceEvents = useMemo(() => {
    if (activeEventFilters.size === 0) {
      return marketplaceEvents;
    }

    return marketplaceEvents.filter((event) => {
      const decoded =
        typeof event.decoded === "string"
          ? JSON.parse(event.decoded)
          : event.decoded;

      const playerName = decoded?.PlayerName || event.PlayerName;
      const tierValue = event.TierValue;
      const setName = decoded?.SetName || event.SetName;
      const seriesName = event.SeriesName;

      for (const filter of activeEventFilters) {
        if (
          playerName === filter ||
          tierValue === filter ||
          setName === filter ||
          seriesName === filter
        ) {
          return true;
        }
      }

      return false;
    });
  }, [marketplaceEvents, activeEventFilters]);

  // Chart data
  const chartData = useMemo(() => {
    const chartEvents = [
      ...filteredMarketplaceEvents,
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

    return chartEvents.map((event) => ({
      id: event.id,
      event_name: event.event_name,
      priceNum: calculateEventPrice(event),
      emittedTime: new Date(event.emitted_at).getTime() / 1000,
    }));
  }, [filteredMarketplaceEvents, stakingRedemptionEvents]);

  const uniqueEvents = useMemo(() => {
    return [...new Set(chartData.map((d) => d.event_name))];
  }, [chartData]);

  // Time range calculations
  const timeRange = useMemo(() => {
    if (chartData.length === 0) {
      const now = Date.now() / 1000;
      return {
        min: now,
        max: now,
        minBuffered: now,
        maxBuffered: now + 3600,
        ticks: [now],
      };
    }

    const times = chartData.map((d) => d.emittedTime);
    const min = Math.min(...times);
    const max = Math.max(...times);
    const padding = (max - min) * 0.05;

    // Generate ticks and deduplicate to avoid recharts key warnings
    const tickSet = new Set<number>();
    tickSet.add(Math.floor(min));
    tickSet.add(Math.floor((min + max) / 2));
    tickSet.add(Math.floor(max));
    const ticks = Array.from(tickSet).sort((a, b) => a - b);

    return {
      min,
      max,
      minBuffered: Math.floor(min - padding),
      maxBuffered: Math.ceil(max + padding),
      ticks,
    };
  }, [chartData]);

  // Price range calculations
  const priceRange = useMemo(() => {
    if (chartData.length === 0) {
      return {
        min: 0,
        max: 1e18,
        minBuffered: 0,
        maxBuffered: 1e18,
        ticks: [0, 0.5e18, 1e18],
      };
    }

    const prices = chartData.map((d) => d.priceNum);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;

    // Generate ticks and deduplicate to avoid recharts key warnings
    const tickSet = new Set<number>();
    tickSet.add(Math.floor(min));
    tickSet.add(Math.floor((min + max) / 2));
    tickSet.add(Math.floor(max));
    const ticks = Array.from(tickSet).sort((a, b) => a - b);

    return {
      min,
      max,
      minBuffered: Math.max(0, Math.floor(min - padding)),
      maxBuffered: Math.ceil(max + padding),
      ticks,
    };
  }, [chartData]);

  const getTimeLabel = (seconds: number) => {
    const d = new Date(seconds * 1000);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleScatterClick = (state: any) => {
    const eventId = state.payload?.id;
    if (eventId) {
      setSelectedMarketplaceEventId(eventId);
      setIsMarketplaceModalOpen(true);
    }
  };

  const selectedEvent = selectedMarketplaceEventId
    ? marketplaceEvents.find((e) => e.id === selectedMarketplaceEventId) ||
      stakingRedemptionEvents.find((e) => e.id === selectedMarketplaceEventId)
    : null;

  if (!favoriteTeam) {
    return (
      <div className="w-full">
        <div
          className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col"
          style={{ padding: "12px 8px 12px" }}
        >
          <div className="flex items-center justify-between mb-1 px-0">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
              <p>{favoriteTeam} Marketplace Events</p>
            </h3>
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-400 px-3 py-6 text-center">
            No favorite team selected. Please set your favorite team to view
            team-specific events.
          </p>
        </div>
      </div>
    );
  }

  // Don't render the entire component if there are no events
  if (
    filteredMarketplaceEvents.length === 0 &&
    stakingRedemptionEvents.length === 0 &&
    !loading
  ) {
    return null;
  }

  return (
    <div className="w-full">
      <div
        className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 flex flex-col"
        style={{ padding: "12px 8px 0" }}
      >
        <div className="flex items-center justify-between mb-1 px-0">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
            <p>{favoriteTeam} Marketplace Events</p>
          </h3>
        </div>

        {/* Event Filters Row - WITHOUT Team filter */}
        <div className="mb-0 relative flex flex-nowrap items-stretch gap-0.5 w-full">
          <button
            type="button"
            className={`relative overflow-hidden flex flex-1 items-center justify-center text-center basis-0 px-3 py-1.5 text-sm rounded border ${activeEventFilterPanel === "player" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-800 border-slate-300 dark:bg-slate-700 dark:text-white dark:border-white/10 dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]"} before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 before:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 active:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out shadow-[0_5px_0_0_rgba(226,232,240,1)]`}
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

        {(filteredMarketplaceEvents.length > 0 ||
          stakingRedemptionEvents.length > 0) && (
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

                const allEvents = [
                  ...filteredMarketplaceEvents,
                  ...stakingRedemptionEvents.map((e) => ({
                    ...e,
                    event_name:
                      e.type === "staking" ? "RelicStaked" : "RelicRedeemed",
                    emitted_at: e.timestamp,
                  })),
                ];
                const totalEvents = allEvents.length;

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
                {[
                  ...filteredMarketplaceEvents,
                  ...stakingRedemptionEvents.map((e) => ({
                    ...e,
                    event_name:
                      e.type === "staking" ? "RelicStaked" : "RelicRedeemed",
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
                ]
                  .sort(
                    (a, b) =>
                      new Date(b.emitted_at).getTime() -
                      new Date(a.emitted_at).getTime(),
                  )
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

              {[...filteredMarketplaceEvents, ...stakingRedemptionEvents]
                .length >
                marketplaceEventPageOffset + EVENTS_PER_PAGE && (
                <FilterButton
                  onClick={() => {
                    setMarketplaceEventSwipeDirection("down");
                    setTimeout(() => {
                      const allEvents = [
                        ...filteredMarketplaceEvents,
                        ...stakingRedemptionEvents,
                      ];
                      setMarketplaceEventPageOffset((prev) =>
                        Math.min(
                          Math.max(0, allEvents.length - EVENTS_PER_PAGE),
                          prev + EVENTS_PER_PAGE,
                        ),
                      );
                      setMarketplaceEventSwipeDirection(null);
                    }, 150);
                  }}
                  className="w-full px-1.5 py-2 text-xs font-medium"
                >
                  Older Events
                </FilterButton>
              )}
            </div>
          </div>
        )}

        {filteredMarketplaceEvents.length === 0 &&
          stakingRedemptionEvents.length === 0 &&
          !loading && (
            <div
              style={{
                padding: "12px 8px 8px",
                borderTop: "1px solid #e2e8f0",
                marginTop: "12px",
                textAlign: "center",
              }}
            >
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No events found for {favoriteTeam}.
              </p>
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
          event={selectedEvent}
          serialData={
            selectedMarketplaceEventId
              ? serialDataMap[selectedMarketplaceEventId]
              : undefined
          }
          onNavigate={(path) => navigate(path)}
          selectedEmoji={
            selectedMarketplaceEventId
              ? userEmojisMarketplace[selectedMarketplaceEventId]
              : undefined
          }
          onSelectEmoji={async (emoji: string) => {
            if (!account?.address || !selectedMarketplaceEventId) return;

            try {
              const existing =
                userEmojisMarketplace[selectedMarketplaceEventId];
              if (existing === emoji) {
                await deleteEmojiReaction(
                  selectedMarketplaceEventId,
                  account.address,
                );
                const updated = { ...userEmojisMarketplace };
                delete updated[selectedMarketplaceEventId];
                setUserEmojisMarketplace(updated);
              } else {
                await saveEmojiReaction(
                  selectedMarketplaceEventId,
                  emoji,
                  account.address,
                );
                setUserEmojisMarketplace({
                  ...userEmojisMarketplace,
                  [selectedMarketplaceEventId]: emoji,
                });
              }

              const allReactions = await fetchEmojiReactionsForEvent(
                selectedMarketplaceEventId,
              );
              const counts: Record<string, number> = {};
              for (const reaction of allReactions) {
                counts[reaction.emoji] = (counts[reaction.emoji] || 0) + 1;
              }

              setEmojiCounts({
                ...emojiCounts,
                [selectedMarketplaceEventId]: counts,
              });
            } catch (err) {
              console.error("Error saving emoji reaction:", err);
            }
          }}
          eventId={selectedMarketplaceEventId}
        />
      )}
    </div>
  );
}
