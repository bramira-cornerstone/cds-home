import { fetchMarketplaceUserEvents } from "@/lib/marketplaceUserData";
import { fetchMintedByEditionId } from "@/lib/supabaseMinted";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";
import { getFavoriteTeam } from "@/lib/favoriteTeamService";

export interface MarketItem {
  edition_id: number;
  max_token_id?: number;
  listing_creator?: string;
  auction_creator?: string;
  price?: number;
  PlayerName?: string;
  SetName?: string;
  team?: string;
  serial?: number;
  Minted?: number;
  GameDate?: string;
  hasActiveListing?: boolean;
  hasActiveAuction?: boolean;
  [key: string]: any;
}

export interface EditionPopularity {
  edition_id: number;
  total_activity_count: number;
  most_recent_activity: string; // ISO timestamp
  activity_score: number; // Combination of recency and volume
}

export interface UserBehaviorProfile {
  favoritePlayerNames: Map<string, number>;
  favoriteTeams: Map<string, number>;
  favoriteSetNames: Map<string, number>;
  favoriteListingCreators: Map<string, number>;
  favoriteAuctionCreators: Map<string, number>;
  priceRanges: { min: number; max: number }[];
  gameDatePreference: "recent" | "historic" | "neutral";
  gameDateDeviation: number;
  mintedRanges: { min: number; max: number }[];
  serialRanges: { min: number; max: number }[];
  offerTendencies: {
    prefersUndervalued: boolean;
    preferableEditionTypes: string[];
  };
  recentActivityWeight: number;
  historicActivityWeight: number;
}

const RECENCY_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const RECENCY_WEIGHT = 2; // 2x impact for recent vs historic

function headers(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    Accept: "application/json",
  } as Record<string, string>;
}

/**
 * Analyzes user marketplace behavior to create a preference profile
 */
export async function analyzeUserBehavior(
  userAddress: string,
  signal?: AbortSignal,
): Promise<UserBehaviorProfile> {
  const events = await fetchMarketplaceUserEvents(userAddress, signal);

  // Normalize user address for comparison
  const normalizedUserAddress = userAddress.toLowerCase();

  console.log(`[marketplaceAlgorithm] Analyzing behavior for ${userAddress.slice(0, 6)}...${userAddress.slice(-4)} with ${events.length} marketplace events`);

  const now = new Date().getTime();
  const favoritePlayerNames = new Map<string, number>();
  const favoriteTeams = new Map<string, number>();
  const favoriteSetNames = new Map<string, number>();
  const favoriteListingCreators = new Map<string, number>();
  const favoriteAuctionCreators = new Map<string, number>();
  const prices: number[] = [];
  const gameDateDiffs: number[] = []; // Differences between emitted_at and GameDate
  const mintedValues: number[] = [];
  const serialValues: number[] = [];
  let offerCount = 0;
  let newOfferCount = 0;

  // Separate events by type and apply recency weighting
  const salesEvents = events.filter((e) => e.event_name === "NewSale");
  const bidEvents = events.filter((e) => e.event_name === "NewBid");
  const offerEvents = events.filter((e) => e.event_name === "NewOffer");

  console.log(`[marketplaceAlgorithm] Event breakdown: ${salesEvents.length} sales, ${bidEvents.length} bids, ${offerEvents.length} offers`);

  // Process sales events (purchases)
  for (const event of salesEvents) {
    const isRecent = now - new Date(event.emitted_at).getTime() < RECENCY_THRESHOLD_MS;
    const weight = isRecent ? RECENCY_WEIGHT : 1;

    // Normalize buyer address for comparison
    const eventBuyer = event.buyer?.toLowerCase();
    const eventSeller = event.seller?.toLowerCase();

    if (eventBuyer === normalizedUserAddress) {
      // User was the buyer
      if (event.PlayerName) {
        favoritePlayerNames.set(
          event.PlayerName,
          (favoritePlayerNames.get(event.PlayerName) || 0) + weight,
        );
      }

      if (event.SetName) {
        favoriteSetNames.set(
          event.SetName,
          (favoriteSetNames.get(event.SetName) || 0) + weight,
        );
      }

      if (event.team) {
        favoriteTeams.set(
          event.team,
          (favoriteTeams.get(event.team) || 0) + weight,
        );
      }

      if (event.listing_creator) {
        favoriteListingCreators.set(
          event.listing_creator,
          (favoriteListingCreators.get(event.listing_creator) || 0) + weight,
        );
      }

      if (event.total_price_paid) {
        prices.push(parseFloat(String(event.total_price_paid)));
      }

      if (event.serial) {
        serialValues.push(event.serial);
      }

      if (event.Minted) {
        mintedValues.push(event.Minted);
      }
    } else if (eventSeller === normalizedUserAddress) {
      // User was the seller
      const eventListingCreator = event.listing_creator?.toLowerCase();
      if (eventListingCreator === normalizedUserAddress && event.total_price_paid) {
        prices.push(parseFloat(String(event.total_price_paid)));
      }
    }
  }

  // Process bid events
  for (const event of bidEvents) {
    const eventBidder = event.bidder?.toLowerCase();
    if (eventBidder === normalizedUserAddress) {
      const isRecent =
        now - new Date(event.emitted_at).getTime() < RECENCY_THRESHOLD_MS;
      const weight = isRecent ? RECENCY_WEIGHT : 1;

      if (event.auction_creator) {
        favoriteAuctionCreators.set(
          event.auction_creator,
          (favoriteAuctionCreators.get(event.auction_creator) || 0) + weight,
        );
      }

      if (event.bid_amount) {
        prices.push(parseFloat(String(event.bid_amount)));
      }
    }
  }

  // Process offer events
  for (const event of offerEvents) {
    const eventOfferor = event.offeror?.toLowerCase();
    if (eventOfferor === normalizedUserAddress) {
      newOfferCount++;

      if (event.total_price) {
        prices.push(parseFloat(String(event.total_price)));
      }
    }
  }

  // Fetch minted data to analyze GameDate and team preferences
  // Group by max_token_id to avoid duplicates
  const tokenIds = new Set<number>();
  for (const event of salesEvents) {
    if (event.max_token_id) {
      tokenIds.add(event.max_token_id);
    }
  }

  console.log(`[marketplaceAlgorithm] Fetching Minted data for ${tokenIds.size} unique editions`);

  for (const tokenId of tokenIds) {
    const mintedData = await fetchMintedByEditionId(tokenId, signal);
    if (mintedData) {
      console.log(`[marketplaceAlgorithm] Minted data for edition ${tokenId}:`, {
        team: mintedData.team,
        GameDate: mintedData.GameDate,
      });

      if (mintedData.team) {
        const isRecent = salesEvents.some(
          (e) =>
            e.max_token_id === tokenId &&
            now - new Date(e.emitted_at).getTime() < RECENCY_THRESHOLD_MS,
        );
        const weight = isRecent ? RECENCY_WEIGHT : 1;
        favoriteTeams.set(
          mintedData.team,
          (favoriteTeams.get(mintedData.team) || 0) + weight,
        );
      }

      if (mintedData.GameDate) {
        const gameDateMs = new Date(mintedData.GameDate).getTime();
        for (const event of salesEvents) {
          if (event.max_token_id === tokenId && event.emitted_at) {
            const emittedMs = new Date(event.emitted_at).getTime();
            const daysDiff = (emittedMs - gameDateMs) / (1000 * 60 * 60 * 24);
            gameDateDiffs.push(daysDiff);
          }
        }
      }
    } else {
      console.log(`[marketplaceAlgorithm] No Minted data found for edition ${tokenId}`);
    }
  }

  // Determine GameDate preference based on behavior
  let gameDatePreference: "recent" | "historic" | "neutral" = "neutral";
  let gameDateDeviation = 0;

  if (gameDateDiffs.length > 0) {
    const avgDiff =
      gameDateDiffs.reduce((a, b) => a + b, 0) / gameDateDiffs.length;
    gameDateDeviation = Math.sqrt(
      gameDateDiffs.reduce((a, diff) => a + Math.pow(diff - avgDiff, 2), 0) /
        gameDateDiffs.length,
    );

    if (avgDiff < 30) {
      // Recently released items
      gameDatePreference = "recent";
    } else if (avgDiff > 365) {
      // Older items
      gameDatePreference = "historic";
    }
  }

  // Calculate price ranges (quartiles)
  const priceRanges: { min: number; max: number }[] = [];
  if (prices.length > 0) {
    prices.sort((a, b) => a - b);
    const q1 = prices[Math.floor(prices.length * 0.25)];
    const q2 = prices[Math.floor(prices.length * 0.5)];
    const q3 = prices[Math.floor(prices.length * 0.75)];

    priceRanges.push(
      { min: Math.min(...prices), max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: Math.max(...prices) },
    );
  }

  // Calculate Minted ranges (quartiles)
  const mintedRanges: { min: number; max: number }[] = [];
  if (mintedValues.length > 0) {
    mintedValues.sort((a, b) => a - b);
    const q1 = mintedValues[Math.floor(mintedValues.length * 0.25)];
    const q2 = mintedValues[Math.floor(mintedValues.length * 0.5)];
    const q3 = mintedValues[Math.floor(mintedValues.length * 0.75)];

    mintedRanges.push(
      { min: Math.min(...mintedValues), max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: Math.max(...mintedValues) },
    );
  }

  // Calculate serial ranges (quartiles)
  const serialRanges: { min: number; max: number }[] = [];
  if (serialValues.length > 0) {
    serialValues.sort((a, b) => a - b);
    const q1 = serialValues[Math.floor(serialValues.length * 0.25)];
    const q2 = serialValues[Math.floor(serialValues.length * 0.5)];
    const q3 = serialValues[Math.floor(serialValues.length * 0.75)];

    serialRanges.push(
      { min: Math.min(...serialValues), max: q1 },
      { min: q1, max: q2 },
      { min: q2, max: q3 },
      { min: q3, max: Math.max(...serialValues) },
    );
  }

  // Analyze offer patterns
  const offerTendencies = {
    prefersUndervalued:
      newOfferCount > 0 && newOfferCount > offerCount * 0.5,
    preferableEditionTypes: [] as string[],
  };

  // Log the behavior profile summary
  const topPlayers = Array.from(favoritePlayerNames.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topTeams = Array.from(favoriteTeams.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topSets = Array.from(favoriteSetNames.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log(`[marketplaceAlgorithm] User behavior profile extracted:`, {
    favoritePlayersCount: favoritePlayerNames.size,
    favoriteTeamsCount: favoriteTeams.size,
    favoriteSetsCount: favoriteSetNames.size,
    favoriteCreatorsCount: favoriteListingCreators.size,
    favoritePriceRanges: priceRanges.length,
    gameDatePreference,
    mintedRangesCount: mintedRanges.length,
    serialRangesCount: serialRanges.length,
    topPlayers: topPlayers.map(([name, score]) => `${name} (${score})`),
    topTeams: topTeams.map(([team, score]) => `${team} (${score})`),
    topSets: topSets.map(([set, score]) => `${set} (${score})`),
  });

  if (topPlayers.length === 0 && topTeams.length === 0 && salesEvents.length > 0) {
    console.warn(`[marketplaceAlgorithm] WARNING: Analyzed ${salesEvents.length} sales but extracted no player/team preferences. Check if events have PlayerName/team fields populated.`);
  }

  return {
    favoritePlayerNames,
    favoriteTeams,
    favoriteSetNames,
    favoriteListingCreators,
    favoriteAuctionCreators,
    priceRanges,
    gameDatePreference,
    gameDateDeviation,
    mintedRanges,
    serialRanges,
    offerTendencies,
    recentActivityWeight: RECENCY_WEIGHT,
    historicActivityWeight: 1,
  };
}

/**
 * Scores a marketplace item based on user behavior profile
 * Uses complex multi-factor weighting where multiple criteria are combined
 * Note: Active listing bonus removed - grouping is handled at sorting level
 */
export async function scoreMarketItem(
  item: MarketItem,
  profile: UserBehaviorProfile,
  userAddress: string,
  signal?: AbortSignal,
): Promise<number> {
  let score = 0;
  const scoreBreakdown: Record<string, number> = {};

  // Fetch user's favorite team for boosting (case-insensitive comparison)
  let favoriteTeam: string | null = null;
  try {
    favoriteTeam = await getFavoriteTeam(userAddress);
  } catch (err) {
    // Silently fail - favorite team is optional for scoring
  }

  // 1. PlayerName match (high priority - highest weight among behavior criteria)
  if (item.PlayerName && profile.favoritePlayerNames.has(item.PlayerName)) {
    const rawPlayerScore = profile.favoritePlayerNames.get(item.PlayerName) || 0;
    // Scale: base 80 points + additional based on preference strength
    const playerScore = 80 + Math.min(rawPlayerScore * 15, 100);
    score += playerScore;
    scoreBreakdown["1_PlayerName"] = playerScore;
  }

  // 2. Team match (high priority - very strong signal)
  if (item.max_token_id && !item.team) {
    const mintedData = await fetchMintedByEditionId(item.max_token_id, signal);
    if (mintedData && mintedData.team) {
      item.team = mintedData.team;
    }
  }

  if (item.team && profile.favoriteTeams.has(item.team)) {
    const rawTeamScore = profile.favoriteTeams.get(item.team) || 0;
    // Scale: base 60 points + additional based on preference strength
    const teamScore = 60 + Math.min(rawTeamScore * 12, 80);
    score += teamScore;
    scoreBreakdown["2_Team"] = teamScore;
  } else if (item.team && favoriteTeam && item.team.toLowerCase() === favoriteTeam.toLowerCase()) {
    // Fallback: if team matches favorite team but not in behavior profile, still give bonus
    const teamScore = 60; // Base score for favorite team match
    score += teamScore;
    scoreBreakdown["2_Team_FavoriteBonus"] = teamScore;
  }

  // 3. SetName match
  if (item.SetName && profile.favoriteSetNames.has(item.SetName)) {
    const rawSetScore = profile.favoriteSetNames.get(item.SetName) || 0;
    // Scale: base 50 points + additional based on preference strength
    const setScore = 50 + Math.min(rawSetScore * 10, 70);
    score += setScore;
    scoreBreakdown["3_SetName"] = setScore;
  }

  // 4. Listing creator / Auction creator match
  if (item.listing_creator && profile.favoriteListingCreators.has(item.listing_creator)) {
    const rawCreatorScore = profile.favoriteListingCreators.get(item.listing_creator) || 0;
    const creatorScore = 40 + Math.min(rawCreatorScore * 8, 50);
    score += creatorScore;
    scoreBreakdown["4_Creator"] = creatorScore;
  }

  if (item.auction_creator && profile.favoriteAuctionCreators.has(item.auction_creator)) {
    const rawAuctionCreatorScore = profile.favoriteAuctionCreators.get(item.auction_creator) || 0;
    const auctionCreatorScore = 40 + Math.min(rawAuctionCreatorScore * 8, 50);
    score += auctionCreatorScore;
    scoreBreakdown["4_AuctionCreator"] = auctionCreatorScore;
  }

  // 5. Price range match - very important for ranking
  if (item.price && profile.priceRanges.length > 0) {
    for (const range of profile.priceRanges) {
      if (item.price >= range.min && item.price <= range.max) {
        score += 45; // Increased from 5 to create meaningful differentiation
        scoreBreakdown["5_PriceRange"] = 45;
        break;
      }
    }
  }

  // 6 & 7. GameDate preference - important signal
  if (item.max_token_id && item.GameDate === undefined) {
    const mintedData = await fetchMintedByEditionId(item.max_token_id, signal);
    if (mintedData && mintedData.GameDate) {
      item.GameDate = mintedData.GameDate;
    }
  }

  let gamedateScore = 0;
  if (item.GameDate) {
    const gameDateMs = new Date(item.GameDate).getTime();
    const nowMs = new Date().getTime();
    const daysDiffFromToday = (nowMs - gameDateMs) / (1000 * 60 * 60 * 24);

    if (profile.gameDatePreference === "recent") {
      // Prefer items with recent GameDate
      if (daysDiffFromToday < 30) {
        gamedateScore = 35;
      } else if (daysDiffFromToday < 90) {
        gamedateScore = 20;
      }
    } else if (profile.gameDatePreference === "historic") {
      // Prefer items with historic GameDate
      if (daysDiffFromToday > 365) {
        gamedateScore = 35;
      } else if (daysDiffFromToday > 180) {
        gamedateScore = 20;
      }
    }
    if (gamedateScore > 0) {
      score += gamedateScore;
      scoreBreakdown["6_GameDate"] = gamedateScore;
    }
  }

  // 8. Minted count range match
  if (item.Minted && profile.mintedRanges.length > 0) {
    for (const range of profile.mintedRanges) {
      if (item.Minted >= range.min && item.Minted <= range.max) {
        score += 30; // Increased from 4
        scoreBreakdown["7_MintedRange"] = 30;
        break;
      }
    }
  }

  // 9. Serial number range match
  if (item.serial && profile.serialRanges.length > 0) {
    for (const range of profile.serialRanges) {
      if (item.serial >= range.min && item.serial <= range.max) {
        score += 30; // Increased from 4
        scoreBreakdown["8_SerialRange"] = 30;
        break;
      }
    }
  }

  // 10. Offer pattern match
  if (profile.offerTendencies.prefersUndervalued) {
    score += 15; // Increased from 2
    scoreBreakdown["9_OfferPattern"] = 15;
  }

  // Log high-scoring items for debugging
  if (score > 300) {
    console.log(`[marketplaceAlgorithm] Edition ${item.edition_id} score breakdown:`, scoreBreakdown, `Total: ${score}`);
  }

  return score;
}

/**
 * Checks if user has minimal marketplace activity
 */
export async function hasMinimalActivity(
  userAddress: string,
  activityThreshold: number = 5,
  signal?: AbortSignal,
): Promise<boolean> {
  try {
    const events = await fetchMarketplaceUserEvents(userAddress, signal);
    return events.length < activityThreshold;
  } catch (err) {
    console.error("[marketplaceAlgorithm] Error checking activity:", err);
    // Default to false (assume user has activity) on error
    return false;
  }
}

/**
 * Fetches edition popularity data based on marketplace activity volume and recency
 */
export async function fetchEditionPopularity(
  signal?: AbortSignal,
): Promise<Map<number, EditionPopularity>> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.error("[marketplaceAlgorithm] Missing Supabase configuration");
    return new Map();
  }

  return withSupabaseFallback(
    "edition-popularity",
    async () => {
      const root = baseUrl.replace(/\/$/, "");

      // Fetch all marketplace events (NewOffer, NewSale, NewBid) with edition and date info
      const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=in.("NewOffer","NewSale","NewBid")&select=edition_id,emitted_at&order=emitted_at.desc`;

      console.debug("[marketplaceAlgorithm] Fetching edition popularity from:", url);

      const response = await fetch(url, {
        headers: headers(anonKey),
        signal,
      });

      if (!response.ok) {
        const statusText = response.statusText || `HTTP ${response.status}`;
        const errorBody = await response.text().catch(() => "");
        console.error(
          `[marketplaceAlgorithm] API failed with ${response.status} ${statusText}`,
          { url, error: errorBody },
        );
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      let data: Array<any>;
      try {
        data = await response.json();
      } catch (parseErr: any) {
        if (parseErr.name === "AbortError") {
          console.debug("[marketplaceAlgorithm] Request was cancelled");
          return new Map();
        }
        console.error(
          "[marketplaceAlgorithm] Failed to parse response as JSON:",
          parseErr,
        );
        throw parseErr;
      }

      if (!Array.isArray(data)) {
        console.error("[marketplaceAlgorithm] Response data is not an array:", {
          data,
        });
        throw new Error("Response data is not an array");
      }

      // Aggregate by edition_id
      const popularityMap = new Map<number, EditionPopularity>();
      const now = new Date().getTime();

      for (const event of data) {
        const editionId = event.edition_id;
        const emittedAt = event.emitted_at;

        if (!editionId || !emittedAt) continue;

        const existing = popularityMap.get(editionId);
        const emittedMs = new Date(emittedAt).getTime();
        const ageMs = now - emittedMs;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        // Recency score: exponential decay (more recent = higher score)
        const recencyScore = Math.exp(-ageDays / 30); // Half-life of 30 days

        if (!existing) {
          popularityMap.set(editionId, {
            edition_id: editionId,
            total_activity_count: 1,
            most_recent_activity: emittedAt,
            activity_score: recencyScore,
          });
        } else {
          // Update with new data if this event is more recent
          const newScore = existing.activity_score + recencyScore;
          const mostRecentDate = new Date(existing.most_recent_activity);
          const currentDate = new Date(emittedAt);

          popularityMap.set(editionId, {
            ...existing,
            total_activity_count: existing.total_activity_count + 1,
            most_recent_activity:
              currentDate > mostRecentDate ? emittedAt : existing.most_recent_activity,
            activity_score: newScore,
          });
        }
      }

      console.debug(
        "[marketplaceAlgorithm] Calculated popularity for",
        popularityMap.size,
        "editions",
      );

      return popularityMap;
    },
    new Map(),
    "edition-popularity",
  );
}

/**
 * Sorts marketplace items by edition popularity (volume + recency)
 * Used as fallback when user has no marketplace activity
 * Uses grouped rankings: active listings/auctions first, then remaining items
 * Within each group, prioritizes items matching user's favorite team (case-insensitive)
 */
export async function sortMarketplaceByPopularity(
  items: MarketItem[],
  userAddress?: string,
  signal?: AbortSignal,
): Promise<MarketItem[]> {
  try {
    const popularityMap = await fetchEditionPopularity(signal);

    // Fetch user's favorite team if available
    let favoriteTeam: string | null = null;
    if (userAddress) {
      try {
        favoriteTeam = await getFavoriteTeam(userAddress);
        if (favoriteTeam) {
          console.log(`[marketplaceAlgorithm] User's favorite team: ${favoriteTeam}`);
        }
      } catch (err) {
        console.debug("[marketplaceAlgorithm] Error fetching favorite team:", err);
      }
    }

    // Separate items into two groups
    const activeItems = items.filter(item => item.hasActiveListing || item.hasActiveAuction);
    const inactiveItems = items.filter(item => !item.hasActiveListing && !item.hasActiveAuction);

    // Score both groups by popularity and favorite team
    const scoreByPopularity = async (item: MarketItem) => {
      const popularity = popularityMap.get(item.edition_id);
      const primaryScore = popularity?.activity_score || 0;
      const secondaryScore = popularity?.total_activity_count || 0;
      let totalScore = primaryScore * 100 + secondaryScore * 10;

      // Add bonus for favorite team match (case-insensitive)
      if (favoriteTeam) {
        // Fetch team data if not already on item
        if (!item.team && item.max_token_id) {
          const mintedData = await fetchMintedByEditionId(item.max_token_id, signal);
          if (mintedData && mintedData.team) {
            item.team = mintedData.team;
          }
        }

        // Case-insensitive comparison
        if (item.team && item.team.toLowerCase() === favoriteTeam.toLowerCase()) {
          totalScore += 10000; // Significant bonus to prioritize favorite team
          console.log(`[marketplaceAlgorithm] Favorite team bonus applied to edition ${item.edition_id} (${item.team})`);
        }
      }

      return totalScore;
    };

    const scoredActive = await Promise.all(
      activeItems.map(async (item) => ({
        item,
        score: await scoreByPopularity(item),
      }))
    );

    const scoredInactive = await Promise.all(
      inactiveItems.map(async (item) => ({
        item,
        score: await scoreByPopularity(item),
      }))
    );

    // Sort each group by score descending
    scoredActive.sort((a, b) => b.score - a.score);
    scoredInactive.sort((a, b) => b.score - a.score);

    // Combine: active items first, then inactive items
    const sortedItems = [...scoredActive, ...scoredInactive];

    // Log top 5 for debugging
    console.log("[marketplaceAlgorithm] Top 5 active listings/auctions (by popularity + favorite team):", scoredActive.slice(0, 5).map(x => ({
      edition_id: x.item.edition_id,
      team: x.item.team,
      score: x.score,
    })));

    console.log("[marketplaceAlgorithm] Top 5 inactive editions (by popularity + favorite team):", scoredInactive.slice(0, 5).map(x => ({
      edition_id: x.item.edition_id,
      team: x.item.team,
      score: x.score,
    })));

    return sortedItems.map((x) => x.item);
  } catch (err) {
    console.error("[marketplaceAlgorithm] Error sorting by popularity:", err);
    // Return items unsorted if error occurs
    return items;
  }
}

/**
 * Sorts marketplace items based on user behavior profile or popularity fallback
 * Uses three-tier grouping:
 * 1. Active listings/auctions (sorted by algorithm)
 * 2. Items with prior sales/history (sorted by algorithm)
 * 3. New items (sorted by algorithm)
 */
export async function sortMarketplaceByBehavior(
  items: MarketItem[],
  userAddress: string,
  signal?: AbortSignal,
): Promise<MarketItem[]> {
  try {
    // Analyze user behavior - include all users regardless of activity level
    const profile = await analyzeUserBehavior(userAddress, signal);

    // If user has no marketplace events at all, fall back to popularity sorting
    const events = await fetchMarketplaceUserEvents(userAddress, signal);
    if (events.length === 0) {
      console.log(
        "[marketplaceAlgorithm] User has no marketplace events, sorting by edition popularity with favorite team consideration",
      );
      return await sortMarketplaceByPopularity(items, userAddress, signal);
    }

    // Score all items in a single pass
    const scoredItems = await Promise.all(
      items.map(async (item) => ({
        item,
        score: await scoreMarketItem(item, profile, userAddress, signal),
      })),
    );

    // Separate items into three tiers
    const activeItems: typeof scoredItems = [];
    const priorSalesItems: typeof scoredItems = [];
    const newItems: typeof scoredItems = [];

    for (const scored of scoredItems) {
      const isActive = scored.item.hasActiveListing || scored.item.hasActiveAuction;
      const hasPriorSales = !isActive && scored.item.hasPriorSales;

      if (isActive) {
        activeItems.push(scored);
      } else if (hasPriorSales) {
        priorSalesItems.push(scored);
      } else {
        newItems.push(scored);
      }
    }

    // Sort each tier by score (descending - highest score first)
    activeItems.sort((a, b) => b.score - a.score);
    priorSalesItems.sort((a, b) => b.score - a.score);
    newItems.sort((a, b) => b.score - a.score);

    // Combine tiers: active first, then prior sales, then new
    const sortedItems = [...activeItems, ...priorSalesItems, ...newItems];

    // Log results for debugging
    console.log("[marketplaceAlgorithm] Sort criteria order: 1_PlayerName, 2_Team, 3_SetName, 4_Creator, 5_PriceRange, 6_GameDate, 7_MintedRange, 8_SerialRange, 9_OfferPattern");
    console.log(`[marketplaceAlgorithm] Tier breakdown: ${activeItems.length} active listings/auctions, ${priorSalesItems.length} items with prior sales, ${newItems.length} new items`);

    // Debug log for specific editions
    const debugEditions = [23, 24, 25];
    console.log("[marketplaceAlgorithm] DEBUG: Tier placement for editions 23, 24, 25:");
    for (const item of scoredItems) {
      if (debugEditions.includes(item.item.edition_id)) {
        const isActive = item.item.hasActiveListing || item.item.hasActiveAuction;
        const hasPriorSales = !isActive && item.item.hasPriorSales;
        const tier = isActive ? "ACTIVE" : hasPriorSales ? "PRIOR_SALES" : "NEW";
        console.log(`  Edition ${item.item.edition_id}: tier=${tier}, score=${item.score}, hasActiveListing=${item.item.hasActiveListing}, hasActiveAuction=${item.item.hasActiveAuction}, hasPriorSales=${item.item.hasPriorSales}`);
      }
    }

    const topActive = activeItems.slice(0, 3);
    const topPriorSales = priorSalesItems.slice(0, 3);
    const topNew = newItems.slice(0, 3);

    console.log("[marketplaceAlgorithm] Top 3 ACTIVE listings/auctions:", topActive.map(x => ({
      edition_id: x.item.edition_id,
      score: x.score,
      PlayerName: x.item.PlayerName,
      team: x.item.team,
    })));

    console.log("[marketplaceAlgorithm] Top 3 PRIOR SALES:", topPriorSales.map(x => ({
      edition_id: x.item.edition_id,
      score: x.score,
      PlayerName: x.item.PlayerName,
      team: x.item.team,
    })));

    console.log("[marketplaceAlgorithm] Top 3 NEW items:", topNew.map(x => ({
      edition_id: x.item.edition_id,
      score: x.score,
      PlayerName: x.item.PlayerName,
      team: x.item.team,
    })));

    return sortedItems.map((x) => x.item);
  } catch (err) {
    console.error("[marketplaceAlgorithm] Error sorting marketplace:", err);
    // Fallback to popularity sorting on error
    try {
      return await sortMarketplaceByPopularity(items, userAddress, signal);
    } catch (fallbackErr) {
      console.error("[marketplaceAlgorithm] Fallback sorting failed:", fallbackErr);
      return items;
    }
  }
}

/**
 * Gets detailed scoring breakdown for debugging/UI display
 */
export async function getItemScoreBreakdown(
  item: MarketItem,
  profile: UserBehaviorProfile,
  userAddress: string,
  signal?: AbortSignal,
): Promise<Record<string, number>> {
  const breakdown: Record<string, number> = {};

  // 1. PlayerName
  breakdown["playerNameMatch"] = 0;
  if (item.PlayerName && profile.favoritePlayerNames.has(item.PlayerName)) {
    const rawScore = profile.favoritePlayerNames.get(item.PlayerName) || 0;
    breakdown["playerNameMatch"] = 80 + Math.min(rawScore * 15, 100);
  }

  // 2. Team
  if (item.max_token_id && !item.team) {
    const mintedData = await fetchMintedByEditionId(item.max_token_id, signal);
    if (mintedData && mintedData.team) {
      item.team = mintedData.team;
    }
  }

  breakdown["teamMatch"] = 0;
  if (item.team && profile.favoriteTeams.has(item.team)) {
    const rawScore = profile.favoriteTeams.get(item.team) || 0;
    breakdown["teamMatch"] = 60 + Math.min(rawScore * 12, 80);
  }

  // 3. SetName
  breakdown["setNameMatch"] = 0;
  if (item.SetName && profile.favoriteSetNames.has(item.SetName)) {
    const rawScore = profile.favoriteSetNames.get(item.SetName) || 0;
    breakdown["setNameMatch"] = 50 + Math.min(rawScore * 10, 70);
  }

  // 4. Creator match
  breakdown["creatorMatch"] = 0;
  if (item.listing_creator && profile.favoriteListingCreators.has(item.listing_creator)) {
    const rawScore = profile.favoriteListingCreators.get(item.listing_creator) || 0;
    breakdown["creatorMatch"] += 40 + Math.min(rawScore * 8, 50);
  }
  if (item.auction_creator && profile.favoriteAuctionCreators.has(item.auction_creator)) {
    const rawScore = profile.favoriteAuctionCreators.get(item.auction_creator) || 0;
    breakdown["creatorMatch"] += 40 + Math.min(rawScore * 8, 50);
  }

  // 5. Price range
  breakdown["priceRangeMatch"] = 0;
  if (item.price && profile.priceRanges.length > 0) {
    for (const range of profile.priceRanges) {
      if (item.price >= range.min && item.price <= range.max) {
        breakdown["priceRangeMatch"] = 45;
        break;
      }
    }
  }

  // 6 & 7. GameDate
  if (item.max_token_id && item.GameDate === undefined) {
    const mintedData = await fetchMintedByEditionId(item.max_token_id, signal);
    if (mintedData && mintedData.GameDate) {
      item.GameDate = mintedData.GameDate;
    }
  }

  breakdown["gameDateMatch"] = 0;
  if (item.GameDate) {
    const gameDateMs = new Date(item.GameDate).getTime();
    const nowMs = new Date().getTime();
    const daysDiffFromToday =
      (nowMs - gameDateMs) / (1000 * 60 * 60 * 24);

    if (profile.gameDatePreference === "recent") {
      if (daysDiffFromToday < 30) {
        breakdown["gameDateMatch"] = 35;
      } else if (daysDiffFromToday < 90) {
        breakdown["gameDateMatch"] = 20;
      }
    } else if (profile.gameDatePreference === "historic") {
      if (daysDiffFromToday > 365) {
        breakdown["gameDateMatch"] = 35;
      } else if (daysDiffFromToday > 180) {
        breakdown["gameDateMatch"] = 20;
      }
    }
  }

  // 8. Minted range
  breakdown["mintedRangeMatch"] = 0;
  if (item.Minted && profile.mintedRanges.length > 0) {
    for (const range of profile.mintedRanges) {
      if (item.Minted >= range.min && item.Minted <= range.max) {
        breakdown["mintedRangeMatch"] = 30;
        break;
      }
    }
  }

  // 9. Serial range
  breakdown["serialRangeMatch"] = 0;
  if (item.serial && profile.serialRanges.length > 0) {
    for (const range of profile.serialRanges) {
      if (item.serial >= range.min && item.serial <= range.max) {
        breakdown["serialRangeMatch"] = 30;
        break;
      }
    }
  }

  // 10. Offer pattern
  breakdown["offerPatternMatch"] = profile.offerTendencies.prefersUndervalued
    ? 15
    : 0;

  return breakdown;
}
