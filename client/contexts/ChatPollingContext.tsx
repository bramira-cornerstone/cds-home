import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";

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

interface TeamPollingState {
  lastFetch: number;
  maxId: number;
  messageSnapshots: Record<number, Partial<ChatMessage>>;
}

interface ChatPollingContextType {
  registerTeam: (
    team: string,
    onMessagesReceived: (messages: ChatMessage[]) => void,
    onMessageUpdates?: (updates: Record<number, Partial<ChatMessage>>) => void,
    onMessageDeleted?: (messageIds: number[]) => void,
    initialMaxId?: number,
  ) => void;
  unregisterTeam: (team: string) => void;
  isPolling: boolean;
}

const ChatPollingContext = createContext<ChatPollingContextType | undefined>(
  undefined,
);

export const ChatPollingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [registeredTeams, setRegisteredTeams] = useState<
    Map<
      string,
      {
        onNew: (messages: ChatMessage[]) => void;
        onUpdate?: (updates: Record<number, Partial<ChatMessage>>) => void;
        onDelete?: (messageIds: number[]) => void;
      }
    >
  >(new Map());
  const [teamPollingState, setTeamPollingState] = useState<
    Record<string, TeamPollingState>
  >({});
  const [isPolling, setIsPolling] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const supabaseUrlRef = useRef<string | undefined>(
    (import.meta as any).env.SUPABASE_URL,
  );
  const anonKeyRef = useRef<string | undefined>(
    (import.meta as any).env.SUPABASE_ANON_KEY,
  );

  // Validate configuration on mount
  useEffect(() => {
    const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
    const key = anonKeyRef.current;

    if (!baseUrl || !baseUrl.trim() || !key || !key.trim()) {
      console.error(
        "ChatPollingProvider: Supabase configuration is missing or empty. Check SUPABASE_URL and SUPABASE_ANON_KEY.",
      );
      setIsConfigured(false);
      return;
    }

    setIsConfigured(true);
  }, []);

  const registerTeam = useCallback(
    (
      team: string,
      onMessagesReceived: (messages: ChatMessage[]) => void,
      onMessageUpdates?: (
        updates: Record<number, Partial<ChatMessage>>,
      ) => void,
      onMessageDeleted?: (messageIds: number[]) => void,
      initialMaxId: number = 0,
    ) => {
      setRegisteredTeams((prev) =>
        new Map(prev).set(team, {
          onNew: onMessagesReceived,
          onUpdate: onMessageUpdates,
          onDelete: onMessageDeleted,
        }),
      );
      setTeamPollingState((prev) => ({
        ...prev,
        [team]: prev[team] || {
          lastFetch: Date.now(),
          maxId: initialMaxId,
          messageSnapshots: {},
        },
      }));
    },
    [],
  );

  const unregisterTeam = useCallback((team: string) => {
    setRegisteredTeams((prev) => {
      const newMap = new Map(prev);
      newMap.delete(team);
      return newMap;
    });
  }, []);

  const pollMessages = useCallback(async () => {
    if (registeredTeams.size === 0) {
      return;
    }

    if (!isConfigured) {
      return;
    }

    const baseUrl = supabaseUrlRef.current?.replace(/\/$/, "");
    const key = anonKeyRef.current;

    if (!baseUrl || !baseUrl.trim() || !key || !key.trim()) {
      console.warn("Supabase not properly configured for polling", {
        baseUrl: !!baseUrl,
        key: !!key,
      });
      return;
    }

    setIsPolling(true);

    try {
      const currentTeams = Array.from(registeredTeams.keys());

      for (const team of currentTeams) {
        try {
          const state = teamPollingState[team] || {
            lastFetch: Date.now(),
            maxId: 0,
            messageSnapshots: {},
          };

          if (!team) {
            console.warn("Empty team name in polling");
            continue;
          }

          const url = `${baseUrl}/rest/v1/clubhousechats?team=eq.${encodeURIComponent(team)}&order=created_at.asc&limit=100`;

          try {
            let res: Response;
            try {
              res = await fetch(url, {
                method: "GET",
                headers: {
                  apikey: key,
                  Authorization: `Bearer ${key}`,
                  "Content-Type": "application/json",
                },
              });
            } catch (fetchErr) {
              console.error(
                `[ChatPolling] Network error fetching for team "${team}":`,
                fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
              );
              continue;
            }

            if (!res.ok) {
              // Only log 5xx server errors, not client errors or redirects
              if (res.status >= 500) {
                console.error(
                  `[ChatPolling] Server error polling messages for team ${team}: HTTP ${res.status}`,
                );
              }
              continue;
            }

            const allMessages = (await res.json()) as ChatMessage[];

            // Separate new messages from existing ones
            const newMessages = allMessages.filter(
              (msg) => msg.id > state.maxId,
            );
            const existingMessages = allMessages.filter(
              (msg) => msg.id <= state.maxId,
            );

            // Detect updates to existing messages (e.g., vote count changes)
            const updates: Record<number, Partial<ChatMessage>> = {};
            for (const msg of existingMessages) {
              const snapshot = state.messageSnapshots[msg.id];
              if (snapshot) {
                // Check if thumbsUp or thumbsDown changed
                if (
                  snapshot.thumbsUp !== msg.thumbsUp ||
                  snapshot.thumbsDown !== msg.thumbsDown
                ) {
                  updates[msg.id] = {
                    thumbsUp: msg.thumbsUp,
                    thumbsDown: msg.thumbsDown,
                  };
                }
              }
            }

            // Detect deleted messages
            const currentMessageIds = new Set(allMessages.map((m) => m.id));
            const deletedMessageIds: number[] = [];
            for (const snapshotId of Object.keys(state.messageSnapshots)) {
              const id = parseInt(snapshotId, 10);
              if (!currentMessageIds.has(id)) {
                deletedMessageIds.push(id);
              }
            }

            // Create new snapshots for all messages
            const newSnapshots: Record<number, Partial<ChatMessage>> = {};
            for (const msg of allMessages) {
              newSnapshots[msg.id] = {
                thumbsUp: msg.thumbsUp,
                thumbsDown: msg.thumbsDown,
              };
            }

            if (
              newMessages.length > 0 ||
              Object.keys(updates).length > 0 ||
              deletedMessageIds.length > 0
            ) {
              // Update the polling state for this team
              const maxNewId =
                allMessages.length > 0
                  ? Math.max(...allMessages.map((m) => m.id), state.maxId)
                  : state.maxId;

              setTeamPollingState((prev) => ({
                ...prev,
                [team]: {
                  lastFetch: Date.now(),
                  maxId: maxNewId,
                  messageSnapshots: newSnapshots,
                },
              }));

              // Notify callbacks
              const callbacks = registeredTeams.get(team);
              if (callbacks) {
                if (newMessages.length > 0) {
                  callbacks.onNew(newMessages);
                }
                if (Object.keys(updates).length > 0 && callbacks.onUpdate) {
                  callbacks.onUpdate(updates);
                }
                if (deletedMessageIds.length > 0 && callbacks.onDelete) {
                  callbacks.onDelete(deletedMessageIds);
                }
              }
            } else {
              // Update last fetch time and snapshots even if no changes
              setTeamPollingState((prev) => ({
                ...prev,
                [team]: {
                  ...state,
                  lastFetch: Date.now(),
                  messageSnapshots: newSnapshots,
                },
              }));
            }
          } catch (fetchErr) {
            const errorMsg =
              fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            console.error(
              `Network error polling messages for team "${team}":`,
              errorMsg,
            );
          }
        } catch (err) {
          console.error(
            `Error polling messages for team ${team}:`,
            err instanceof Error ? err.message : String(err),
          );
        }
      }
    } catch (err) {
      console.error(
        "Unexpected error in pollMessages:",
        err instanceof Error ? err.message : String(err),
      );
    } finally {
      setIsPolling(false);
    }
  }, [isConfigured, registeredTeams, teamPollingState]);

  // Set up the polling interval with page visibility awareness
  useEffect(() => {
    if (!isConfigured || registeredTeams.size === 0) {
      return;
    }

    // Delay initial poll by 500ms to ensure browser is ready
    const initialPollTimeoutRef = setTimeout(() => {
      pollMessages();
    }, 500);

    // Handle visibility changes to pause/resume polling
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is hidden - clear the interval
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current);
          pollingIntervalRef.current = null;
        }
      } else {
        // Page is visible - restart polling
        if (!pollingIntervalRef.current) {
          pollingIntervalRef.current = setInterval(() => {
            pollMessages();
          }, 20000);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Set up initial 20-second polling interval (increased from 10s to reduce violations)
    pollingIntervalRef.current = setInterval(() => {
      pollMessages();
    }, 20000);

    return () => {
      clearTimeout(initialPollTimeoutRef);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [isConfigured, registeredTeams.size, pollMessages]);

  const value: ChatPollingContextType = {
    registerTeam,
    unregisterTeam,
    isPolling,
  };

  return (
    <ChatPollingContext.Provider value={value}>
      {children}
    </ChatPollingContext.Provider>
  );
};

export const useChatPolling = (): ChatPollingContextType => {
  const context = useContext(ChatPollingContext);
  if (!context) {
    throw new Error("useChatPolling must be used within ChatPollingProvider");
  }
  return context;
};
