import { useEffect, useState, useRef } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getFavoriteTeam } from "@/lib/favoriteTeamService";
import {
  fetchAllRecentMessages,
  type ChatMessage,
} from "@/lib/clubhouseChatService";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
  type RMVPerOwnerRecord,
} from "@/lib/rmvPerOwner";
import {
  fetchMarketplaceEvents,
  enrichEventWithRelicData,
} from "@/lib/marketplaceEvents";
import FolloweeCarouselCard from "@/components/FolloweeCarouselCard";
import ClubRankCard from "@/components/ClubRankCard";
import RecentTransactionsCard from "@/components/RecentTransactionsCard";

interface MyClubCardProps {
  followerAddress?: string;
  isFullPage?: boolean;
}

export default function MyClubCard({ followerAddress, isFullPage = false }: MyClubCardProps) {
  const account = useActiveAccount();
  const [favoriteTeam, setFavoriteTeam] = useState<string | null>(null);
  const [allChats, setAllChats] = useState<ChatMessage[]>([]);
  const [currentChatIndex, setCurrentChatIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [rmvData, setRmvData] = useState<RMVPerOwnerRecord[]>([]);
  const [hasMarketplaceEvents, setHasMarketplaceEvents] = useState(false);

  // Track whether we've already attempted to fetch marketplace events
  const marketplaceEventsFetchAttemptedRef = useRef(false);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (!account?.address) {
          setFavoriteTeam(null);
          setAllChats([]);
          setRmvData([]);
          return;
        }

        const team = await getFavoriteTeam(account.address);
        setFavoriteTeam(team);

        // Always fetch all recent messages for the non-favorite-team state
        const messages = await fetchAllRecentMessages(10);
        setAllChats(messages);

        // Fetch all RMV data to look up badge info for chat message senders
        const rmvRecords = await fetchRMVPerOwner();
        setRmvData(rmvRecords);
      } catch (error) {
        setFavoriteTeam(null);
        setAllChats([]);
        setRmvData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [account?.address]);

  // Check if there are marketplace events for the favorite team (one-time fetch with retries)
  useEffect(() => {
    const checkMarketplaceEvents = async () => {
      if (!favoriteTeam || !account?.address) {
        setHasMarketplaceEvents(false);
        return;
      }

      // Only fetch once per component mount
      if (marketplaceEventsFetchAttemptedRef.current) {
        return;
      }

      marketplaceEventsFetchAttemptedRef.current = true;

      // Retry logic: allow 2 retries with 1 second delay between attempts
      const maxAttempts = 3;
      let lastError: Error | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
          const allEvents = await fetchMarketplaceEvents();
          const enrichedEvents = await Promise.all(
            allEvents.map((event) => enrichEventWithRelicData(event)),
          );

          const filteredEvents = enrichedEvents.filter(
            (event) => event.team === favoriteTeam,
          );

          setHasMarketplaceEvents(filteredEvents.length > 0);
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          // If this wasn't the last attempt, wait 1 second before retrying
          if (attempt < maxAttempts - 1) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      // If all attempts failed, log once and don't retry
      if (lastError) {
        console.error("[MyClubCard] Failed to fetch marketplace events after retries:", lastError.message);
      }
      setHasMarketplaceEvents(false);
    };

    checkMarketplaceEvents();
  }, [favoriteTeam, account?.address]);

  // Cycle through chats every 5 seconds
  useEffect(() => {
    if (allChats.length === 0 || favoriteTeam) return;

    const interval = setInterval(() => {
      setCurrentChatIndex((prev) => (prev + 1) % allChats.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [allChats, favoriteTeam]);

  // Get badge image path for a wallet address
  const getBadgeForWallet = (walletAddress: string): string | null => {
    const userRmv = findRMVByOwner(rmvData, walletAddress);
    if (!userRmv) return null;

    const rankLevel = calculateRankLevel(userRmv.Percentile);

    // Only return badge for Diamond, Epic, Rare, and Basic
    if (rankLevel === "Diamond") {
      return "/images/diamondbadge.png";
    } else if (rankLevel === "Epic") {
      return "/images/epicbadge.png";
    } else if (rankLevel === "Rare") {
      return "/images/rarebadge.png";
    } else if (rankLevel === "Basic") {
      return "/images/basicbadge.png";
    }
    // Beginner and Spectator get no badge
    return null;
  };

  if (isLoading) {
    return (
      <div className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 items-stretch gap-3 px-3">
        <div className="w-full flex items-center justify-center">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If favorite_team is set, show the carousel cards
  if (favoriteTeam) {
    return (
      <div className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 items-stretch gap-0.5 px-3">
        <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col items-center px-[2px]">
          <div className="relative w-full flex-1 rounded-none border border-slate-200 overflow-hidden">
            <FolloweeCarouselCard followerAddress={account?.address} />
          </div>
        </div>
        <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col items-center px-[2px]">
          <div className="relative w-full flex-1 rounded-none border border-slate-200 bg-slate-100 overflow-hidden">
            <ClubRankCard followerAddress={account?.address} />
          </div>
        </div>
        {/* Only render RecentTransactionsCard wrapper if there are marketplace events */}
        {hasMarketplaceEvents && (
          <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col items-center px-[2px]">
            <div className="relative w-full flex-1 rounded-none border border-slate-200 bg-slate-100 overflow-hidden">
              <RecentTransactionsCard followerAddress={account?.address} />
            </div>
          </div>
        )}
      </div>
    );
  }

  // If favorite_team is null, show cycling chats on left and instructional text on right
  const currentChat = allChats[currentChatIndex];

  return (
    <div className="mt-0 mb-[5px] flex h-full w-full min-h-0 flex-1 items-stretch gap-[2px] px-0 mx-2">
      {/* Left two thirds: Instructional text */}
      <div className="flex h-full flex-[2] min-h-0 min-w-0 flex-col items-center px-[2px]">
        <div className="relative w-full flex-1 rounded-none bg-white overflow-hidden p-6 flex items-center justify-center">
          <p className="text-[12px] font-normal text-slate-700 text-center leading-relaxed">
            Enter here, chose a favorite team, and join your Club to chat and
            follow along!
          </p>
        </div>
      </div>

      {/* Right third: Cycling chats - only render if there are messages */}
      {allChats.length > 0 && (
        <div className="flex h-full flex-1 min-h-0 min-w-0 flex-col items-center px-[2px]">
          <div className="relative w-full flex-1 rounded-none border border-slate-200 bg-white overflow-hidden py-3 px-[2px] flex flex-col justify-center shadow-[1px_1px_3px_1px_rgb(155,155,155)]">
            {currentChat ? (
              <div className="flex flex-col gap-[2px] text-center">
                {/* Message */}
                <p className="w-full flex items-center justify-center grow text-[9px] italic text-slate-600 break-words line-clamp-4">
                  "{currentChat.message}"
                </p>

                {/* User rank badge */}
                {currentChat &&
                  (() => {
                    const badge = getBadgeForWallet(currentChat.wallet_address);
                    return badge ? (
                      <div className="flex justify-center">
                        <img
                          src={badge}
                          alt="User rank badge"
                          className="h-6 w-6 object-contain"
                        />
                      </div>
                    ) : null;
                  })()}

                {/* Username */}
                <p className="text-[10px] font-light text-slate-600">
                  {currentChat.username}
                </p>

                {/* Pagination dots */}
                {allChats.length > 1 && (
                  <div className="flex gap-1 justify-center mt-2">
                    {allChats.map((_, index) => (
                      <div
                        key={index}
                        className={`h-1 w-1 rounded-full transition-all ${
                          index === currentChatIndex
                            ? "bg-slate-700"
                            : "bg-slate-300"
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
