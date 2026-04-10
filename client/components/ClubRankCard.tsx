import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getFavoriteTeam } from "@/lib/favoriteTeamService";
import {
  fetchRecentTeamMessages,
  type ChatMessage,
} from "@/lib/clubhouseChatService";

interface ClubRankCardProps {
  followerAddress?: string;
}

export default function ClubRankCard({ followerAddress }: ClubRankCardProps) {
  const account = useActiveAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const currentMessage = messages[currentIndex];

  useEffect(() => {
    const loadTeamMessages = async () => {
      setIsLoading(true);
      try {
        if (!account?.address) {
          setMessages([]);
          return;
        }

        const favoriteTeam = await getFavoriteTeam(account.address);
        if (!favoriteTeam) {
          setMessages([]);
          return;
        }

        const recentMessages = await fetchRecentTeamMessages(favoriteTeam, 10);
        setMessages(recentMessages);
      } catch (error) {
        // Silently handle error
        setMessages([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTeamMessages();
  }, [account?.address]);

  // Cycle through messages every 5 seconds
  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % messages.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [messages]);

  if (isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!messages || messages.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center px-0.5 py-3 bg-white">
        <div className="text-center flex flex-col items-center justify-center">
          <p className="text-xs text-slate-600 px-2">
            Chat with fellow fans and collectors!
          </p>
          <img
            src="/images/chat.jpg"
            alt="Chat emoji"
            className="flex-1 w-full object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-white">
      {/* Chat Message Content */}
      <div className="text-center flex flex-col gap-2 h-full justify-center">
        {/* Message in quotes and italic */}
        <div className="flex-1 flex items-center justify-center min-h-0">
          <p className="text-[9px] italic text-slate-600 max-lg:text-black break-words line-clamp-4">
            "{currentMessage?.message}"
          </p>
        </div>

        {/* Username */}
        <div className="text-[11px] font-semibold max-lg:font-light max-lg:text-gray-600 text-slate-800">
          {currentMessage?.username}
        </div>
      </div>

      {/* Pagination dots */}
      {messages.length > 1 && (
        <div className="flex gap-1 justify-center mt-2">
          {messages.map((_, index) => (
            <div
              key={index}
              className={`h-1 w-1 rounded-full transition-all ${
                index === currentIndex ? "bg-slate-700" : "bg-slate-300"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
