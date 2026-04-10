import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useActiveAccount } from "thirdweb/react";
import { toast } from "sonner";
import { TbX } from "react-icons/tb";
import {
  getAlerts,
  getLastRead,
  markAllRead,
  setAlerts,
  getUnseenAlertIds,
  closeAlert,
  type AlertItem,
  updateEmojiReactionAlertsWithDetails,
  updateNewOfferAlertsWithDetails,
  updateNewSaleAlertsWithDetails,
  removeCancelledOfferAlerts,
  updateAcceptedOfferAlertsWithDetails,
  updateNewFanAlertsWithDetails,
  deriveRankChangeAlerts,
  updateEditionEventAlertsWithDetails,
  updateMarketplaceAlertsWithDetails,
} from "@/lib/alerts";
import { initializeProfilesCache } from "@/lib/profiles";
import { FilterStyleButton } from "@/components/ui/filter-style-button";
import { syncBlogPostAlerts } from "@/lib/blogPostAlerts";
import { fetchAlertsForWallet, insertAlerts } from "@/lib/supabaseAlertsClient";

export default function AlertsPage() {
  const account = useActiveAccount();
  const address = account?.address ?? null;
  const { pathname } = useLocation();
  const prevPathRef = useRef<string | null>(null);
  const [items, setItems] = useState<AlertItem[]>([]);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Remove stale alerts that don't correspond to actual records
  const cleanupStaleAlerts = (walletAddress: string) => {
    try {
      const alerts = getAlerts(walletAddress);
      let needsSave = false;
      let filteredAlerts = alerts;

      // Remove emoji reaction alerts created by addEmojiReactionAlert
      // These have format: emoji-reaction:{reactorAddress}:{timestamp}
      // Valid record-based alerts have format: emoji-reaction:{emoji_reaction_id}
      filteredAlerts = filteredAlerts.filter((a) => {
        if (a.id.startsWith("emoji-reaction:")) {
          // Remove if it's the old format from addEmojiReactionAlert
          // (contains addresses and timestamps in the ID)
          const parts = a.id.split(":");
          if (parts.length === 3) {
            // Format: emoji-reaction:{address}:{timestamp}
            const maybeLongAddress = parts[1];
            const maybeTimestamp = parts[2];
            // Check if it looks like an address and a timestamp
            if (
              (maybeLongAddress.startsWith("0x") ||
                maybeLongAddress.length > 20) &&
              /^\d+$/.test(maybeTimestamp)
            ) {
              // This is an old-format temporary alert, remove it
              needsSave = true;
              return false;
            }
          }
        }

        // Remove new-offer alerts with invalid body
        if (a.id.startsWith("new-offer:")) {
          if (!a.body) {
            needsSave = true;
            return false;
          }
          try {
            const bodyData = JSON.parse(a.body) as { displayText?: string };
            if (!bodyData.displayText) {
              needsSave = true;
              return false;
            }
          } catch {
            needsSave = true;
            return false;
          }
        }

        return true;
      });

      if (needsSave) {
        setAlerts(walletAddress, filteredAlerts);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: `alertsData:${walletAddress.toLowerCase()}`,
          }),
        );
      }
    } catch (err) {
    }
  };

  // Initialize profiles cache on component mount
  useEffect(() => {
    initializeProfilesCache().catch(() => {
      // silently ignore errors
    });
  }, []);

  // Fetch all alerts on page load/refresh
  // Includes: emoji reactions, NewOffer, NewSale, AcceptedOffer, cancelled offers,
  // edition event subscriptions, marketplace events, and rank changes
  useEffect(() => {
    if (!address) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        // Ensure profiles cache is refreshed before fetching alerts
        // This ensures usernames are available for alert enrichment
        await initializeProfilesCache();

        // Fetch transaction-based alerts
        await Promise.all([
          updateEmojiReactionAlertsWithDetails(address, controller.signal),
          updateNewOfferAlertsWithDetails(address, controller.signal),
          updateNewSaleAlertsWithDetails(address, controller.signal),
          removeCancelledOfferAlerts(address, controller.signal),
          updateAcceptedOfferAlertsWithDetails(address, controller.signal),
          updateNewFanAlertsWithDetails(address, controller.signal),
          updateEditionEventAlertsWithDetails(address, controller.signal),
          updateMarketplaceAlertsWithDetails(address, controller.signal),
        ]);

        // Derive and merge rank change alerts from wallet_daily_value
        const rankAlerts = await deriveRankChangeAlerts(address);
        const existingAlerts = getAlerts(address);

        // Filter out old rank-change alerts and merge with new ones
        const filteredAlerts = existingAlerts.filter(
          (a) => !a.id.startsWith("rank-change:"),
        );
        const mergedAlerts = [...filteredAlerts, ...rankAlerts];

        // Sync blog post alerts (check for new blog posts)
        // This writes new blog post alerts to Supabase
        await syncBlogPostAlerts(address);

        // Fetch blog post alerts from Supabase
        const supabaseAlerts = await fetchAlertsForWallet(address);

        // Get alerts from localStorage (transaction-based and other alerts)
        const localStorageAlerts = getAlerts(address);

        // Merge alerts: use Supabase blog alerts + localStorage other alerts
        // Filter out closed blog post alerts from display
        const supabaseBlogAlerts = supabaseAlerts.filter(
          (a) => !a.closed && a.id.startsWith("blog-post:"),
        );
        const otherAlerts = localStorageAlerts.filter(
          (a) => !a.id.startsWith("blog-post:"),
        );

        // Sync non-blog alerts to Supabase in parallel
        // These are transaction-based alerts that haven't been synced yet
        if (otherAlerts.length > 0) {
          insertAlerts(address, otherAlerts).catch(() => {
            // silently ignore errors
          });
        }

        // Save ONLY non-blog alerts to localStorage
        // Blog alerts stay in Supabase only to avoid duplication
        setAlerts(address, otherAlerts);

        // Combine all alerts for display (Supabase blog + localStorage others)
        const finalAlerts = [...supabaseBlogAlerts, ...otherAlerts];

        // Sort by createdAt descending (newest first)
        finalAlerts.sort((a, b) => b.createdAt - a.createdAt);

        // After updating, clean up any stale/temporary alerts
        cleanupStaleAlerts(address);
      } catch (err) {
        if ((err as any)?.name === "AbortError") {
          // Silently ignore abort errors
        } else {
        }
      } finally {
        setIsLoading(false);
      }
    })();

    return () => {
      try {
        controller.abort();
      } catch {
        // Silently ignore any errors during cleanup
      }
    };
  }, [address]);

  useEffect(() => {
    const data = getAlerts(address);

    // Migrate alerts to new format
    let needsSave = false;
    let migratedData = [...data];

    for (const alert of migratedData) {
      // Migrate new-relics alerts from old format (entire text in title) to new format (split title and body)
      if (alert.id === "new-relics") {
        // Check if this is the old format with text in title
        if (
          !alert.body &&
          alert.title &&
          alert.title.includes("20% of them are up for grabs")
        ) {
          alert.title = "New relics have been voted in by your fellow fans!";
          alert.body =
            "20% of all new supply is up for grabs. Tap here to earn it by redeeming prior supply.";
          needsSave = true;
        }
        // Also update if body has the old text from previous version
        else if (
          alert.body ===
            "20% of them are up for grabs and to reduce that player's prior supply." ||
          alert.body ===
            "20% of all new supply is up for grabs. Tap here to redeem old team relics to earn the new ones."
        ) {
          alert.body =
            "20% of all new supply is up for grabs. Tap here to earn it by redeeming prior supply.";
          needsSave = true;
        }
      }
    }

    // Remove new-offer alerts that don't have proper JSON body with displayText
    // so they can be recreated fresh with proper formatting
    migratedData = migratedData.filter((alert) => {
      if (alert.id.startsWith("new-offer:")) {
        if (!alert.body) {
          needsSave = true;
          return false; // Remove alerts with no body
        }
        try {
          const bodyData = JSON.parse(alert.body) as { displayText?: string };
          if (!bodyData.displayText) {
            needsSave = true;
            return false; // Remove alerts without displayText
          }
        } catch {
          // If body is not valid JSON, remove it
          needsSave = true;
          return false;
        }
      }
      return true; // Keep this alert
    });

    // Filter out blog alerts (they come from Supabase, not localStorage)
    const nonBlogAlerts = migratedData.filter(
      (a) => !a.id.startsWith("blog-post:"),
    );

    if (needsSave && address) {
      // Only save non-blog alerts to localStorage
      setAlerts(address, nonBlogAlerts);
    }

    // Use unseen state from alerts library for highlighting
    const unseenIds = getUnseenAlertIds(address);
    setHighlightIds(unseenIds);

    // Don't set items here - let the storage/alertsUpdated listener do it
    // This prevents the second useEffect from conflicting with blog alert loading
  }, [address]);

  useEffect(() => {
    const updateAlertsAndHighlight = async () => {
      try {
        // Fetch all alerts from Supabase (single source of truth for display)
        const supabaseAlerts = await fetchAlertsForWallet(address);

        // Filter to only include open alerts (status != "closed")
        const openAlerts = supabaseAlerts.filter((a) => !a.closed);

        // Use unseen state from alerts library (session-based, not localStorage)
        const unseenIds = getUnseenAlertIds(address);
        const newHighlights = new Set<string>(unseenIds);

        // Show toast for new unseen alerts
        for (const alertId of unseenIds) {
          const alert = openAlerts.find((a) => a.id === alertId);
          if (alert?.id.startsWith("edition-event:")) {
            toast.info(`New marketplace event: ${alert.title}`, {
              duration: 5000,
              position: "top-center",
            });
            break; // Only show one toast
          }
        }

        setHighlightIds(newHighlights);
        setItems(openAlerts);
      } catch (err) {
        // silently ignore errors
      }
    };

    // Run update on mount
    updateAlertsAndHighlight();

    window.addEventListener("storage", updateAlertsAndHighlight);
    window.addEventListener("alertsUpdated", updateAlertsAndHighlight);
    return () => {
      window.removeEventListener("storage", updateAlertsAndHighlight);
      window.removeEventListener("alertsUpdated", updateAlertsAndHighlight);
      setHighlightIds(new Set());
    };
  }, [address]);

  // Mark all alerts as read when component unmounts (navigating away from /alerts page)
  useEffect(() => {
    return () => {
      if (address) {
        markAllRead(address);
      }
    };
  }, [address]);

  const sorted = useMemo(() => {
    const now = Math.floor(Date.now() / 1000); // Current time in seconds

    // Items are already filtered to open alerts from Supabase in the useEffect
    // Just apply final filters (offer expiration) and sorting
    return items
      .filter((a) => a.id !== "emoji-reactions-general")
      .filter((a) => {
        const isNewOfferAlert = a.id.startsWith("new-offer:");

        // Include non-NewOffer alerts always
        if (!isNewOfferAlert) return true;

        // For NewOffer alerts, include only if not expired
        if (!a.body) return false;

        try {
          const bodyData = JSON.parse(a.body) as {
            offer_expiration_ts?: number;
          };
          const expirationTs = bodyData.offer_expiration_ts;
          // Include if expiration is null/undefined or not yet expired
          return (
            expirationTs === undefined ||
            expirationTs === null ||
            expirationTs > now
          );
        } catch {
          return false; // Exclude if we can't parse
        }
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [items]);

  const getOfferExpiration = (a: AlertItem): number | null => {
    const isNewOfferAlert = a.id.startsWith("new-offer:");
    if (!isNewOfferAlert || !a.body) return null;

    try {
      const bodyData = JSON.parse(a.body) as {
        offer_expiration_ts?: number;
      };
      return bodyData.offer_expiration_ts || null;
    } catch {
      return null;
    }
  };

  const formatExpirationTime = (ts: number): string => {
    try {
      // Timestamp is in seconds, convert to milliseconds
      const expirationMs = ts * 1000;
      const date = new Date(expirationMs);
      return date.toLocaleString();
    } catch {
      return "";
    }
  };

  const getBodyDisplay = (a: AlertItem) => {
    const isNewOfferAlert = a.id.startsWith("new-offer:");
    const isAcceptedOfferAlert = a.id.startsWith("accepted-offer:");
    const isNewFanAlert = a.id.startsWith("new-fan:");
    const isEditionEventAlert = a.id.startsWith("edition-event:");
    const isMarketplaceAlert = a.id.startsWith("marketplace:");
    const isBlogPostAlert = a.id.startsWith("blog-post:");

    if (
      (isNewOfferAlert ||
        isAcceptedOfferAlert ||
        isNewFanAlert ||
        isEditionEventAlert ||
        isMarketplaceAlert ||
        isBlogPostAlert) &&
      a.body
    ) {
      try {
        const bodyData = JSON.parse(a.body) as {
          displayText?: string;
          message?: string;
          buyer?: string;
          buyer_address?: string;
          buyer_username?: string;
        };
        if (bodyData.displayText) {
          // Sanitize any template placeholders in displayText
          let displayText = bodyData.displayText;

          // If displayText contains {buyer} placeholder, try to resolve it
          if (displayText.includes("{buyer}")) {
            const buyerAddress = bodyData.buyer || bodyData.buyer_address;
            if (buyerAddress) {
              // Use buyer_username if available, otherwise show address shorthand
              const buyerName = bodyData.buyer_username || (buyerAddress.substring(0, 10) + "...");
              displayText = displayText.replaceAll("{buyer}", buyerName);
            } else {
              // Fallback if no buyer info
              displayText = displayText.replaceAll("{buyer}", "a user");
            }
          }

          return displayText;
        }
        // Handle blog post alerts - use message field
        if (bodyData.message && a.id.startsWith("blog-post:")) {
          return bodyData.message;
        }
      } catch {
        // Fall back to body if not valid JSON
      }
      return a.body;
    }
    // Handle new-relics alerts: if no body, extract from title
    if (a.id === "new-relics" && !a.body && a.title) {
      const match = a.title.match(
        /New relics have been voted in by your fellow fans!\s*(.+)/,
      );
      if (match && match[1]) {
        return match[1];
      }
    }
    return a.body;
  };

  const getEditionEventEmittedTime = (a: AlertItem): string => {
    const isEditionEventAlert = a.id.startsWith("edition-event:");
    if (!isEditionEventAlert || !a.body) return "";

    try {
      const bodyData = JSON.parse(a.body) as { emitted_at?: string };
      return bodyData.emitted_at || "";
    } catch {
      return "";
    }
  };

  const getAlertTimestamp = (a: AlertItem): string => {
    const isEditionEventAlert = a.id.startsWith("edition-event:");

    // For edition event alerts, use the emitted_at time from the marketplace event
    if (isEditionEventAlert) {
      const emittedTime = getEditionEventEmittedTime(a);
      if (emittedTime) {
        return emittedTime;
      }
    }

    // For all other alerts, use createdAt
    return new Date(a.createdAt).toLocaleString();
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-xl font-semibold mb-4">Alerts</h1>
      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading alerts...
          </p>
        </div>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-slate-600">No alerts.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((a) => {
            const highlight = highlightIds.has(a.id);
            const isEmojiReactionAlert = a.id.startsWith("emoji-reaction:");
            const isNewOfferAlert = a.id.startsWith("new-offer:");
            const isAcceptedOfferAlert = a.id.startsWith("accepted-offer:");
            const isNewFanAlert = a.id.startsWith("new-fan:");
            const isRankChangeAlert = a.id.startsWith("rank-change:");
            const isEditionEventAlert = a.id.startsWith("edition-event:");
            const isMarketplaceAlert = a.id.startsWith("marketplace:");
            const isBlogPostAlert = a.id.startsWith("blog-post:");
            let linkTarget: string | null = null;

            if (isMarketplaceAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  link?: string;
                };
                if (bodyData.link) {
                  linkTarget = bodyData.link;
                }
              } catch {
                // Ignore parse errors
              }
            } else if (isEmojiReactionAlert) {
              linkTarget = "/collection";
            } else if (isRankChangeAlert) {
              linkTarget = "/collection";
            } else if (isNewOfferAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  edition_id?: number;
                  serial?: number;
                };
                if (bodyData.edition_id && bodyData.serial) {
                  linkTarget = `/edition/${bodyData.edition_id}/serial/${bodyData.serial}/manage-listing`;
                }
              } catch {
                // Ignore parse errors
              }
            } else if (isAcceptedOfferAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  edition_id?: number;
                  serial?: number;
                };
                if (bodyData.edition_id && bodyData.serial) {
                  linkTarget = `/edition/${bodyData.edition_id}/serial/${bodyData.serial}`;
                }
              } catch {
                // Ignore parse errors
              }
            } else if (isNewFanAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  followee_username?: string;
                };
                if (bodyData.followee_username) {
                  linkTarget = `/collection/${bodyData.followee_username}`;
                }
              } catch {
                // Ignore parse errors
              }
            } else if (isEditionEventAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  edition_id?: number;
                };
                if (bodyData.edition_id) {
                  linkTarget = `/edition/${bodyData.edition_id}`;
                }
              } catch {
                // Ignore parse errors
              }
            } else if (a.id === "new-relics") {
              linkTarget = "/redeem";
            } else if (isBlogPostAlert && a.body) {
              try {
                const bodyData = JSON.parse(a.body) as {
                  blogUrl?: string;
                };
                if (bodyData.blogUrl) {
                  linkTarget = bodyData.blogUrl;
                }
              } catch {
                // Ignore parse errors
              }
            }

            const bodyDisplay = getBodyDisplay(a);
            const expirationTs = getOfferExpiration(a);

            if (highlight) {
              return (
                <li key={a.id} className="flex gap-3 items-center">
                  <div
                    className="flex items-center justify-center w-[40px] h-[40px] border border-slate-300 dark:border-slate-600 rounded flex-shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    onClick={(e) => {
                      e.preventDefault();
                      closeAlert(address, a.id, a.createdAt);
                    }}
                  >
                    <TbX size={40} className="text-slate-600 dark:text-slate-400" style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }} />
                  </div>
                  <div className="flex-1">
                    {linkTarget ? (
                    <FilterStyleButton
                      asChild
                      className="w-full items-stretch justify-start text-left"
                    >
                      {a.id.startsWith("blog-post:") ? (
                        <a href={linkTarget} target="_blank" rel="noopener noreferrer" className="flex flex-col p-3">
                          <div className="block text-sm font-medium">
                            {a.title}
                          </div>
                          {bodyDisplay ? (
                            <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                              {bodyDisplay}
                            </div>
                          ) : null}
                          <div className="block text-[10px] text-slate-500 mt-2">
                            {getAlertTimestamp(a)}
                          </div>
                        </a>
                      ) : (
                        <Link to={linkTarget} className="flex flex-col p-3">
                          <div className="block text-sm font-medium">
                            {a.title}
                          </div>
                          {bodyDisplay ? (
                            <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                              {a.id === "new-relics" ? (
                                <p>{bodyDisplay}</p>
                              ) : (
                                bodyDisplay
                              )}
                            </div>
                          ) : null}
                          <div className="block text-[10px] text-slate-500 mt-2">
                            {getAlertTimestamp(a)}
                          </div>
                        </Link>
                      )}
                    </FilterStyleButton>
                    ) : (
                      <FilterStyleButton
                        asChild
                        className="w-full items-stretch justify-start text-left"
                      >
                        <div className="flex flex-col p-3">
                          <div className="block text-sm font-medium">
                            {a.title}
                          </div>
                          {bodyDisplay ? (
                            <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                              {a.id === "new-relics" ? (
                                <p>{bodyDisplay}</p>
                              ) : (
                                bodyDisplay
                              )}
                            </div>
                          ) : null}
                          <div className="block text-[10px] text-slate-500 mt-2">
                            {getAlertTimestamp(a)}
                          </div>
                        </div>
                      </FilterStyleButton>
                    )}
                  </div>
                </li>
              );
            }
            const alertClassName =
              "relative overflow-hidden block p-3 rounded border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-[0_5px_0_0_rgba(226,232,240,1)] dark:shadow-[0_5px_0_0_rgba(0,0,0,1)] before:content-[''] before:absolute before:inset-0 before:pointer-events-none before:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.1)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.1)_100%)] after:content-[''] after:absolute after:inset-0 after:pointer-events-none after:bg-[linear-gradient(to_bottom_right,_rgba(65,105,225,0.3)_0%,_rgba(65,105,225,0)_40%,_rgba(255,165,0,0)_60%,_rgba(255,165,0,0.3)_100%)] after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-1000 after:ease-in-out";

            return (
              <li key={a.id} className="flex gap-3 items-center">
                <div
                  className="flex items-center justify-center w-[40px] h-[40px] border border-slate-300 dark:border-slate-600 rounded flex-shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    closeAlert(address, a.id, a.createdAt);
                  }}
                >
                  <TbX size={40} className="text-slate-600 dark:text-slate-400" style={{ boxShadow: "1px 1px 3px 0 rgba(155, 155, 155, 1)" }} />
                </div>
                <div className="flex-1">
                  {linkTarget ? (
                    a.id.startsWith("blog-post:") ? (
                      <a
                        href={linkTarget}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={alertClassName + " flex flex-col"}
                      >
                        <div className="relative z-[1]">
                          <div className="block text-sm font-medium">{a.title}</div>
                          {bodyDisplay ? (
                            <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                              {bodyDisplay}
                            </div>
                          ) : null}
                          <div className="block text-[10px] text-slate-500 mt-2">
                            {getAlertTimestamp(a)}
                          </div>
                        </div>
                      </a>
                    ) : (
                      <Link
                        to={linkTarget}
                        className={alertClassName + " flex flex-col"}
                      >
                        <div className="relative z-[1]">
                          <div className="block text-sm font-medium">{a.title}</div>
                          {bodyDisplay ? (
                            <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                              {a.id === "new-relics" ? (
                                <p>{bodyDisplay}</p>
                              ) : (
                                bodyDisplay
                              )}
                            </div>
                          ) : null}
                          <div className="block text-[10px] text-slate-500 mt-2">
                            {getAlertTimestamp(a)}
                          </div>
                        </div>
                      </Link>
                    )
                  ) : (
                    <div className={alertClassName + " flex flex-col"}>
                      <div className="relative z-[1]">
                        <div className="block text-sm font-medium">{a.title}</div>
                        {bodyDisplay ? (
                          <div className="block text-xs text-slate-600 dark:text-slate-300 mt-1 break-words whitespace-normal">
                            {a.id === "new-relics" ? (
                              <p>{bodyDisplay}</p>
                            ) : (
                              bodyDisplay
                            )}
                          </div>
                        ) : null}
                        <div className="block text-[10px] text-slate-500 mt-2">
                          {getAlertTimestamp(a)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
