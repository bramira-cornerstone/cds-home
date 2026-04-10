// Cache key format: marketplace_sort_cache_<accountAddress>_<filteredIdsHash>
// Cache expires after 24 hours

interface CacheEntry {
  sortedIds: number[];
  timestamp: number;
  filteredIdsHash: string;
}

// Simple hash function for filtered IDs to detect when filters change
function hashIds(ids: number[]): string {
  return ids.join(",");
}

export function getMarketplaceSortCache(
  accountAddress: string,
  filteredIds: number[]
): number[] | null {
  if (!accountAddress) return null;

  const filteredIdsHash = hashIds(filteredIds);
  const cacheKey = `marketplace_sort_cache_${accountAddress}`;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const entry: CacheEntry = JSON.parse(cached);
    const now = Date.now();
    const cacheAgeHours = (now - entry.timestamp) / (1000 * 60 * 60);

    // Check if cache is still valid (24 hours) and matches current filters
    if (cacheAgeHours < 24 && entry.filteredIdsHash === filteredIdsHash) {
      console.log(
        `[marketplace-sort-cache] Using cached sort (${cacheAgeHours.toFixed(1)} hours old)`
      );
      return entry.sortedIds;
    }

    // Cache expired or filters changed
    localStorage.removeItem(cacheKey);
    return null;
  } catch (err) {
    console.debug("[marketplace-sort-cache] Error reading cache:", err);
    return null;
  }
}

export function setMarketplaceSortCache(
  accountAddress: string,
  filteredIds: number[],
  sortedIds: number[]
): void {
  if (!accountAddress) return;

  const cacheKey = `marketplace_sort_cache_${accountAddress}`;
  const entry: CacheEntry = {
    sortedIds,
    timestamp: Date.now(),
    filteredIdsHash: hashIds(filteredIds),
  };

  try {
    localStorage.setItem(cacheKey, JSON.stringify(entry));
    console.log("[marketplace-sort-cache] Sort cached for next load");
  } catch (err) {
    console.debug("[marketplace-sort-cache] Error writing cache:", err);
  }
}

export function clearMarketplaceSortCache(accountAddress: string): void {
  if (!accountAddress) return;

  const cacheKey = `marketplace_sort_cache_${accountAddress}`;
  try {
    localStorage.removeItem(cacheKey);
  } catch (err) {
    console.debug("[marketplace-sort-cache] Error clearing cache:", err);
  }
}
