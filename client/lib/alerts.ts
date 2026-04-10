import { fetchRelicSerialByTokenId } from "@/lib/supabaseRelicSerialsJoined";
import {
  fetchWalletDailyValue,
  getWalletValueHistory,
} from "@/lib/walletDailyValue";
import { calculateRankLevel } from "@/lib/rmvPerOwner";
import { generateEditionEventAlerts } from "@/lib/editionEventAlerts";
import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";
import { getContract, readContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { getAlchemyThirdwebClient } from "@/lib/alchemyThirdwebClient";
import { getUsernameForWallet, refreshProfilesCache } from "@/lib/profiles";
import { fetchAllActiveOffers, type ActiveOffer } from "@/lib/activeOffers";
import { updateAlertStatus, insertAlerts, fetchAlertsForWallet } from "@/lib/supabaseAlertsClient";

export type AlertItem = {
  id: string; // unique within wallet scope
  title: string;
  body?: string;
  createdAt: number; // epoch ms
  closed?: boolean; // user has dismissed the alert
};

function kAlerts(addr: string) {
  return `alertsData:${addr.toLowerCase()}`;
}
function kLastRead(addr: string) {
  return `alertsLastReadAt:${addr.toLowerCase()}`;
}
function kMintSig(addr: string) {
  return `alertsMintedSig:${addr.toLowerCase()}`;
}

// In-memory unseen alerts tracking (session-based, not persisted to localStorage)
const unseenAlertsMap = new Map<string, Set<string>>();

function getUnseenAlertsForWallet(address: string): Set<string> {
  const normalized = address.toLowerCase();
  if (!unseenAlertsMap.has(normalized)) {
    unseenAlertsMap.set(normalized, new Set());
  }
  return unseenAlertsMap.get(normalized)!;
}

/**
 * Helper to mark newly created alerts as unseen
 * Compares old and new alert arrays to find new additions
 */
function markNewAlertsAsUnseen(
  address: string,
  oldAlerts: AlertItem[],
  newAlerts: AlertItem[],
) {
  const oldIds = new Set(oldAlerts.map((a) => a.id));
  for (const alert of newAlerts) {
    if (!oldIds.has(alert.id)) {
      // This is a new alert - mark as unseen
      markAlertAsUnseen(address, alert.id);
    }
  }
}

export function getAlerts(address: string | null | undefined): AlertItem[] {
  if (!address) return [];
  try {
    const raw = localStorage.getItem(kAlerts(address));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AlertItem[]) : [];
  } catch {
    return [];
  }
}

export function setAlerts(address: string, items: AlertItem[]) {
  try {
    // Get old alerts to identify new ones
    const oldAlerts = getAlerts(address);
    const oldIds = new Set(oldAlerts.map((a) => a.id));

    // Save to localStorage
    localStorage.setItem(kAlerts(address), JSON.stringify(items));

    // Write all alerts to Supabase in parallel (non-blocking)
    // This ensures alerts are synced immediately when they're created
    // Supabase's alertExists() check prevents duplicates
    if (items.length > 0) {
      insertAlerts(address, items).catch(() => {
        // silently ignore errors
      });
    }
  } catch (err) {
    // silently ignore errors
  }
}

export function getLastRead(address: string | null | undefined): number {
  if (!address) return 0;
  const n = Number(localStorage.getItem(kLastRead(address)) || 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Check if there are unseen alerts for a wallet
 * Uses in-memory session-based tracking (not persisted)
 */
export function hasUnread(address: string | null | undefined): boolean {
  if (!address) return false;
  const unseen = getUnseenAlertsForWallet(address);
  return unseen.size > 0;
}

/**
 * Check if there are any unclosed alerts for a wallet
 * Returns true if any alert has closed !== true
 */
/**
 * Get count of closed alerts for a wallet
 * Useful for debugging closed alert persistence
 */
export function getClosedAlertCount(address: string | null | undefined): number {
  if (!address) return 0;
  const alerts = getAlerts(address);
  return alerts.filter((a) => a.closed).length;
}

/**
 * Verify that a specific alert is marked as closed
 */
export function isAlertClosed(
  address: string | null | undefined,
  alertId: string,
): boolean {
  if (!address) return false;
  const alerts = getAlerts(address);
  const alert = alerts.find((a) => a.id === alertId);
  return alert?.closed === true;
}

export function hasUnclosedAlerts(
  address: string | null | undefined,
): boolean {
  if (!address) return false;
  try {
    // Check localStorage alerts for any that aren't closed
    const alerts = getAlerts(address);
    return alerts.some((a) => !a.closed);
  } catch {
    return false;
  }
}

/**
 * Check if wallet has any open alerts in Supabase
 * Used to determine if bell should be orange
 * Supabase is the single source of truth for alert display
 */
export async function hasOpenAlerts(
  address: string | null | undefined,
): Promise<boolean> {
  if (!address) return false;
  try {
    const supabaseAlerts = await fetchAlertsForWallet(address);
    return supabaseAlerts.some((a) => !a.closed);
  } catch {
    return false;
  }
}

/**
 * Mark a specific alert as unseen (in-memory, session-based)
 */
export function markAlertAsUnseen(
  address: string | null | undefined,
  alertId: string,
) {
  if (!address) return;
  const unseen = getUnseenAlertsForWallet(address);
  unseen.add(alertId);
  // Dispatch event for UI updates
  window.dispatchEvent(
    new CustomEvent("alertsUpdated", {
      detail: { key: `unseen-${address.toLowerCase()}` },
    }),
  );
}

/**
 * Mark all alerts as seen (clears unseen state in-memory)
 * Called when user navigates away from /alerts page
 */
export function markAllAlertsAsSeen(address: string | null | undefined) {
  if (!address) return;
  const unseen = getUnseenAlertsForWallet(address);
  const count = unseen.size;
  unseen.clear();
  // Dispatch event for UI updates
  window.dispatchEvent(
    new CustomEvent("alertsUpdated", {
      detail: { key: `unseen-${address.toLowerCase()}` },
    }),
  );
}

/**
 * Mark a specific alert as seen (removes from unseen set)
 */
export function markAlertAsSeen(
  address: string | null | undefined,
  alertId: string,
) {
  if (!address) return;
  const unseen = getUnseenAlertsForWallet(address);
  unseen.delete(alertId);
  // Dispatch event for UI updates
  window.dispatchEvent(
    new CustomEvent("alertsUpdated", {
      detail: { key: `unseen-${address.toLowerCase()}` },
    }),
  );
}

/**
 * Get IDs of all unseen alerts for a wallet
 */
export function getUnseenAlertIds(
  address: string | null | undefined,
): Set<string> {
  if (!address) return new Set();
  return getUnseenAlertsForWallet(address);
}

/**
 * Legacy function - kept for backward compatibility
 * Now just marks all as seen (no longer uses localStorage timestamps)
 */
export function markAllRead(address: string | null | undefined, ts?: number) {
  if (!address) return;
  // Mark all alerts as seen in-memory
  markAllAlertsAsSeen(address);
}

/**
 * Mark an alert as closed by setting its closed flag to true
 * Closed alerts are filtered out from display in the alerts page
 * Persists to localStorage and Supabase, notifies UI to update
 */
/**
 * Mark a specific alert as closed
 * Closed alerts are filtered out from display in the alerts page
 * Persists to localStorage and Supabase, notifies UI to update
 *
 * @param address - Wallet address
 * @param alertId - Alert ID
 * @param createdAt - Optional: Alert creation timestamp (required for blog alerts which are Supabase-only)
 */
export function closeAlert(
  address: string | null | undefined,
  alertId: string,
  createdAt?: number,
) {
  if (!address) {
    return;
  }

  try {
    // Normalize address to lowercase for consistent storage
    const normalizedAddress = address.toLowerCase();

    // Blog post alerts are Supabase-only, not in localStorage
    // So for blog alerts, just update Supabase directly
    if (alertId.startsWith("blog-post:")) {
      // Update Supabase directly for blog alerts
      // Note: createdAt may not be needed if id + wallet_address is unique
      updateAlertStatus(normalizedAddress, alertId, "closed", createdAt).catch(
        () => {
          // silently ignore errors
        },
      );

      // Dispatch custom event to trigger UI refresh
      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: { address: normalizedAddress, alertId },
        }),
      );
      return;
    }

    // For non-blog alerts, update localStorage and Supabase
    const alerts = getAlerts(normalizedAddress);
    const alertIdx = alerts.findIndex((a) => a.id === alertId);

    if (alertIdx >= 0) {
      // Mark alert as closed
      alerts[alertIdx] = {
        ...alerts[alertIdx],
        closed: true,
      };

      // Save updated alerts using normalized address
      setAlerts(normalizedAddress, alerts);

      const alertCreatedAt = alerts[alertIdx].createdAt;

      // Also update Supabase status to 'closed'
      // Pass createdAt for proper identification since primary key includes created_at
      updateAlertStatus(
        normalizedAddress,
        alertId,
        "closed",
        alertCreatedAt,
      ).catch(() => {
        // silently ignore errors
      });

      // Dispatch storage event for UI updates
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: kAlerts(normalizedAddress),
        }),
      );

      // Also dispatch custom event to ensure UI updates
      window.dispatchEvent(
        new CustomEvent("alertsUpdated", {
          detail: { address: normalizedAddress, alertId },
        }),
      );
    }
  } catch (err) {
    // silently ignore errors
  }
}

function getMintSignature(address: string): string | null {
  try {
    return localStorage.getItem(kMintSig(address)) || null;
  } catch {
    return null;
  }
}
function setMintSignature(address: string, sig: string) {
  try {
    localStorage.setItem(kMintSig(address), sig);
  } catch {}
}

export function updateNewRelicsAlert(address: string, currentIds: number[]) {
  if (!address || !Array.isArray(currentIds)) return;
  const uniq = Array.from(new Set(currentIds)).sort((a, b) => a - b);
  const sig = JSON.stringify(uniq);
  const prevSig = getMintSignature(address);
  if (prevSig === sig) return; // no change
  setMintSignature(address, sig);

  const title = "New relics have been voted in by your fellow fans";
  const body =
    "20% of all new supply is up for grabs. Tap here to earn it by redeeming prior supply.";
  const now = Date.now();
  const items = getAlerts(address);
  const alertId = "new-relics";
  const idx = items.findIndex((a) => a.id === alertId);
  if (idx >= 0) {
    items[idx] = { ...items[idx], title, body, createdAt: now };
  } else {
    items.push({ id: alertId, title, body, createdAt: now });
    // Mark as unseen since it's a new alert
    markAlertAsUnseen(address, alertId);
  }
  setAlerts(address, items);
}

export async function pollNewRelicsAndUpdate(
  address: string,
  signal?: AbortSignal,
) {
  try {
    const ids = await fetchMintedEditionIds(signal);
    updateNewRelicsAlert(address, ids);
  } catch {}
}

export function addRankChangeAlert(address: string, rankLevel: string): void {
  if (!address) return;

  const title = `You've just moved to the ${rankLevel} tier`;
  const subtitle =
    rankLevel === "Diamond"
      ? "You can now gain access to the biggest trophy case on your collection page."
      : `You can now gain access to the allow list for ${rankLevel} box drops or below`;
  const now = Date.now();
  const items = getAlerts(address);

  const alertId = `rank-change:${rankLevel}:${now}`;

  items.push({
    id: alertId,
    title,
    body: subtitle,
    createdAt: now,
  });

  setAlerts(address, items);
  // Dispatch storage event for alerts page listener
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: kAlerts(address),
        storageArea: localStorage,
      }),
    );
  } catch {
    // Fallback: trigger a custom event if StorageEvent fails
    window.dispatchEvent(
      new CustomEvent("alertsUpdated", {
        detail: { key: kAlerts(address) },
      }),
    );
  }
}

export type EmojiReactionWithRelics = {
  id: string;
  wallet_address: string;
  event_id: string;
  reactor_username?: string;
  emoji: string;
  created_at: string;
  // Optional relic fields (may not be available from base table)
  event_name?: string;
  PlayerName?: string;
  SetName?: string;
  serial?: number;
  Minted?: string;
};

export async function fetchEmojiReactionsWithRelics(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<EmojiReactionWithRelics[]> {
  if (!walletAddress) return [];

  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const normalizedWalletAddress = walletAddress.toLowerCase();

  return withSupabaseFallback(
    `emoji-reactions-${normalizedWalletAddress}`,
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      // Using base emoji_reactions table, filtering by reactee_wallet_address
      const url = `${root}/rest/v1/emoji_reactions?select=*&reactee_wallet_address=eq.${normalizedWalletAddress}`;


      const response = await fetch(url, {
        headers: supabaseHeaders(anonKey),
        signal,
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const allReactions = (await response.json()) as EmojiReactionWithRelics[];
      if (!Array.isArray(allReactions)) return [];

      // Filter locally for case-insensitive wallet address match
      return allReactions.filter(
        (r) =>
          r.reactee_wallet_address?.toLowerCase() === normalizedWalletAddress,
      );
    },
    [],
    "fetchEmojiReactionsWithRelics",
  );
}

export function addEmojiReactionAlert(
  reacteeAddress: string,
  reactorAddress: string,
  emoji: string,
  eventName: string,
) {
  if (!reacteeAddress) return;

  const title = `${emoji} New reaction to your ${eventName} event`;
  const now = Date.now();
  const items = getAlerts(reacteeAddress);

  const alertId = `emoji-reaction:${reacteeAddress}:${reactorAddress}:${emoji}:${now}`;

  items.push({
    id: alertId,
    title,
    createdAt: now,
  });

  setAlerts(reacteeAddress, items);

  // Dispatch a storage event to notify other windows
  try {
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: kAlerts(reacteeAddress),
        storageArea: localStorage,
      }),
    );
  } catch {
    // Fallback: trigger a custom event if StorageEvent fails
    window.dispatchEvent(
      new CustomEvent("alertsUpdated", {
        detail: { key: kAlerts(reacteeAddress) },
      }),
    );
  }
}

export async function updateEmojiReactionAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    const reactions = await fetchEmojiReactionsWithRelics(
      walletAddress,
      signal,
    );

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedReactionIds = new Set<string>();

    for (const reaction of reactions) {
      const alertId = `emoji-reaction:${reaction.id}`;
      processedReactionIds.add(reaction.id);

      // Fetch reactor username from profiles if not available
      let reactorUsername = reaction.reactor_username;
      if (!reactorUsername) {
        // Try to get username from profiles library by extracting from wallet_address
        // Note: emoji_reactions table may have event_creator_wallet or similar
        reactorUsername = await getUsernameForWallet(reaction.wallet_address);
      }
      if (!reactorUsername) {
        reactorUsername = reaction.wallet_address.substring(0, 10) + "...";
      }

      const title = `${reaction.emoji} ${reactorUsername} reacted to an event`;
      const body = reaction.event_name
        ? `They reacted to your ${reaction.event_name}.`
        : "They reacted to your event.";
      const createdAtTime = new Date(reaction.created_at).getTime();

      // Find and update existing alert or add new one
      const existingIdx = items.findIndex((a) => a.id === alertId);
      if (existingIdx >= 0) {
        items[existingIdx] = {
          id: alertId,
          title,
          body,
          createdAt: items[existingIdx].createdAt,
        };
      } else {
        items.push({
          id: alertId,
          title,
          body,
          createdAt: createdAtTime,
        });
      }
    }

    // Remove alerts for reactions that are no longer in results if we had a successful fetch
    if (reactions.length > 0) {
      items = items.filter((a) => {
        if (a.id.startsWith("emoji-reaction:")) {
          const reactionId = a.id.substring("emoji-reaction:".length);
          return processedReactionIds.has(reactionId);
        }
        return true;
      });
    }

    // Mark newly added alerts as unseen
    markNewAlertsAsUnseen(walletAddress, oldItems, items);

    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
    // silently ignore errors
  }
}

export type NewSaleWithRelics = {
  marketplace_event_id: string;
  event_name: string;
  token_id: string;
  seller: string;
  buyer: string;
  price: string;
  emitted_at: string;
  updated_at: string;
  PlayerName: string;
  SetName: string;
  serial: number;
  Minted: string;
};

export async function fetchNewSalesWithRelics(
  signal?: AbortSignal,
): Promise<NewSaleWithRelics[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    "new-sales",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/marketplace_events_with_relics?select=*&event_name=eq.Purchased`;


      const response = await fetch(url, {
        headers: supabaseHeaders(anonKey),
        signal,
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as NewSaleWithRelics[];
      return Array.isArray(data) ? data : [];
    },
    [],
    "fetchNewSalesWithRelics",
  );
}

export async function updateNewSaleAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    const sales = await fetchNewSalesWithRelics(signal);
    const normalizedWalletAddress = walletAddress.toLowerCase();

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedSaleIds = new Set<string>();

    // Filter sales where the user is the seller
    const relevantSales = sales.filter(
      (sale) =>
        sale.seller && sale.seller.toLowerCase() === normalizedWalletAddress,
    );

    for (const sale of relevantSales) {
      const alertId = `new-sale:${sale.marketplace_event_id}`;
      processedSaleIds.add(sale.marketplace_event_id);

      // Fetch buyer's username from profiles cache
      let displayBuyer = await getUsernameForWallet(sale.buyer);
      // Fallback to wallet address if username not found
      if (!displayBuyer) {
        displayBuyer = sale.buyer;
      }

      const priceInTokens = Number(BigInt(sale.price)) / 1e18;
      const formattedPrice = `$${priceInTokens.toFixed(2)}`;

      const title = "Your relic just sold";
      const body = `${displayBuyer} purchased your ${sale.PlayerName} ${sale.SetName} #${sale.serial} of ${sale.Minted} for ${formattedPrice}. Tap to view the transaction.`;
      const createdAtTime = new Date(sale.emitted_at).getTime();

      // Find and update existing alert or add new one
      const existingIdx = items.findIndex((a) => a.id === alertId);
      if (existingIdx >= 0) {
        items[existingIdx] = {
          id: alertId,
          title,
          body,
          createdAt: items[existingIdx].createdAt,
        };
      } else {
        items.push({
          id: alertId,
          title,
          body,
          createdAt: createdAtTime,
        });
      }
    }

    // Remove alerts for sales that are no longer in results if we had a successful fetch
    if (sales.length > 0) {
      items = items.filter((a) => {
        if (a.id.startsWith("new-sale:")) {
          const saleId = a.id.substring("new-sale:".length);
          return processedSaleIds.has(saleId);
        }
        return true;
      });
    }

    // Mark newly added alerts as unseen
    markNewAlertsAsUnseen(walletAddress, oldItems, items);

    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
    // silently ignore errors
  }
}

export async function fetchNewOfferEventsWithRelics(
  signal?: AbortSignal,
): Promise<ActiveOffer[]> {
  // Use blockchain-based active offers instead of trying to query a non-existent Supabase view
  try {
    const offers = await fetchAllActiveOffers();
    return offers;
  } catch (err) {
    return [];
  }
}

export async function updateNewOfferAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    const offers = await fetchNewOfferEventsWithRelics(signal);
    const normalizedWalletAddress = walletAddress.toLowerCase();

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedOfferIds = new Set<string>();

    for (const offer of offers) {
      // Check if current user is the owner of this token
      const currentOwner = await fetchTokenOwnerFromRPC(offer.tokenId, signal);
      if (!currentOwner || currentOwner !== normalizedWalletAddress) {
        // User doesn't own this token, skip it
        continue;
      }

      // We already have edition_id and serial from the activeOffers fetch
      const editionId = offer.editionId;
      const serial = offer.serial;

      // Skip if we don't have relic metadata
      if (!editionId || serial === null) {
        continue;
      }

      // Get offeror's username from profiles cache
      let displayOfferor = await getUsernameForWallet(offer.offeror);
      if (!displayOfferor) {
        displayOfferor = offer.offeror.substring(0, 10) + "...";
      }

      // Format price from wei to readable format
      const priceInTokens = Number(BigInt(offer.totalPrice)) / 1e18;
      const formattedPrice = `$${priceInTokens.toFixed(2)}`;

      // Format expiration timestamp
      const expirationDate = new Date(
        offer.expirationTimestamp * 1000,
      ).toLocaleString();

      const alertId = `new-offer:${offer.offerId}`;
      processedOfferIds.add(offer.offerId);
      const title = "You've got a new offer";

      // Store both display text and navigation data in body (JSON format)
      const displayText = `${displayOfferor} wants to buy your relic #${serial} for ${formattedPrice}. The offer expires ${expirationDate}. Tap to review and accept.`;
      const body = JSON.stringify({
        displayText,
        edition_id: editionId,
        serial: serial,
        offer_expiration_ts: offer.expirationTimestamp,
      });


      // For alerts, use the current time as the alert creation time
      // (we're regenerating alerts on each page load, not tracking when the offer was made)
      const createdAtTime = Date.now();

      // Find and update existing alert or add new one
      const existingIdx = items.findIndex((a) => a.id === alertId);
      if (existingIdx >= 0) {
        // Update existing alert with fresh username resolution
        items[existingIdx] = {
          id: alertId,
          title,
          body,
          createdAt: items[existingIdx].createdAt, // Keep original timestamp for sorting
        };
      } else {
        // Add new alert
        items.push({
          id: alertId,
          title,
          body,
          createdAt: createdAtTime,
        });
      }
    }

    // Remove alerts for offers that are no longer active (expired/cancelled)
    // Only remove if we had a successful fetch
    if (offers.length >= 0) {
      items = items.filter((a) => {
        if (a.id.startsWith("new-offer:")) {
          const offerId = a.id.substring("new-offer:".length);
          const isActive = processedOfferIds.has(offerId);
          if (!isActive) {
          }
          return isActive;
        }
        return true;
      });
    }

    // Mark newly added alerts as unseen
    markNewAlertsAsUnseen(walletAddress, oldItems, items);

    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
    // Don't throw - let withSupabaseFallback handle errors for other alert types
  }
}

export type AcceptedOfferWithRelics = {
  marketplace_event_id: string;
  token_id: string;
  seller: string;
  buyer: string;
  price: string;
  emitted_at: string;
  updated_at: string;
  PlayerName: string;
  SetName: string;
  serial: number;
  Minted: string;
  edition_id: number;
};

export async function fetchAcceptedOffersWithRelics(
  signal?: AbortSignal,
): Promise<AcceptedOfferWithRelics[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  return withSupabaseFallback(
    "accepted-offers",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/marketplace_events_with_relics?select=*&event_name=eq.OfferAccepted`;


      const response = await fetch(url, {
        headers: supabaseHeaders(anonKey),
        signal,
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as AcceptedOfferWithRelics[];
      return Array.isArray(data) ? data : [];
    },
    [],
    "fetchAcceptedOffersWithRelics",
  );
}

export async function updateAcceptedOfferAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    const offers = await fetchAcceptedOffersWithRelics(signal);
    const normalizedWalletAddress = walletAddress.toLowerCase();

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedOfferIds = new Set<string>();

    const relevantOffers = offers.filter(
      (offer) => offer.buyer?.toLowerCase() === normalizedWalletAddress,
    );

    for (const offer of relevantOffers) {
      const alertId = `accepted-offer:${offer.marketplace_event_id}`;
      processedOfferIds.add(offer.marketplace_event_id);

      const priceInTokens = Number(BigInt(offer.price)) / 1e18;
      const formattedPrice = `$${priceInTokens.toFixed(2)}`;

      const title = "Your offer was accepted";
      const body = `Your offer for ${offer.PlayerName} ${offer.SetName} #${offer.serial} of ${offer.Minted} for ${formattedPrice} has been accepted! Tap to view your new relic.`;
      const createdAtTime = new Date(offer.emitted_at).getTime();

      // Find and update existing alert or add new one
      const existingIdx = items.findIndex((a) => a.id === alertId);
      if (existingIdx >= 0) {
        items[existingIdx] = {
          id: alertId,
          title,
          body,
          createdAt: items[existingIdx].createdAt,
        };
      } else {
        items.push({
          id: alertId,
          title,
          body,
          createdAt: createdAtTime,
        });
      }
    }

    // Remove alerts for offers that are no longer in results if we had a successful fetch
    if (offers.length > 0) {
      items = items.filter((a) => {
        if (a.id.startsWith("accepted-offer:")) {
          const offerId = a.id.substring("accepted-offer:".length);
          return processedOfferIds.has(offerId);
        }
        return true;
      });
    }

    // Mark newly added alerts as unseen
    markNewAlertsAsUnseen(walletAddress, oldItems, items);

    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
    // silently ignore errors
  }
}

export type FollowerWithUsername = {
  follower_address: string;
  followee_address: string;
  followee_username?: string;
  created_at: string;
};

export async function fetchFollowersWithUsernames(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<FollowerWithUsername[]> {
  if (!walletAddress) return [];

  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return [];

  const normalizedWalletAddress = walletAddress.toLowerCase();

  // No caching for followers - this data changes frequently and users need fresh alerts
  const root = baseUrl.replace(/\/$/, "");

  // First try the view, fall back to base table if view doesn't exist
  let data: Array<{
    follower_address: string;
    followee_address: string;
    follower_username: string | null;
    created_at: string;
  }> = [];

  try {
    // Try using followlists_with_usernames view (optimized)
    // Use ilike for case-insensitive address matching (addresses are stored with mixed case in DB)
    const viewUrl = `${root}/rest/v1/followlists_with_usernames?select=follower_address,followee_address,follower_username,created_at&followee_address=ilike.${normalizedWalletAddress}`;

    const viewResponse = await fetch(viewUrl, {
      headers: supabaseHeaders(anonKey),
      signal,
    });

    if (viewResponse.ok) {
      data = (await viewResponse.json()) as Array<{
        follower_address: string;
        followee_address: string;
        follower_username: string | null;
        created_at: string;
      }>;
      if (data.length === 0) {
        // View exists but returns no data - fall back to base table to check if data exists there
        throw new Error("View returned 0 results, trying base table");
      }
    } else if (viewResponse.status === 404) {
      // View doesn't exist, try base table
      throw new Error("View not found, using fallback");
    } else {
      throw new Error(`View query failed: ${viewResponse.status}`);
    }
  } catch (viewErr) {
    // Fall back to base followlists table
    // Use ilike for case-insensitive address matching (addresses are stored with mixed case in DB)
    const tableUrl = `${root}/rest/v1/followlists?select=follower_address,followee_address,created_at&followee_address=ilike.${normalizedWalletAddress}`;

    try {
      const tableResponse = await fetch(tableUrl, {
        headers: supabaseHeaders(anonKey),
        signal,
      });

      if (!tableResponse.ok) {
        return [];
      }

      const tableData = (await tableResponse.json()) as Array<{
        follower_address: string;
        followee_address: string;
        created_at: string;
      }>;

      if (tableData.length === 0) {
      } else {
      }

      // Convert base table format - will need username lookup
      data = tableData.map(item => ({
        follower_address: item.follower_address,
        followee_address: item.followee_address,
        follower_username: null, // Will be fetched separately
        created_at: item.created_at,
      }));
    } catch (tableErr) {
      return [];
    }
  }

  // Map the response to FollowerWithUsername format
  const result = Array.isArray(data) ? data.map(item => ({
    follower_address: item.follower_address,
    followee_address: item.followee_address,
    followee_username: item.follower_username || undefined, // follower's username (the fan)
    created_at: item.created_at,
  })) : [];

  return result;
}

export async function updateNewFanAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    const followers = await fetchFollowersWithUsernames(walletAddress, signal);
    if (followers.length === 0) {
    }

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedFollowerIds = new Set<string>();

    // Add current followers from the fetch results
    for (const follower of followers) {
      const followerId = follower.follower_address.toLowerCase();
      const alertId = `new-fan:${followerId}`;
      processedFollowerIds.add(followerId);


      // Use username from the view, or fetch if not available (fallback case)
      let followerUsername = follower.followee_username;
      if (!followerUsername) {
        // Fallback: fetch username if not provided by view
        followerUsername = await getUsernameForWallet(followerId);
        if (!followerUsername) {
          followerUsername = followerId.substring(0, 10) + "...";
        }
      }

      const title = "You have a new fan";
      const displayText = `${followerUsername} is now following your market activity. Check out their collector page.`;
      const createdAtTime = new Date(follower.created_at).getTime();

      // Store navigation data in body (JSON format)
      const bodyData = JSON.stringify({
        displayText,
        follower_address: followerId,
        follower_username: followerUsername,
      });

      // Find and update existing alert or add new one
      const existingIdx = items.findIndex((a) => a.id === alertId);
      if (existingIdx >= 0) {
        items[existingIdx] = {
          id: alertId,
          title,
          body: bodyData,
          createdAt: items[existingIdx].createdAt,
        };
      } else {
        items.push({
          id: alertId,
          title,
          body: bodyData,
          createdAt: createdAtTime,
        });
      }
    }

    // Remove alerts for followers that are no longer following if we had a successful fetch
    if (followers.length > 0) {
      items = items.filter((a) => {
        if (a.id.startsWith("new-fan:")) {
          const followerId = a.id.substring("new-fan:".length);
          return processedFollowerIds.has(followerId);
        }
        return true;
      });
    }

    // Mark newly added alerts as unseen
    markNewAlertsAsUnseen(walletAddress, oldItems, items);


    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
  }
}

export async function deriveRankChangeAlerts(
  walletAddress: string | null | undefined,
): Promise<AlertItem[]> {
  if (!walletAddress) return [];

  try {
    // Fetch all wallet daily value records
    const allRecords = await fetchWalletDailyValue();

    // Get history for this wallet, sorted by snapshot_ts (newest first)
    const history = getWalletValueHistory(allRecords, walletAddress);

    // Reverse to get chronological order (oldest to newest)
    const chronological = history.slice().reverse();

    if (chronological.length === 0) return [];

    const alerts: AlertItem[] = [];
    let previousRankLevel: string | null = null;

    for (const record of chronological) {
      // Use Percentile field from wallet_daily_value to calculate rank level
      const percentile = record.Percentile ?? 0;
      const currentRankLevel = calculateRankLevel(percentile);

      // Create alert for initial tier (first record) or when tier changes
      if (
        previousRankLevel === null ||
        previousRankLevel !== currentRankLevel
      ) {
        // Parse snapshot_ts (format: "2025-12-29 00:00:00+00") to milliseconds
        const snapshotTime = new Date(record.snapshot_ts).getTime();

        const title = `You've just moved to the ${currentRankLevel} tier`;
        const body = `You can now gain access to the allow list for ${currentRankLevel} box drops or below`;

        alerts.push({
          id: `rank-change:${record.snapshot_ts}:${currentRankLevel}`,
          title,
          body,
          createdAt: snapshotTime,
        });
      }

      previousRankLevel = currentRankLevel;
    }

    return alerts;
  } catch (err) {
    return [];
  }
}

export async function updateEditionEventAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  try {
    // Generate edition event alerts from subscriptions
    // This joins marketplace_events_with_relics with eventsubscriptions
    const editionEventAlerts = await generateEditionEventAlerts(walletAddress);

    // Get current alerts
    const existingAlerts = getAlerts(walletAddress);

    // Remove old edition-event alerts to replace with fresh set
    const filteredAlerts = existingAlerts.filter(
      (a) => !a.id.startsWith("edition-event:"),
    );

    // Merge with new edition-event alerts
    const mergedAlerts = [...filteredAlerts, ...editionEventAlerts];

    // Sort by createdAt descending (newest first)
    mergedAlerts.sort((a, b) => b.createdAt - a.createdAt);

    // Mark newly generated alerts as unseen
    markNewAlertsAsUnseen(walletAddress, filteredAlerts, editionEventAlerts);

    setAlerts(walletAddress, mergedAlerts);

    // Dispatch event so alerts page updates
    window.dispatchEvent(new Event("alertsUpdated"));
  } catch (err) {
  }
}

// Helper functions that are referenced but not defined above
function supabaseHeaders(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export async function fetchMintedEditionIds(
  signal?: AbortSignal,
): Promise<number[]> {
  return [];
}

export async function fetchTokenOwnerFromRPC(
  token_id: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const erc721Address = import.meta.env.VITE_ERC721_ADDRESS as
    | string
    | undefined;

  if (!erc721Address) {
    return null;
  }

  try {
    // Use thirdweb SDK to call ownerOf on the ERC721 contract
    const client = getAlchemyThirdwebClient();
    const contract = getContract({
      address: erc721Address,
      chain: polygon,
      client,
    });

    const owner = (await readContract({
      contract,
      method: "function ownerOf(uint256 tokenId) view returns (address)",
      params: [BigInt(token_id)],
    })) as string;


    return owner ? owner.toLowerCase() : null;
  } catch (err) {
    return null;
  }
}

export async function removeCancelledOfferAlerts(
  walletAddress: string,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return;

  try {
    // Fetch cancelled offer IDs from marketplace events
    const root = baseUrl.replace(/\/$/, "");
    const url = `${root}/rest/v1/marketplace_events_with_relics?event_name=eq.CancelledOffer&select=offer_id`;


    const response = await fetch(url, {
      headers: supabaseHeaders(anonKey),
      signal,
    });

    if (!response.ok) {
      return;
    }

    const events = (await response.json()) as Array<{ offer_id: string }>;
    const cancelledOfferIds = new Set(
      Array.isArray(events) ? events.map((e) => e.offer_id) : [],
    );

    if (cancelledOfferIds.size === 0) return;

    // Remove alerts for cancelled offers
    const items = getAlerts(walletAddress);
    const filtered = items.filter((a) => {
      if (a.id.startsWith("new-offer:")) {
        const offerId = a.id.substring("new-offer:".length);
        return !cancelledOfferIds.has(offerId);
      }
      return true;
    });

    if (filtered.length !== items.length) {
      setAlerts(walletAddress, filtered);
      window.dispatchEvent(
        new StorageEvent("storage", { key: kAlerts(walletAddress) }),
      );
    }
  } catch (err) {
    // silently ignore errors
  }
}

/**
 * Comprehensive marketplace alerts handler
 * Processes all marketplace event types (NewSale, AuctionClosed, NewBid, NewOffer, OfferAccepted)
 * for all relevant wallet roles
 */
export async function updateMarketplaceAlertsWithDetails(
  walletAddress: string | null | undefined,
  signal?: AbortSignal,
): Promise<void> {
  if (!walletAddress) return;

  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) return;

  try {
    const root = baseUrl.replace(/\/$/, "");
    const normalizedWalletAddress = walletAddress.toLowerCase();

    // Fetch all marketplace events with relics
    const url = `${root}/rest/v1/marketplace_events_with_relics?order=emitted_at.desc&limit=500`;
    const response = await fetch(url, {
      headers: supabaseHeaders(anonKey),
      signal,
    });

    if (!response.ok) {
      return;
    }

    const allEvents = (await response.json()) as any[];
    if (!Array.isArray(allEvents)) return;

    const oldItems = getAlerts(walletAddress);
    let items = [...oldItems];
    const processedAlertIds = new Set<string>();

    // Helper function to format price from wei
    const formatPrice = (weiValue: string | number | bigint | null): string => {
      if (!weiValue) return "$0.00";
      try {
        const num = Number(BigInt(String(weiValue))) / 1e18;
        return `$${num.toFixed(2)}`;
      } catch {
        return "$0.00";
      }
    };

    // Helper function to format unix timestamp
    const formatUnixTime = (timestamp: string | number | null): string => {
      if (!timestamp) return "Unknown";
      try {
        const ts =
          typeof timestamp === "string" ? parseInt(timestamp, 10) : timestamp;
        return new Date(ts * 1000).toLocaleString();
      } catch {
        return "Unknown";
      }
    };

    // Process each event
    for (const event of allEvents) {
      const eventName = event.event_name;
      const emittedAt = new Date(event.emitted_at).getTime();
      const playerName = event.PlayerName || "Relic";
      const setName = event.SetName || "Set";
      const serial = event.serial || "Unknown";
      const minted = event.Minted || "Unknown";

      // NewSale events
      if (eventName === "NewSale") {
        // Seller perspective: listing_creator
        if (
          event.listing_creator &&
          event.listing_creator.toLowerCase() === normalizedWalletAddress &&
          event.buyer // Ensure buyer exists before using it
        ) {
          const buyerUsername = await getUsernameForWallet(event.buyer);
          const displayBuyer =
            buyerUsername || event.buyer.substring(0, 10) + "...";
          const price = formatPrice(event.total_price_paid);

          const alertId = `marketplace:new-sale-seller:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your listing sold";
          const body = JSON.stringify({
            displayText: `${displayBuyer} just bought your listing for ${playerName} ${setName} #${serial} of ${minted}! ${price} has been transferred to your wallet (minus 5% marketplace fee).`,
            link: "/market",
            event_type: "new-sale-seller",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }

        // Buyer perspective
        if (
          event.buyer &&
          event.buyer.toLowerCase() === normalizedWalletAddress
        ) {
          const price = formatPrice(event.total_price_paid);

          const alertId = `marketplace:new-sale-buyer:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Congratulations on your purchase";
          const body = JSON.stringify({
            displayText: `Congratulations on your purchase of the ${playerName} ${setName} #${serial} of ${minted} for ${price}! Your new relic has been transferred to your Collection page.`,
            link: "/collection",
            event_type: "new-sale-buyer",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }
      }

      // AuctionClosed events
      if (eventName === "AuctionClosed") {
        // Auction creator perspective
        if (
          event.auction_creator &&
          event.auction_creator.toLowerCase() === normalizedWalletAddress &&
          event.winning_bidder // Ensure winning_bidder exists before using it
        ) {
          const bidderUsername = await getUsernameForWallet(
            event.winning_bidder,
          );
          const displayBidder =
            bidderUsername || event.winning_bidder.substring(0, 10) + "...";
          const maxBid = formatPrice(event.max_bid);

          const alertId = `marketplace:auction-closed-creator:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your auction closed";
          const body = JSON.stringify({
            displayText: `Congratulations, your auction just closed for the ${playerName} ${setName} #${serial} of ${minted} relic! ${displayBidder} bid the winning bid of ${maxBid}, which has been transferred to your wallet.`,
            link: "/market",
            event_type: "auction-closed-creator",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }

        // Winning bidder perspective
        if (
          event.winning_bidder &&
          event.winning_bidder.toLowerCase() === normalizedWalletAddress
        ) {
          const maxBid = formatPrice(event.max_bid);

          const alertId = `marketplace:auction-closed-bidder:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Congratulations, you won the auction!";
          const body = JSON.stringify({
            displayText: `Congratulations, you just won the auction for the ${playerName} ${setName} #${serial} of ${minted} relic with a winning bid of ${maxBid}. Your new collectible has been transferred to your wallet.`,
            link: "/collection",
            event_type: "auction-closed-bidder",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }
      }

      // NewBid events
      if (eventName === "NewBid") {
        // Auction creator perspective
        if (
          event.auction_creator &&
          event.auction_creator.toLowerCase() === normalizedWalletAddress &&
          event.bidder // Ensure bidder exists before using it
        ) {
          const bidderUsername = await getUsernameForWallet(event.bidder);
          const displayBidder =
            bidderUsername || event.bidder.substring(0, 10) + "...";
          const bidAmount = formatPrice(event.bid_amount);
          const auctionEndTime = formatUnixTime(event.auction_end_ts);

          const alertId = `marketplace:new-bid-creator:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "New bid on your auction";
          const body = JSON.stringify({
            displayText: `Your auction for ${playerName} ${setName} #${serial} of ${minted} has a new bid of ${bidAmount} from ${displayBidder}. The auction ends at ${auctionEndTime}.`,
            link: "/active-auctions",
            event_type: "new-bid-creator",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }

        // Bidder perspective
        if (
          event.bidder &&
          event.bidder.toLowerCase() === normalizedWalletAddress
        ) {
          const bidAmount = formatPrice(event.bid_amount);
          const auctionEndTime = formatUnixTime(event.auction_end_ts);

          const alertId = `marketplace:new-bid-bidder:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your bid has been submitted";
          const body = JSON.stringify({
            displayText: `Your bid on the auction for ${playerName} ${setName} #${serial} of ${minted} has been submitted for ${bidAmount}. The auction ends at ${auctionEndTime}. Click here to keep track of the auction.`,
            link: "/active-auctions",
            event_type: "new-bid-bidder",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }
      }

      // NewOffer events (offeror perspective)
      if (eventName === "NewOffer") {
        if (
          event.offeror &&
          event.offeror.toLowerCase() === normalizedWalletAddress
        ) {
          const price = formatPrice(event.total_price);
          const expirationTime = formatUnixTime(event.offer_expiration_ts);

          const alertId = `marketplace:new-offer-offeror:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your offer has been submitted";
          const body = JSON.stringify({
            displayText: `Your offer of ${price} for ${playerName} ${setName} #${serial} of ${minted} has been submitted and expires at ${expirationTime}. Click here to keep track of the offer.`,
            link: "/active-auctions",
            event_type: "new-offer-offeror",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }
      }

      // OfferAccepted events
      if (eventName === "OfferAccepted") {
        // Offeror (buyer) perspective
        if (
          event.offeror &&
          event.offeror.toLowerCase() === normalizedWalletAddress
        ) {
          const price = formatPrice(event.total_price_paid);

          const alertId = `marketplace:offer-accepted-offeror:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your offer was accepted";
          const body = JSON.stringify({
            displayText: `Congratulations! Your offer of ${price} for ${playerName} ${setName} #${serial} of ${minted} has been accepted and should be transferred to your collection. Click here to see it.`,
            link: `/edition/${event.edition_id}/serial/${event.serial}`,
            event_type: "offer-accepted-offeror",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }

        // Seller perspective
        if (
          event.seller &&
          event.seller.toLowerCase() === normalizedWalletAddress &&
          event.offeror // Ensure offeror exists before using it
        ) {
          const offerorUsername = await getUsernameForWallet(event.offeror);
          const displayOfferor =
            offerorUsername || event.offeror.substring(0, 10) + "...";
          const price = formatPrice(event.total_price_paid);

          const alertId = `marketplace:offer-accepted-seller:${event.id}`;
          processedAlertIds.add(alertId);

          const title = "Your offer was accepted";
          const body = JSON.stringify({
            displayText: `You've accepted an offer of ${price} from ${displayOfferor} for ${playerName} ${setName} #${serial} of ${minted}. The funds should be transferred to your account or will be shortly (minus 5% marketplace fee).`,
            link: "/market",
            event_type: "offer-accepted-seller",
          });

          const existingIdx = items.findIndex((a) => a.id === alertId);
          if (existingIdx >= 0) {
            items[existingIdx] = {
              id: alertId,
              title,
              body,
              createdAt: items[existingIdx].createdAt,
            };
          } else {
            items.push({ id: alertId, title, body, createdAt: emittedAt });
          }
        }
      }
    }

    // Clean up old marketplace alerts that are no longer in results
    items = items.filter((a) => {
      if (a.id.startsWith("marketplace:")) {
        return processedAlertIds.has(a.id);
      }
      return true;
    });

    markNewAlertsAsUnseen(walletAddress, oldItems, items);
    setAlerts(walletAddress, items);
    window.dispatchEvent(
      new StorageEvent("storage", { key: kAlerts(walletAddress) }),
    );
  } catch (err) {
  }
}
