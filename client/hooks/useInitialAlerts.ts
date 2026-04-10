import { useEffect } from "react";
import {
  getAlerts,
  setAlerts,
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
import { syncBlogPostAlerts } from "@/lib/blogPostAlerts";
import { fetchAlertsForWallet, insertAlerts } from "@/lib/supabaseAlertsClient";
import { initializeProfilesCache } from "@/lib/profiles";

/**
 * Hook that generates and syncs alerts when wallet connects
 * This runs on any page where the user has connected their wallet,
 * ensuring the bell icon turns orange immediately without needing to visit /alerts
 */
export function useInitialAlerts() {
  useEffect(() => {
    const handleWalletChange = async (event: CustomEvent) => {
      const address = event.detail?.address;
      if (!address) return;

      try {
        // Ensure profiles cache is initialized for alert enrichment
        await initializeProfilesCache();

        const controller = new AbortController();

        // Generate all alert types in parallel
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

        // Derive and merge rank change alerts
        const rankAlerts = await deriveRankChangeAlerts(address);
        const existingAlerts = getAlerts(address);

        // Filter out old rank-change alerts and merge with new ones
        const filteredAlerts = existingAlerts.filter(
          (a) => !a.id.startsWith("rank-change:"),
        );
        const mergedAlerts = [...filteredAlerts, ...rankAlerts];

        // Save merged alerts to localStorage
        setAlerts(address, mergedAlerts);

        // Sync blog post alerts (check for new blog posts)
        // This writes new blog post alerts to Supabase
        // Non-critical, so we don't await or fail if it errors
        // Wrap in a timeout to prevent hanging if network is slow
        const blogAlertTimeout = setTimeout(() => {
          console.log("[Alerts] Blog alert sync timeout, moving on");
        }, 10000); // 10 second timeout

        syncBlogPostAlerts(address)
          .catch(() => {
            // Silently ignore blog post alert sync errors
          })
          .finally(() => {
            clearTimeout(blogAlertTimeout);
          });

        // Get current alerts from localStorage and Supabase
        const supabaseAlerts = await fetchAlertsForWallet(address);
        const localStorageAlerts = getAlerts(address);

        // Merge alerts: use Supabase blog alerts + localStorage other alerts
        // Filter out closed blog post alerts
        const supabaseBlogAlerts = supabaseAlerts.filter(
          (a) => !a.closed && a.id.startsWith("blog-post:"),
        );
        const otherAlerts = localStorageAlerts.filter(
          (a) => !a.id.startsWith("blog-post:"),
        );

        // Sync non-blog alerts to Supabase
        if (otherAlerts.length > 0) {
          insertAlerts(address, otherAlerts).catch(() => {
            // silently ignore errors
          });
        }

        // Dispatch event to notify UI that alerts have been synced
        window.dispatchEvent(new CustomEvent("alertsUpdated", { detail: { address } }));
      } catch (err) {
        // silently ignore errors during initial sync
      }
    };

    // Listen to wallet:change event dispatched by ThirdwebWallet component
    document.addEventListener(
      "wallet:change",
      handleWalletChange as EventListener,
    );

    return () => {
      document.removeEventListener(
        "wallet:change",
        handleWalletChange as EventListener,
      );
    };
  }, []);
}
