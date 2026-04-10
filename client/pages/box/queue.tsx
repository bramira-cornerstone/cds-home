import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import {
  executePurchase,
  type PurchaseResult,
} from "@/lib/dropQueueUtils";
import {
  joinQueueEntry,
  getQueuePosition,
  setUserTurnActive,
  removeFromQueue as removeFromServerQueue,
  markQueueCompleted,
  hasUserTimedOut,
  processQueueTimeouts,
  getFullQueue,
  getQueueEntry,
} from "@/lib/dropQueueServerUtils";
import {
  priorDropsContract,
  fetchPriorDropNFTs,
  buildPriorDropAttributeMap,
  type PriorDropAttributeMap,
} from "@/lib/priorDrops";
import { parseBigInt } from "@/lib/priorDrops";
import { useBetaAllowlist } from "@/hooks/useWalletProfile";
import {
  fetchMintedByTierAndDropWeek,
  type MintedRow,
} from "@/lib/supabaseMinted";
import EditionSplineScene, {
  EDITION_FONT_URL,
} from "@/components/EditionSplineScene";
import MiniCarousel from "@/components/MiniCarousel";
import SplineFitted from "@/components/SplineFitted";
import { cn } from "@/lib/utils";
import { useActiveListings } from "@/hooks/useActiveListings";
import { useActiveAuctions } from "@/hooks/useActiveAuctions";
import { countInPackTokensByEditionId } from "@/lib/supabaseRelicSerialsJoined";
import { countStakedTokensByEditionId } from "@/lib/public_staking";
import { countRedeemedTokensByEditionId } from "@/lib/supabaseRedemptionEvents";

export default function BoxQueuePage() {
  const betaAllowlist = useBetaAllowlist();
  const { token_id } = useParams<{ token_id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const account = useActiveAccount();
  const { mutateAsync: sendTransaction } = useSendTransaction();

  const [position, setPosition] = useState<number | null>(null);
  const [totalQueueLength, setTotalQueueLength] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseStatus, setPurchaseStatus] = useState<
    "idle" | "pending" | "success" | "error"
  >("idle");
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);
  const [showTimeoutMessage, setShowTimeoutMessage] = useState(false);
  const [turnStartedAt, setTurnStartedAt] = useState<string | null>(null);

  const timeoutTriggeredRef = useRef(false);
  const activationTriggeredRef = useRef(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const turnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const tokenIdString = token_id ?? "";
  const parsedTokenId = parseBigInt(tokenIdString);
  const claimerAddress = account?.address;
  const claimQuantity = 1n;

  // No longer needed - using server-side queue timestamps


  // Join queue on mount and start polling for position
  useEffect(() => {
    if (!tokenIdString || !claimerAddress) {
      setIsLoading(false);
      return;
    }

    const initializeQueue = async () => {
      console.log("[Queue] Initializing queue for user", { tokenIdString, claimerAddress });

      try {
        // Join the queue
        const entry = await joinQueueEntry(tokenIdString, claimerAddress);
        if (!entry) {
          console.error("[Queue] Failed to join queue - no entry returned");
          setPurchaseMessage("Unable to connect to queue system. Please try refreshing.");
          setIsLoading(false);
          return;
        }

        console.log("[Queue] Joined queue:", entry);

        // Get initial position
        const initialPos = await getQueuePosition(tokenIdString, claimerAddress);
        console.log("[Queue] Initial position:", initialPos);
        setPosition(initialPos ?? null);

        // Get initial queue length for gradient calculation
        const fullQueue = await getFullQueue(tokenIdString);
        setTotalQueueLength(fullQueue.length);

        // If user is already at position 0 with active status, get their turn_started_at
        if (initialPos === 0 && entry.status === 'active' && entry.turn_started_at) {
          console.log("[Queue] User already at position 0, setting turn_started_at:", entry.turn_started_at);
          setTurnStartedAt(entry.turn_started_at);
        }

        setIsLoading(false);

        // Start polling for position updates every 30 seconds
        startPollingPosition();
      } catch (err) {
        console.error("[Queue] Failed to initialize queue:", err);
        setPurchaseMessage(`Queue error: ${err instanceof Error ? err.message : 'Unknown error'}`);
        setIsLoading(false);
      }
    };

    initializeQueue();

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [tokenIdString, claimerAddress]);

  // Redirect only if no token ID
  useEffect(() => {
    if (!tokenIdString) {
      navigate("/prior-drops");
    }
  }, [tokenIdString, navigate]);

  // Mark user as removed if they navigate away from the queue page
  // (but NOT on page refresh, which keeps the same route)
  useEffect(() => {
    if (!tokenIdString || !claimerAddress) return;

    // Check if we're still on the queue page for this token
    const isOnQueuePage = location.pathname === `/box/${tokenIdString}/queue`;

    if (!isOnQueuePage) {
      console.log("[Queue] User navigated away from queue page, marking as removed", {
        currentPath: location.pathname,
        expectedPath: `/box/${tokenIdString}/queue`,
      });
      removeFromServerQueue(tokenIdString, claimerAddress);

      // Clear polling interval when leaving the page
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (turnTimeoutRef.current) {
        clearInterval(turnTimeoutRef.current);
      }
    }
  }, [location, tokenIdString, claimerAddress]);

  // Mark user as removed if they close/unload the page entirely
  // (not just navigate within the app)
  useEffect(() => {
    if (!tokenIdString || !claimerAddress) return;

    const handleBeforeUnload = async () => {
      console.log("[Queue] Page unload detected, marking user as removed");
      // Send a synchronous request to remove the user
      // Use fetch with keepalive flag so it completes even as page is unloading
      const { baseUrl, anonKey } = getSupabaseConfigForCleanup();
      if (!baseUrl || !anonKey) return;

      const normalizedWallet = claimerAddress.toLowerCase();
      const url = `${baseUrl}/rest/v1/drop_queue?token_id=eq.${encodeURIComponent(tokenIdString)}&wallet_address=eq.${encodeURIComponent(normalizedWallet)}`;

      try {
        fetch(url, {
          method: 'PATCH',
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status: 'removed' }),
          keepalive: true, // Ensures request completes even if page unloads
        }).catch(() => {
          // Silently fail - user is already leaving
        });
      } catch (err) {
        // Ignore errors during page unload
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [tokenIdString, claimerAddress]);

  // Poll for position updates every 30 seconds
  const startPollingPosition = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      if (!tokenIdString || !claimerAddress) return;

      try {
        // Get current position
        const currentPos = await getQueuePosition(tokenIdString, claimerAddress);
        console.log("[Queue] Polling position:", currentPos);
        setPosition(currentPos ?? null);

        // Get full queue to calculate total length for gradient
        const fullQueue = await getFullQueue(tokenIdString);
        setTotalQueueLength(fullQueue.length);

        // Fetch user's entry to get turn_started_at if they're at position 0
        const userEntry = await getQueueEntry(tokenIdString, claimerAddress);
        if (userEntry && userEntry.status === 'active' && userEntry.turn_started_at) {
          console.log("[Queue] User is active, turn_started_at:", userEntry.turn_started_at);
          setTurnStartedAt(userEntry.turn_started_at);
        }

        // Don't process timeouts here - let client-side timer handle it
        // This prevents race conditions and premature removal
        // await processQueueTimeouts(tokenIdString);
      } catch (err) {
        console.error("[Queue] Polling error:", err);
        // Continue polling even if there's an error
      }
    }, 30000); // Poll every 30 seconds
  }, [tokenIdString, claimerAddress]);

  // Handle turn management when position becomes 0
  useEffect(() => {
    if (position !== 0 || !tokenIdString || !claimerAddress) return;

    // Only activate once per turn (not on every re-render)
    if (activationTriggeredRef.current) {
      console.log("[Queue] Activation already triggered, skipping");
      return;
    }

    console.log("[Queue] User reached position 0, activating turn");
    activationTriggeredRef.current = true;

    // Activate turn on server
    const activateTurn = async () => {
      try {
        const activated = await setUserTurnActive(tokenIdString, claimerAddress);
        if (activated) {
          console.log("[Queue] Turn activated on server");
        } else {
          console.warn("[Queue] Failed to activate turn on server");
        }

        // Wait a moment to ensure server has processed the update
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch updated entry to get turn_started_at timestamp
        const updatedEntry = await getQueueEntry(tokenIdString, claimerAddress);
        if (updatedEntry && updatedEntry.turn_started_at) {
          console.log("[Queue] Setting turn_started_at:", updatedEntry.turn_started_at);
          setTurnStartedAt(updatedEntry.turn_started_at);
        } else {
          console.warn("[Queue] No turn_started_at received from server:", updatedEntry);
        }
      } catch (err) {
        console.error("[Queue] Error activating turn:", err);
      }
    };
    activateTurn();

    // Clear timeout ref on first reaching position 0
    timeoutTriggeredRef.current = false;

    return () => {
      if (turnTimeoutRef.current) {
        clearInterval(turnTimeoutRef.current);
      }
    };
  }, [position, tokenIdString, claimerAddress]);

  // Monitor turn time remaining and handle timeout
  useEffect(() => {
    if (position !== 0 || !tokenIdString || !claimerAddress || !turnStartedAt) return;

    console.log("[Queue] Starting turn timer, turn_started_at:", turnStartedAt);

    const TURN_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
    const SAFETY_BUFFER_MS = 500; // 500ms buffer for clock skew

    // Validate that turnStartedAt is a valid timestamp
    const turnStartTime = new Date(turnStartedAt).getTime();
    if (isNaN(turnStartTime)) {
      console.error("[Queue] Invalid turn_started_at timestamp:", turnStartedAt);
      return;
    }

    // Check if turnStartTime is in the future (clock skew) - if so, wait for it
    const now = Date.now();
    if (turnStartTime > now) {
      console.warn("[Queue] turn_started_at is in the future (clock skew):", {
        turnStartTime,
        now,
        diff: turnStartTime - now,
      });
      // Return early, will retry on next effect run
      return;
    }

    turnTimeoutRef.current = setInterval(() => {
      const now = Date.now();
      const elapsed = now - turnStartTime;
      const remaining = Math.max(0, TURN_TIMEOUT_MS - elapsed);

      console.log("[Queue] Turn time check:", {
        elapsed,
        remaining,
        TURN_TIMEOUT_MS,
        turnStartTime,
        now,
      });
      setTurnTimeRemaining(remaining);

      // Trigger timeout when time expires
      // Only trigger if we have clear evidence that enough time has passed
      if (remaining <= 0 && !timeoutTriggeredRef.current && elapsed >= (TURN_TIMEOUT_MS + SAFETY_BUFFER_MS)) {
        console.log("[Queue] Turn time expired, removing from queue and redirecting", {
          elapsed,
          timeout: TURN_TIMEOUT_MS,
          safetyBuffer: SAFETY_BUFFER_MS,
        });
        timeoutTriggeredRef.current = true;

        // Show timeout message
        setShowTimeoutMessage(true);

        // Remove from server queue
        removeFromServerQueue(tokenIdString, claimerAddress);

        // Redirect after 3 seconds
        setTimeout(() => {
          navigate(`/box/${tokenIdString}`);
        }, 3000);
      }
    }, 500); // Check every 500ms for smooth countdown

    return () => {
      if (turnTimeoutRef.current) {
        clearInterval(turnTimeoutRef.current);
      }
    };
  }, [position, tokenIdString, claimerAddress, navigate, turnStartedAt]);

  const handlePurchase = useCallback(async () => {
    if (!priorDropsContract || !claimerAddress || parsedTokenId === null) {
      setPurchaseStatus("error");
      setPurchaseMessage("Invalid state for purchase.");
      return;
    }

    try {
      setPurchaseStatus("pending");
      setPurchaseMessage("Processing your claim...");

      const result = await executePurchase(
        priorDropsContract,
        claimerAddress,
        parsedTokenId,
        claimQuantity,
        sendTransaction,
      );

      if (result.success) {
        console.log("[Queue] Purchase successful, marking as completed");
        setPurchaseStatus("success");
        setPurchaseMessage("Success! Your box is on the way.");

        // Mark as completed on server
        await markQueueCompleted(tokenIdString, claimerAddress);

        // Clear polling interval
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }

        // Redirect after a delay
        setTimeout(() => {
          navigate(`/box/${tokenIdString}`);
        }, 2000);
      } else {
        console.log("[Queue] Purchase failed:", result.message);
        setPurchaseStatus("error");
        setPurchaseMessage(result.message);
      }
    } catch (error) {
      setPurchaseStatus("error");
      setPurchaseMessage(
        error instanceof Error ? error.message : "Purchase failed.",
      );
    }
  }, [tokenIdString, claimerAddress, parsedTokenId, sendTransaction, navigate]);

  const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

const getSupabaseConfigForCleanup = () => {
  const baseUrl = (import.meta as any).env.SUPABASE_URL as string | undefined;
  const anonKey = (import.meta as any).env.SUPABASE_ANON_KEY as string | undefined;
  return { baseUrl, anonKey };
};

  // Only show "not authorized" if we've explicitly determined user is NOT on allowlist
  if (betaAllowlist === false) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white p-6 text-center text-base text-black">
          Log In above to buy Boxes.
        </div>
      </section>
    );
  }

  if (!claimerAddress) {
    return (
      <section className="container mx-auto px-4 py-16">
        <div className="w-full rounded-none bg-white p-6 text-center text-base text-black">
          Please connect your wallet to continue.
        </div>
      </section>
    );
  }

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-lg">
          <h1 className="text-3xl font-bold text-center text-slate-800 mb-8">
            Drop Queue
          </h1>

          {isLoading ? (
            <div className="flex justify-center">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-slate-700">Loading queue...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {showTimeoutMessage ? (
                <div
                  className="border rounded-lg p-6 mb-6 text-center"
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.05)",
                    borderColor: "rgba(239, 68, 68, 0.2)",
                  }}
                >
                  <p
                    className="font-semibold text-lg"
                    style={{ color: "#dc2626" }}
                  >
                    Transaction timeout occurred. Returning to Box page...
                  </p>
                </div>
              ) : position !== null && position >= 0 ? (
                <>
                  {position !== 0 && (
                    <div className="text-center mb-8">
                      <p className="text-xl font-semibold text-slate-800 mb-4">
                        You are #{position + 1} in line for a box, hang tight!
                      </p>

                      {/* Background container for progress bar */}
                      <div className="w-full h-6 rounded-full flex items-center" style={{ backgroundColor: "#E5E7EB" }}>
                        {/* Progress bar with orange-to-blue gradient */}
                        <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: "#D1D5DB" }}>
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              background: "linear-gradient(90deg, #FF6300 0%, #004FFF 100%)",
                              width: totalQueueLength > 0 && position !== null
                                ? `${Math.max(0, Math.min(100, ((totalQueueLength - position - 1) / (totalQueueLength - 1)) * 100))}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>

                      {/* Warning message */}
                      <p className="text-sm text-slate-600 mt-4">
                        To maintain your queue position, do not close your browser window or navigate from this page.
                      </p>
                    </div>
                  )}

                  {position === 0 ? (
                    <div className="rounded-lg p-4 mb-6 bg-emerald-50 border border-emerald-200">
                      <p className="font-semibold text-center text-emerald-800">
                        It's your turn! You have 3 minutes to purchase.
                      </p>
                      {turnTimeRemaining !== null && (
                        <p className="text-emerald-700 text-center text-sm mt-2 font-mono">
                          Time remaining: {formatTime(turnTimeRemaining)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div
                      className="border rounded-lg p-4 mb-6"
                      style={{
                        backgroundColor: "rgba(0, 79, 255, 0.05)",
                        borderColor: "rgba(0, 79, 255, 0.2)",
                      }}
                    >
                      <p
                        className="font-semibold text-center"
                        style={{ color: "#004FFF" }}
                      >
                        {position} {position !== 1 ? "people" : "person"} ahead of
                        you.
                        <br />
                        They have 3 minutes to purchase before you move up in the queue.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center">
                  <p className="text-red-600 font-semibold">
                    Unable to determine your position in the queue.
                  </p>
                </div>
              )}

              {purchaseMessage && (
                <div
                  className={`rounded-lg p-4 text-center font-semibold ${
                    purchaseStatus === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : purchaseStatus === "error"
                        ? "bg-red-50 text-red-800 border border-red-200"
                        : "bg-slate-50 text-slate-800 border border-slate-200"
                  }`}
                >
                  {purchaseMessage}
                </div>
              )}

              {position === 0 && purchaseStatus !== "success" && (
                <button
                  type="button"
                  onClick={handlePurchase}
                  disabled={purchaseStatus === "pending"}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  {purchaseStatus === "pending" ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "PURCHASE"
                  )}
                </button>
              )}

              {purchaseStatus === "success" && (
                <button
                  type="button"
                  onClick={() => navigate(`/box/${tokenIdString}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
                >
                  View Your Purchase
                </button>
              )}
            </div>
          )}
        </div>

        <AutoRotatingEditionsCarousel tokenIdString={tokenIdString} />
      </div>
    </section>
  );
}

function shuffleArray<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function AutoRotatingEditionsCarousel({
  tokenIdString,
}: {
  tokenIdString: string;
}) {
  const [currentPositionInRotation, setCurrentPositionInRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const { listings: activeListings } = useActiveListings();
  const { auctions: activeAuctions } = useActiveAuctions();
  const [stakedCount, setStakedCount] = useState<number>(0);
  const [inPacksCount, setInPacksCount] = useState<number>(0);
  const [redeemedCount, setRedeemedCount] = useState<number>(0);

  const parsedTokenId = useMemo(
    () => (tokenIdString ? parseBigInt(tokenIdString) : null),
    [tokenIdString],
  );

  const { data: boxData } = useQuery({
    queryKey: ["queue-box-metadata", tokenIdString],
    queryFn: async ({ signal }) => {
      if (parsedTokenId === null || parsedTokenId === undefined) return null;
      const nfts = await fetchPriorDropNFTs({
        tokenIds: [Number(parsedTokenId)],
        signal,
      });
      return nfts[0] ?? null;
    },
    enabled: parsedTokenId !== null && parsedTokenId !== undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const attributeMap = useMemo(
    () =>
      boxData?.metadata?.attributes
        ? buildPriorDropAttributeMap(boxData.metadata.attributes)
        : {},
    [boxData],
  );

  const tier = useMemo(
    () =>
      attributeMap.tier ?? attributeMap.tier_value ?? attributeMap.tiervalue,
    [attributeMap],
  );

  const dropWeek = useMemo(
    () =>
      attributeMap.drop_week ?? attributeMap.drop_start ?? attributeMap.series,
    [attributeMap],
  );

  const { data: editions = [] } = useQuery({
    queryKey: ["queue-editions", tier, dropWeek],
    queryFn: ({ signal }) =>
      fetchMintedByTierAndDropWeek(tier, dropWeek, signal),
    enabled: Boolean(tier && dropWeek),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const editionItems = useMemo(() => {
    return editions
      .map((row) => ({
        edition_id: row?.edition_id,
        PlayerName: row?.PlayerName,
        ProductName: row?.ProductName,
        Minted: row?.Minted,
        SeriesName: row?.SeriesName,
        TierValue: row?.TierValue,
        PlayDescription: row?.PlayDescription,
        SetName: row?.SetName,
        FinalScore: row?.FinalScore,
        GameDate: row?.GameDate,
        PlayerStatValue1: row?.PlayerStatValue1,
        PlayerStatValue2: row?.PlayerStatValue2,
        PlayerStatValue3: row?.PlayerStatValue3,
        PlayerStatValue4: row?.PlayerStatValue4,
        PlayerStatValue5: row?.PlayerStatValue5,
        PlayerStat1: row?.PlayerStat1,
        PlayerStat2: row?.PlayerStat2,
        PlayerStat3: row?.PlayerStat3,
        PlayerStat4: row?.PlayerStat4,
        PlayerStat5: row?.PlayerStat5,
        Badge1: row?.Badge1,
        Badge2: row?.Badge2,
        Badge3: row?.Badge3,
        video_location: row?.video_location,
      }))
      .filter((item): item is typeof item & { edition_id: number } =>
        Number.isFinite(item.edition_id),
      );
  }, [editions]);

  const shuffledIndices = useMemo(() => {
    if (!editionItems.length) return [];
    const indices = Array.from({ length: editionItems.length }, (_, i) => i);
    return shuffleArray(indices);
  }, [editionItems.length]);

  const currentEditionIndex = shuffledIndices[currentPositionInRotation];
  const currentEdition = editionItems[currentEditionIndex];

  useEffect(() => {
    if (!editionItems.length || !shuffledIndices.length) return;

    const timer = setTimeout(() => {
      setIsLoading(true);
      setCurrentPositionInRotation((prev) =>
        prev < shuffledIndices.length - 1 ? prev + 1 : 0,
      );
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }, 30000);

    return () => clearTimeout(timer);
  }, [currentPositionInRotation, editionItems.length, shuffledIndices.length]);

  // Calculate active listings count for the current edition
  const activeListingsCount = useMemo(() => {
    if (!currentEdition?.edition_id) return 0;

    const serialsSet = new Set<number>();

    // Add serials from active listings
    if (activeListings) {
      for (const listing of activeListings) {
        if (
          listing.editionId === currentEdition.edition_id &&
          listing.serial !== null &&
          listing.status === "active"
        ) {
          serialsSet.add(listing.serial);
        }
      }
    }

    // Add serials from active auctions
    if (activeAuctions) {
      for (const auction of activeAuctions) {
        if (
          auction.editionId === currentEdition.edition_id &&
          auction.serial !== null &&
          auction.status === "active"
        ) {
          serialsSet.add(auction.serial);
        }
      }
    }

    return serialsSet.size;
  }, [currentEdition?.edition_id, activeListings, activeAuctions]);

  // Fetch staked count for the current edition
  useEffect(() => {
    if (!currentEdition?.edition_id) {
      setStakedCount(0);
      return;
    }
    let cancelled = false;
    countStakedTokensByEditionId(currentEdition.edition_id, undefined)
      .then((count) => {
        if (!cancelled) setStakedCount(count);
      })
      .catch(() => {
        if (!cancelled) setStakedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentEdition?.edition_id]);

  // Fetch in-packs count for the current edition
  useEffect(() => {
    if (!currentEdition?.edition_id) {
      setInPacksCount(0);
      return;
    }
    let cancelled = false;
    countInPackTokensByEditionId(currentEdition.edition_id, undefined)
      .then((count) => {
        if (!cancelled) setInPacksCount(count);
      })
      .catch(() => {
        if (!cancelled) setInPacksCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentEdition?.edition_id]);

  // Fetch redeemed count for the current edition
  useEffect(() => {
    if (!currentEdition?.edition_id) {
      setRedeemedCount(0);
      return;
    }
    let cancelled = false;
    countRedeemedTokensByEditionId(
      currentEdition.edition_id,
      undefined,
      undefined,
    )
      .then((count) => {
        if (!cancelled) setRedeemedCount(count);
      })
      .catch(() => {
        if (!cancelled) setRedeemedCount(0);
      });
    return () => {
      cancelled = true;
    };
  }, [currentEdition?.edition_id]);

  if (!editionItems.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-center text-slate-800 mb-8">
        Relics in this Box Drop
      </h2>

      {currentEdition && (
        <div className="space-y-6">
          {/* Edition Spline Scene Display with Loading State */}
          <div className="relative aspect-square w-full max-w-sm mx-auto overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
                  <span className="text-sm text-slate-600">
                    Loading next edition...
                  </span>
                </div>
              </div>
            )}
            <EditionSplineScene
              className="h-full w-full"
              overlayUrl={
                currentEdition.video_location
                  ? `https://stream.mux.com/${String(currentEdition.video_location).trim()}.m3u8`
                  : undefined
              }
              playerName={currentEdition.PlayerName ?? null}
              productName={currentEdition.ProductName ?? null}
              minted={currentEdition.Minted ?? null}
              seriesName={currentEdition.SeriesName ?? null}
              tierValue={currentEdition.TierValue ?? null}
              playDescription={currentEdition.PlayDescription ?? null}
              setName={currentEdition.SetName ?? null}
              finalScore={currentEdition.FinalScore ?? null}
              gameDate={currentEdition.GameDate ?? null}
              statValue1={currentEdition.PlayerStatValue1 ?? null}
              statValue2={currentEdition.PlayerStatValue2 ?? null}
              statValue3={currentEdition.PlayerStatValue3 ?? null}
              statValue4={currentEdition.PlayerStatValue4 ?? null}
              statValue5={currentEdition.PlayerStatValue5 ?? null}
              statName1={currentEdition.PlayerStat1 ?? null}
              statName2={currentEdition.PlayerStat2 ?? null}
              statName3={currentEdition.PlayerStat3 ?? null}
              statName4={currentEdition.PlayerStat4 ?? null}
              statName5={currentEdition.PlayerStat5 ?? null}
              badge1={currentEdition.Badge1 ?? null}
              badge2={currentEdition.Badge2 ?? null}
              badge3={currentEdition.Badge3 ?? null}
              fontUrl={EDITION_FONT_URL}
              isQueueCarousel={true}
              edition_id={currentEdition.edition_id ?? null}
              activeListingsCount={activeListingsCount}
              stakedCount={stakedCount}
              inPacksCount={inPacksCount}
              redeemedCount={redeemedCount}
            />
          </div>

          {/* Edition Info */}
          <div className="space-y-2 text-center text-sm text-slate-600">
            <div className="text-xs text-slate-500 mb-2">
              {currentPositionInRotation + 1} of {shuffledIndices.length} •
              Auto-rotating every 30 seconds
            </div>
            {currentEdition.PlayerName && (
              <p className="font-semibold text-slate-800">
                {currentEdition.PlayerName}
              </p>
            )}
            {currentEdition.SetName && (
              <p>
                {currentEdition.SetName}
                {currentEdition.Minted &&
                  ` - only ${currentEdition.Minted} to exist`}
              </p>
            )}
            {currentEdition.PlayDescription && (
              <p className="break-words whitespace-normal">
                {currentEdition.PlayDescription}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
