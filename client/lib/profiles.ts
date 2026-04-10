/**
 * Profiles Library
 * 
 * Caches public.profiles data to prevent live API queries and improve resilience.
 * Profiles are fetched once and cached in memory with localStorage as fallback.
 */

import { withSupabaseFallback } from "@/lib/supabaseErrorHandler";

export interface Profile {
  internal_userid: string;
  wallet_address: string;
  email: string | null;
  email_verified: boolean;
  email_source: string;
  username: string | null;
  tos_accepted_at: string | null;
  created_at: string;
  beta_allowlist: boolean;
  cor_airdrop: string | null;
  premiere_box_airdrop: string | null;
  favorite_team: string | null;
}

// In-memory cache
let profilesCache: Map<string, Profile> | null = null;
let lastFetchTime: number = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

const STORAGE_KEY = "profiles_cache";
const STORAGE_TIME_KEY = "profiles_cache_time";

/**
 * Load profiles from localStorage
 */
function loadProfilesFromStorage(): Map<string, Profile> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return new Map();
    const data = JSON.parse(stored) as Array<[string, Profile]>;
    return new Map(data);
  } catch {
    return new Map();
  }
}

/**
 * Save profiles to localStorage
 */
function saveProfilesToStorage(profiles: Map<string, Profile>): void {
  try {
    const data = Array.from(profiles.entries());
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorage.setItem(STORAGE_TIME_KEY, String(Date.now()));
  } catch {
    // Silently ignore localStorage errors
  }
}

/**
 * Check if cache is still valid
 */
function isCacheValid(): boolean {
  return (
    profilesCache !== null &&
    Date.now() - lastFetchTime < CACHE_DURATION_MS
  );
}

/**
 * Fetch all profiles from Supabase
 */
async function fetchProfilesFromSupabase(): Promise<Profile[]> {
  const baseUrl = import.meta.env.SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.SUPABASE_ANON_KEY as string | undefined;

  if (!baseUrl || !anonKey) {
    console.warn("[ProfilesLibrary] Missing Supabase configuration");
    return [];
  }

  return withSupabaseFallback(
    "profiles-all",
    async () => {
      const root = baseUrl.replace(/\/$/, "");
      const url = `${root}/rest/v1/profiles?select=*`;

      console.debug("[ProfilesLibrary] Fetching profiles from:", url);

      const response = await fetch(url, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        const error = new Error(
          `Supabase API error: ${response.status}`,
        ) as any;
        error.status = response.status;
        throw error;
      }

      const data = (await response.json()) as Profile[];
      console.debug(
        "[ProfilesLibrary] Fetched",
        Array.isArray(data) ? data.length : 0,
        "profiles",
      );
      return Array.isArray(data) ? data : [];
    },
    [],
    "fetchProfilesFromSupabase",
  );
}

/**
 * Refresh profiles cache from Supabase
 * This should be called periodically or when profiles are updated
 */
export async function refreshProfilesCache(): Promise<void> {
  try {
    console.debug("[ProfilesLibrary] Refreshing profiles cache...");
    const profiles = await fetchProfilesFromSupabase();

    if (profiles.length > 0) {
      // Build map with wallet_address as lowercase key
      const map = new Map<string, Profile>();
      for (const profile of profiles) {
        const key = profile.wallet_address.toLowerCase();
        map.set(key, profile);
      }

      profilesCache = map;
      lastFetchTime = Date.now();
      saveProfilesToStorage(map);

      console.debug(
        "[ProfilesLibrary] Cache refreshed with",
        map.size,
        "profiles",
      );
    } else {
      // If fetch returns empty, try to use stored cache
      const stored = loadProfilesFromStorage();
      if (stored.size > 0) {
        profilesCache = stored;
        lastFetchTime = Date.now();
        console.debug(
          "[ProfilesLibrary] Using stored cache with",
          stored.size,
          "profiles",
        );
      }
    }
  } catch (err) {
    console.warn(
      "[ProfilesLibrary] Error refreshing cache:",
      err instanceof Error ? err.message : err,
    );
    // Try to fallback to stored cache
    const stored = loadProfilesFromStorage();
    if (stored.size > 0) {
      profilesCache = stored;
      lastFetchTime = Date.now();
      console.debug(
        "[ProfilesLibrary] Fallback to stored cache with",
        stored.size,
        "profiles",
      );
    }
  }
}

/**
 * Ensure profiles cache is loaded
 * If cache is expired, refresh it
 */
async function ensureProfilesLoaded(): Promise<void> {
  if (isCacheValid()) {
    console.debug(
      "[ProfilesLibrary] Cache is still valid, size:",
      profilesCache?.size,
    );
    return; // Cache is still fresh
  }

  if (profilesCache === null) {
    console.debug("[ProfilesLibrary] Cache is null, loading from storage...");
    // First load - try storage first, then fetch
    profilesCache = loadProfilesFromStorage();
    if (profilesCache.size === 0) {
      console.debug("[ProfilesLibrary] Storage is empty, fetching from API...");
      // Storage is empty, fetch from API
      await refreshProfilesCache();
    } else {
      lastFetchTime = Date.now();
      console.debug(
        "[ProfilesLibrary] Loaded from storage:",
        profilesCache.size,
        "profiles",
      );
    }
  } else {
    console.debug("[ProfilesLibrary] Cache exists but is expired, refreshing...");
    // Cache exists but is expired, refresh
    await refreshProfilesCache();
  }
}

/**
 * Get username for a wallet address
 * Returns the username or null if not found
 */
export async function getUsernameForWallet(
  walletAddress: string | null | undefined,
): Promise<string | null> {
  if (!walletAddress) return null;

  try {
    await ensureProfilesLoaded();

    if (!profilesCache) {
      console.debug("[ProfilesLibrary] No profiles cache available");
      return null;
    }

    const key = walletAddress.toLowerCase();
    const profile = profilesCache.get(key);

    if (profile?.username) {
      console.debug(
        "[ProfilesLibrary] Found username for",
        key.substring(0, 6),
        ":",
        profile.username,
      );
      return profile.username;
    }

    console.debug(
      "[ProfilesLibrary] No username found for",
      key.substring(0, 6),
    );
    return null;
  } catch (err) {
    console.warn(
      "[ProfilesLibrary] Error getting username:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Get full profile for a wallet address
 */
export async function getProfileForWallet(
  walletAddress: string | null | undefined,
): Promise<Profile | null> {
  if (!walletAddress) return null;

  try {
    await ensureProfilesLoaded();

    if (!profilesCache) return null;

    const key = walletAddress.toLowerCase();
    return profilesCache.get(key) || null;
  } catch (err) {
    console.warn(
      "[ProfilesLibrary] Error getting profile:",
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}

/**
 * Get all cached profiles
 */
export function getAllCachedProfiles(): Profile[] {
  if (!profilesCache) return [];
  return Array.from(profilesCache.values());
}

/**
 * Get cache size
 */
export function getCacheSize(): number {
  return profilesCache?.size ?? 0;
}

/**
 * Clear cache
 */
export function clearProfilesCache(): void {
  profilesCache = null;
  lastFetchTime = 0;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_TIME_KEY);
  } catch {
    // Silently ignore
  }
  console.debug("[ProfilesLibrary] Cache cleared");
}

/**
 * Initialize profiles cache on app start
 * This should be called once when the app loads
 */
export async function initializeProfilesCache(): Promise<void> {
  console.debug("[ProfilesLibrary] Initializing profiles cache...");
  await ensureProfilesLoaded();
}
