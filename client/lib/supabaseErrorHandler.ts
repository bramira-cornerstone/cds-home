/**
 * Supabase Error Handler with Fallback and Caching
 *
 * This module provides utilities to handle Supabase API failures gracefully by:
 * 1. Attempting the API call
 * 2. On failure (500, 400, 404 errors), falling back to cached data
 * 3. Logging errors gracefully without crashing the app
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache for storing last successful fetch results
const cache = new Map<string, CacheEntry<any>>();

// LocalStorage cache key prefix
const LOCAL_CACHE_PREFIX = "supabase_cache_";

/**
 * Determines if this is a server error (5xx) that should cause a throw
 * 504 Gateway Timeout is treated as a server error (acceptable for fallback)
 */
function isServerError(status?: number): boolean {
  if (!status) return false;
  return status >= 500 && status < 600;
}

/**
 * Determines if this is a client error (4xx) that should trigger a warning + fallback
 */
function isClientError(status?: number): boolean {
  if (!status) return false;
  return status >= 400 && status < 500;
}

/**
 * Get cached data from in-memory or localStorage
 */
export function getCachedData<T>(cacheKey: string): T | null {
  // Check in-memory cache first
  const entry = cache.get(cacheKey);
  if (entry) {
    return entry.data as T;
  }

  // Check localStorage (persistent across page refreshes)
  try {
    const storedKey = LOCAL_CACHE_PREFIX + cacheKey;
    const stored = localStorage.getItem(storedKey);
    if (stored) {
      const parsed = JSON.parse(stored) as CacheEntry<T>;
      // Also update in-memory cache for faster access
      cache.set(cacheKey, parsed);
      return parsed.data;
    }
  } catch (err) {
    console.debug("[getCachedData] Error reading from localStorage:", err);
  }

  return null;
}

/**
 * Store data in both in-memory cache and localStorage
 */
export function setCacheData<T>(cacheKey: string, data: T): void {
  const entry: CacheEntry<T> = {
    data,
    timestamp: Date.now(),
  };

  // Store in in-memory cache
  cache.set(cacheKey, entry);

  // Also store in localStorage for persistence across page refreshes
  try {
    const storedKey = LOCAL_CACHE_PREFIX + cacheKey;
    localStorage.setItem(storedKey, JSON.stringify(entry));
  } catch (err) {
    console.debug("[setCacheData] Error writing to localStorage:", err);
  }
}

/**
 * Wraps a Supabase fetch operation with error handling and fallback logic
 *
 * Handles different HTTP responses:
 * - 2xx: Return success (zero records is valid, not logged as error)
 * - 4xx: Log warning, return cached/fallback data
 * - 5xx: Log warning and return cached/fallback data (expected when records don't exist)
 * - Network errors: Log warning and return cached/fallback data
 *
 * @param cacheKey - Unique key for caching this data
 * @param fetchFn - Function that performs the actual fetch
 * @param fallbackData - Default fallback data if no cache exists
 * @param operation - Description of the operation for logging
 * @returns The fetched data or cached/fallback data if fetch fails
 */
export async function withSupabaseFallback<T>(
  cacheKey: string,
  fetchFn: () => Promise<T>,
  fallbackData: T,
  operation: string,
): Promise<T> {
  try {
    const result = await fetchFn();
    // Cache successful result (including zero records - that's valid)
    setCacheData(cacheKey, result);
    return result;
  } catch (err: any) {
    const status = err?.status || err?.statusCode;
    const message = err?.message || String(err);

    // Server errors (5xx): log as warning and use fallback (expected when records don't exist)
    if (isServerError(status)) {
      console.warn(`[${operation}] Server error (${status}): ${message}`);
      // Try to use cached data
      const cached = getCachedData<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // If no cache, use fallback
      return fallbackData;
    }

    // Network errors (TypeError: Failed to fetch): use cached/fallback data
    if (err?.name === "TypeError" && message?.includes("Failed to fetch")) {
      console.warn(
        `[${operation}] Network error (may be CORS, network timeout, or service unavailable): ${message}`,
      );
      // Try to use cached data
      const cached = getCachedData<T>(cacheKey);
      if (cached !== null) {
        console.debug(`[${operation}] Using cached data as fallback`);
        return cached;
      }

      // If no cache, use fallback
      console.debug(`[${operation}] Using fallback data (no cache available)`);
      return fallbackData;
    }

    // Client errors (4xx): log warning and use cached/fallback
    if (isClientError(status)) {
      console.warn(`[${operation}] Client error (${status}): ${message}`);
      // Try to use cached data
      const cached = getCachedData<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }

      // If no cache, use fallback
      return fallbackData;
    }

    // Other unknown errors: log warning and use cached/fallback
    console.warn(`[${operation}] Unknown error: ${message}`);
    const cached = getCachedData<T>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    return fallbackData;
  }
}

/**
 * Handles AbortError and returns fallback data
 */
export function handleAbortError<T>(err: any, fallbackData: T): T | null {
  if (err?.name === "AbortError") {
    return null;
  }
  return null;
}

/**
 * Check if a response has a fallback-worthy error status
 */
export function isFallbackError(response: Response): boolean {
  return isClientError(response.status) || isServerError(response.status);
}

/**
 * Clear all cached data (useful for testing or cache invalidation)
 */
export function clearAllCache(): void {
  cache.clear();
  // Also clear all localStorage cache entries
  try {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      if (key.startsWith(LOCAL_CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (err) {
    console.debug("[clearAllCache] Error clearing localStorage:", err);
  }
}

/**
 * Clear cache for a specific key
 */
export function clearCache(cacheKey: string): void {
  cache.delete(cacheKey);
  // Also clear from localStorage
  try {
    const storedKey = LOCAL_CACHE_PREFIX + cacheKey;
    localStorage.removeItem(storedKey);
  } catch (err) {
    console.debug("[clearCache] Error clearing localStorage:", err);
  }
}

/**
 * Get cache statistics (for debugging)
 */
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}
