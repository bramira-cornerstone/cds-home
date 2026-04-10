import { useEffect, useState, useRef } from "react";

import { toast } from "sonner";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import {
  fetchRMVPerOwner,
  findRMVByOwner,
  calculateRankLevel,
} from "@/lib/rmvPerOwner";
import { fetchLatestClubhouseAlert } from "@/lib/clubhouseAlerts";
import { useChatPolling } from "@/contexts/ChatPollingContext";
import { usePageVisibility } from "@/hooks/usePageVisibility";

interface ClubhouseAlert {
  id: number;
  created_at: string;
  message: string;
}

// Emojis: 8 priority + 8 emotion + 8 sports themed
const CHAT_EMOJIS = [
  // Priority emojis
  "👍",
  "🤝",
  "👑",
  "👏",
  "🎉",
  "⚽️",
  "💯",
  "👀",
  // Common emotions (non-romantic)
  "😂",
  "😎",
  "🔥",
  "😠",
  "👎",
  "🤔",
  "😲",
  "🤯",
  // Sports themed
  "🏆",
  "💪",
  "🎯",
  "📺",
  "🤗",
  "🚀",
  "😭",
  "🚩",
];

function getRankBadgeImage(rankLevel: string): string {
  switch (rankLevel) {
    case "Diamond":
      return "/images/diamondbadge.png";
    case "Epic":
      return "/images/epicbadge.png";
    case "Rare":
      return "/images/rarebadge.png";
    case "Basic":
      return "/images/basicbadge.png";
    default:
      return "";
  }
}

interface UserRankBadgeProps {
  walletAddress: string;
}

function UserRankBadge({ walletAddress }: UserRankBadgeProps) {
  const [rankLevel, setRankLevel] = useState<string | null>(null);

  useEffect(() => {
    const fetchRankLevel = async () => {
      try {
        const rmvData = await fetchRMVPerOwner();
        const matched = findRMVByOwner(rmvData, walletAddress);
        if (matched) {
          const level = calculateRankLevel(matched.Percentile);
          setRankLevel(level);
        }
      } catch (err) {
        console.debug("Error fetching rank level for user:", err);
      }
    };

    fetchRankLevel();
  }, [walletAddress]);

  if (!rankLevel || rankLevel === "Spectator" || rankLevel === "Beginner") {
    return null;
  }

  const badgeImage = getRankBadgeImage(rankLevel);
  if (!badgeImage) return null;

  return (
    <img
      src={badgeImage}
      alt={`${rankLevel} rank badge`}
      className="w-[20px] h-[20px] object-contain flex-shrink-0"
      title={`${rankLevel} tier`}
    />
  );
}

interface MessageThumbsProps {
  messageId: number;
  thumbsUp: number;
  thumbsDown: number;
  userVoted?: "up" | "down" | null;
  onVote: (messageId: number, type: "up" | "down") => Promise<void>;
}

function MessageThumbs({
  messageId,
  thumbsUp,
  thumbsDown,
  userVoted,
  onVote,
}: MessageThumbsProps) {
  const [voting, setVoting] = useState(false);
  const isDisabled = userVoted !== null && userVoted !== undefined;

  const handleVote = async (type: "up" | "down") => {
    if (isDisabled || voting) return;
    setVoting(true);
    try {
      await onVote(messageId, type);
    } finally {
      setVoting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => handleVote("up")}
        disabled={isDisabled || voting}
        className={`inline-flex items-center gap-0.5 ml-2 transition-all ${
          isDisabled || voting
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-80"
        }`}
        aria-label="Thumbs up"
      >
        <ThumbsUp
          size={14}
          className={`${
            userVoted === "up"
              ? "fill-[#FF6300] text-[#FF6300]"
              : "text-slate-400"
          }`}
        />
        {thumbsUp > 0 && (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {thumbsUp}
          </span>
        )}
      </button>

      <button
        onClick={() => handleVote("down")}
        disabled={isDisabled || voting}
        className={`inline-flex items-center gap-0.5 ml-1 transition-all ${
          isDisabled || voting
            ? "opacity-50 cursor-not-allowed"
            : "hover:opacity-80"
        }`}
        aria-label="Thumbs down"
      >
        <ThumbsDown
          size={14}
          className={`${
            userVoted === "down"
              ? "fill-[#FF6300] text-[#FF6300]"
              : "text-slate-400"
          }`}
        />
        {thumbsDown > 0 && (
          <span className="text-xs text-slate-600 dark:text-slate-400">
            {thumbsDown}
          </span>
        )}
      </button>
    </>
  );
}

interface ChatMessage {
  id: number;
  team: string;
  wallet_address: string;
  username: string;
  created_at: string;
  message: string;
  thumbsUp?: number;
  thumbsDown?: number;
}

interface ClubhouseChatProps {
  team: string;
  title?: string;
}

// Parse banned usernames from environment
const getBannedUsernames = (): Set<string> => {
  const bannedEnv = (import.meta as any).env.VITE_BANNED_USERNAMES as
    | string
    | undefined;
  if (!bannedEnv) return new Set();

  try {
    // Environment variable is a JSON string of comma-separated names
    const parsed = JSON.parse(bannedEnv) as string[];
    return new Set(parsed.map((name) => name.toLowerCase()));
  } catch {
    return new Set();
  }
};

const validateMessage = (
  message: string,
): { valid: boolean; error?: string } => {
  const bannedUsernames = getBannedUsernames();
  const lowerMessage = message.toLowerCase();

  for (const banned of bannedUsernames) {
    if (lowerMessage.includes(banned)) {
      return {
        valid: false,
        error: "Your message contains prohibited content",
      };
    }
  }

  return { valid: true };
};

const isDesktopBrowser = (): boolean => {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent.toLowerCase();
  const isMobile =
    /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
  return !isMobile;
};

export default function ClubhouseChat({ team, title }: ClubhouseChatProps) {
  const account = useActiveAccount();
  const { registerTeam, unregisterTeam } = useChatPolling();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userVotes, setUserVotes] = useState<Record<number, "up" | "down">>({});
  const [throttleError, setThrottleError] = useState(false);
  const [latestAlert, setLatestAlert] = useState<ClubhouseAlert | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimestampRef = useRef<number>(0);
  const throttleErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseUrlRef = useRef<string | undefined>(
    (import.meta as any).env.SUPABASE_URL,
  );
  const anonKeyRef = useRef<string | undefined>(
    (import.meta as any).env.SUPABASE_ANON_KEY,
  );

  // Detect desktop browser on mount
  useEffect(() => {
    setIsDesktop(isDesktopBrowser());
  }, []);

  // Clear and restore user votes from localStorage
  useEffect(() => {
    if (!account?.address) {
      setUserVotes({});
      return;
    }

    // Clear cached votes to start fresh
    const votesCacheKey = `clubhouse-votes-${account.address}`;
    try {
      localStorage.removeItem(votesCacheKey);
      setUserVotes({});
      console.debug("Cleared cached votes for fresh retest");
    } catch (err) {
      console.debug("Failed to clear votes from localStorage:", err);
    }
  }, [account?.address]);

  // Fetch username
  useEffect(() => {
    const fetchUsername = async () => {
      if (!account?.address) {
        setUsername(null);
        return;
      }

      try {
        const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
        const key = anonKeyRef.current;

        if (!baseUrl || !key) return;

        const res = await fetch(
          `${baseUrl}/rest/v1/profiles?wallet_address=eq.${account.address}&select=username`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const profiles = await res.json();
          if (Array.isArray(profiles) && profiles.length > 0) {
            setUsername(profiles[0].username);
          }
        }
      } catch (err) {
      }
    };

    fetchUsername();
  }, [account?.address]);

  // Fetch latest alert
  const fetchAlert = async () => {
    const baseUrl = supabaseUrlRef.current;
    const key = anonKeyRef.current;

    if (!baseUrl || !key) return;

    const alert = await fetchLatestClubhouseAlert(baseUrl, key);
    setLatestAlert(alert);
  };

  useEffect(() => {
    // Initial fetch
    fetchAlert();
  }, []);

  // Poll for new alerts every 10 seconds, but only when page is visible
  usePageVisibility(() => {
    const alertIntervalId = setInterval(() => {
      fetchAlert();
    }, 10000);
    return alertIntervalId;
  }, []);

  // Fetch initial messages and register for polling
  useEffect(() => {
    let isMounted = true;

    const initializeChat = async () => {
      try {
        setLoading(true);
        const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
        const key = anonKeyRef.current;

        if (!baseUrl || !key) {
          console.warn("Supabase not configured");
          setLoading(false);
          return;
        }

        // Fetch initial messages
        const res = await fetch(
          `${baseUrl}/rest/v1/clubhousechats?team=eq.${encodeURIComponent(team)}&order=created_at.asc&limit=50`,
          {
            headers: {
              apikey: key,
              Authorization: `Bearer ${key}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            const messagesData = Array.isArray(data) ? data : [];
            setMessages(messagesData);

            // Register this team for polling and provide callback for new messages
            // Initialize with the max ID from initial load to avoid duplicates
            const maxInitialId =
              messagesData.length > 0
                ? Math.max(...messagesData.map((m) => m.id))
                : 0;

            const handleNewMessages = (newMessages: ChatMessage[]) => {
              if (isMounted) {
                setMessages((prev) => [...prev, ...newMessages]);
              }
            };

            const handleMessageUpdates = (
              updates: Record<number, Partial<ChatMessage>>,
            ) => {
              if (isMounted) {
                setMessages((prev) =>
                  prev.map((msg) => {
                    if (updates[msg.id]) {
                      return { ...msg, ...updates[msg.id] };
                    }
                    return msg;
                  }),
                );
              }
            };

            const handleMessageDeleted = (deletedIds: number[]) => {
              if (isMounted) {
                setMessages((prev) =>
                  prev.filter((msg) => !deletedIds.includes(msg.id)),
                );
              }
            };

            registerTeam(
              team,
              handleNewMessages,
              handleMessageUpdates,
              handleMessageDeleted,
              maxInitialId,
            );
          }
        } else if (res.status === 404) {
          console.warn(
            "Clubhouse chats table not found - migration may not be applied yet",
          );
          // Still register even if no messages yet
          registerTeam(team, () => {}, undefined, undefined, 0);
        } else {
          console.error(
            "Failed to fetch messages:",
            res.status,
            res.statusText,
          );
          // Still register even on error
          registerTeam(team, () => {}, undefined, undefined, 0);
        }
      } catch (err) {
        // Still register even on error
        registerTeam(team, () => {}, undefined, undefined, 0);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeChat();

    return () => {
      isMounted = false;
      unregisterTeam(team);
    };
  }, [team, registerTeam, unregisterTeam]);

  const handleVoteMessage = async (
    messageId: number,
    voteType: "up" | "down",
  ) => {
    if (!account?.address) {
      toast.error("Please connect your wallet to vote");
      return;
    }

    try {
      const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
      const key = anonKeyRef.current;

      if (!baseUrl || !key) {
        toast.error("Supabase configuration missing");
        return;
      }

      // Find the message to update
      const messageIndex = messages.findIndex((m) => m.id === messageId);
      if (messageIndex === -1) return;

      const message = messages[messageIndex];
      const updateField = voteType === "up" ? "thumbsUp" : "thumbsDown";
      const newValue =
        ((message[updateField as keyof ChatMessage] as number) || 0) + 1;

      // Update the database
      const response = await fetch(
        `${baseUrl}/rest/v1/clubhousechats?id=eq.${messageId}`,
        {
          method: "PATCH",
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            [updateField]: newValue,
          }),
        },
      );

      if (response.ok) {
        // Update local state
        const newVotes = {
          ...userVotes,
          [messageId]: voteType,
        };
        setUserVotes(newVotes);

        // Persist to localStorage
        try {
          localStorage.setItem(
            `clubhouse-votes-${account.address}`,
            JSON.stringify(newVotes),
          );
        } catch (storageErr) {
          console.debug("Failed to persist votes to localStorage:", storageErr);
        }

        // Update message in state
        setMessages((prev) => {
          const updated = [...prev];
          updated[messageIndex] = {
            ...updated[messageIndex],
            [updateField]: newValue,
          };
          return updated;
        });
      } else {
        if (response.status >= 500) {
          console.error("Failed to vote:", response.status);
        }
        toast.error("Failed to vote on message");
      }
    } catch (err) {
      console.error("Error voting on message:", err);
      toast.error("Error voting on message");
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || !account?.address || !username) {
      return;
    }

    // Check throttle (1 message per 10 seconds)
    const now = Date.now();
    const timeSinceLastMessage = now - lastMessageTimestampRef.current;
    const THROTTLE_DURATION = 10000; // 10 seconds

    if (timeSinceLastMessage < THROTTLE_DURATION) {
      // Show throttle error
      setThrottleError(true);

      // Clear previous timeout if exists
      if (throttleErrorTimeoutRef.current) {
        clearTimeout(throttleErrorTimeoutRef.current);
      }

      // Auto-hide after 3 seconds
      throttleErrorTimeoutRef.current = setTimeout(() => {
        setThrottleError(false);
      }, 3000);

      return;
    }

    // Validate message
    const validation = validateMessage(input);
    if (!validation.valid) {
      toast.error(validation.error || "Message contains prohibited content");
      return;
    }

    try {
      setSending(true);
      const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
      const key = anonKeyRef.current;

      if (!baseUrl || !key) {
        toast.error("Supabase configuration missing");
        return;
      }

      const response = await fetch(`${baseUrl}/rest/v1/clubhousechats`, {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          Prefer: "return=representation",
        },
        body: JSON.stringify({
          team,
          wallet_address: account.address,
          username,
          message: input.trim(),
        }),
      });

      if (!response.ok) {
        if (response.status >= 500) {
          const errorData = await response.text().catch(() => "Unknown error");
          console.error("API Response Error:", response.status, errorData);
        }
        throw new Error(`Failed to send message: ${response.statusText}`);
      }

      // Update last message timestamp on successful send
      lastMessageTimestampRef.current = now;
      toast.success("Message sent!");
      setInput("");
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to send message";
      toast.error(errorMessage);
    } finally {
      setSending(false);
    }
  };

  if (!account?.address) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-center">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Please connect your wallet to chat
        </p>
      </div>
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Loading chat...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-500">
              If this takes too long, the clubhouse chats table may not be set
              up. Please ensure the SQL migration has been applied in the
              Supabase dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden max-h-[800px]">
      {title && (
        <div className="px-4 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700 max-lg:pt-3">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
            {title}
          </h2>
        </div>
      )}
      {/* Messages Container */}
      <div className="flex-1 flex flex-col h-80 overflow-y-auto bg-white dark:bg-slate-800">
        {/* Frozen Alert Pane */}
        {latestAlert && (
          <div className="sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 lg:p-4">
            <div className="relative overflow-hidden rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-700 p-3 shadow-[0_5px_0_0_rgba(226,232,240,1)] dark:shadow-[0_5px_0_0_rgba(0,0,0,1)]">
              {/* Gradient overlay - base */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(to bottom right, rgba(65, 105, 225, 0.1) 0%, rgba(65, 105, 225, 0) 40%, rgba(255, 165, 0, 0) 60%, rgba(255, 165, 0, 0.1) 100%)",
                }}
              />

              {/* Content */}
              <div className="relative z-[1] flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Cornerstone Digital Sports
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(latestAlert.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-200 break-words">
                  {latestAlert.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 gap-3 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Loading messages...
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No messages yet. Be the first to chat!
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {msg.username}
                  </span>
                  <UserRankBadge walletAddress={msg.wallet_address} />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex items-center flex-wrap">
                  <p className="text-sm text-slate-700 dark:text-slate-200 break-words inline">
                    {msg.message}
                  </p>
                  <MessageThumbs
                    messageId={msg.id}
                    thumbsUp={msg.thumbsUp || 0}
                    thumbsDown={msg.thumbsDown || 0}
                    userVoted={userVotes[msg.id]}
                    onVote={handleVoteMessage}
                  />
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={input}
            onChange={(e) => {
              const newValue = e.target.value;
              setInput(newValue);
            }}
            onFocus={() => {
              // Show emoji picker on desktop when input is focused
              if (isDesktop) {
                setShowEmojiPicker(true);
              }
            }}
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            onBlur={() => {
              // Hide emoji picker when input loses focus
              setTimeout(() => setShowEmojiPicker(false), 200);
            }}
            placeholder="Type a message..."
            disabled={sending || !username}
            className="flex-1 px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !input.trim() || !username}
            className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>

        {/* Emoji Picker (Desktop only) */}
        {isDesktop && showEmojiPicker && (
          <div className="animate-in slide-in-from-top grid grid-cols-12 gap-0 pb-2 w-full">
            {CHAT_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  setInput((prev) => prev + emoji);
                }}
                className="text-xl hover:outline hover:outline-2 hover:outline-black dark:hover:outline-white transition-all p-1 flex items-center justify-center"
                aria-label={`Insert emoji ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Throttle Error Message */}
        {throttleError && (
          <div className="animate-in slide-in-from-top mt-2 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-sm text-red-700 dark:text-red-300">
            One message per collector every 10 seconds
          </div>
        )}
      </div>
    </div>
  );
}
