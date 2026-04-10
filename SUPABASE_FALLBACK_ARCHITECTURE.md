# Supabase API Fallback Architecture

## Overview

The application now implements a resilient fallback mechanism for Supabase API calls. When Supabase tables/views fail with 500, 400, or 404 errors, the application gracefully falls back to rendering previously cached data instead of crashing.

## Core Mechanism

### Error Handler Module (`client/lib/supabaseErrorHandler.ts`)

The `supabaseErrorHandler.ts` module provides:

1. **`withSupabaseFallback<T>()`** - Main wrapper function that:
   - Attempts the API call
   - Caches successful responses in-memory
   - Returns cached data on 500, 400, 404, or network errors
   - Logs errors gracefully to console without halting execution

2. **In-Memory Cache** - Stores the last successful fetch result for each unique cache key

3. **Error Detection** - Identifies fallback-worthy errors:
   - HTTP 400, 404 (client errors)
   - HTTP 500-599 (server errors)
   - Network failures (`TypeError: Failed to fetch`)

## Affected Modules

The following modules have been updated to use the fallback mechanism:

### Data Fetching Libraries

- **`homepageMarketplaceCards.ts`** - Marketplace card data (New Relics, Recent Sales, Auctions)
- **`alchemyRelicSerialsJoined.ts`** - Relic serial metadata and token details
- **`marketplaceEvents.ts`** - Marketplace event history
- **`activeOffers.ts`** - Active marketplace offers and token metadata
- **`activeListings.ts`** - Active listings with seller usernames
- **`activeAuctions.ts`** - Active auctions with metadata
- **`activeAuctionsFromEvents.ts`** - Auction data from marketplace events
- **`supabaseMinted.ts`** - Minted edition data and serial information

## Implementation Pattern

Each API-calling function follows this pattern:

```typescript
export async function fetchData(params): Promise<DataType> {
  // Setup configuration
  const baseUrl = ...;
  const anonKey = ...;

  // Define fallback data
  const fallbackData: DataType = { ... };

  // Wrap the actual fetch with fallback handler
  return withSupabaseFallback(
    "unique-cache-key",      // Cache key for this data
    async () => {
      // ... actual Supabase API call ...
      // Throw errors on non-ok responses
      if (!response.ok) {
        const error = new Error(...) as any;
        error.status = response.status;
        throw error;
      }
      // Process and return data
      return processedData;
    },
    fallbackData,             // Default fallback if no cache
    "operation description"   // For logging
  );
}
```

## Error Handling Behavior

### Success Case (HTTP 200)

1. Fetch completes successfully
2. Response is cached in memory
3. Data is returned to caller
4. No console messages

### Error Case (500, 400, 404)

1. Fetch fails with one of these status codes
2. Error is logged to console with context:
   ```
   [Supabase] Operation failed with status 500. Falling back to cached data.
   ```
3. Cached data (if available) is returned
4. If no cache exists, fallback data is used
5. Application continues to render without crashing

### Example Log Output

```
[Supabase] fetchHomepageMarketplaceCards failed with status 500.
Falling back to cached data. {
  status: 500,
  message: "database connection timeout",
  timestamp: "2024-01-15T10:30:45.123Z"
}
[Supabase] Using cached data for: fetchHomepageMarketplaceCards
```

## Cache Management

### In-Memory Storage

- Cache is stored in a module-level `Map<string, CacheEntry<T>>`
- Each entry includes data and timestamp
- Cache persists across component re-renders (until page reload)

### Cache Keys

Cache keys are deterministic and based on:

- Function name
- Input parameters (for parameterized queries)
- Example: `"relic-serials-123,456,789"`

### Debugging Cache

Use the exported utility functions:

```typescript
import {
  getCacheStats,
  clearCache,
  clearAllCache,
} from "@/lib/supabaseErrorHandler";

// Check what's in cache
console.log(getCacheStats());
// Output: { size: 15, keys: ['marketplace-events', 'minted-edition-ids', ...] }

// Clear specific cache
clearCache("marketplace-events");

// Clear all
clearAllCache();
```

## Benefits

1. **Resilience** - App doesn't crash when Supabase has temporary issues
2. **Better UX** - Users see stale data instead of error screens
3. **Graceful Degradation** - Component rendering continues even with API failures
4. **Transparent** - No changes needed to component code or hooks
5. **Observable** - Errors are logged for debugging without being fatal
6. **Memory Efficient** - Uses lightweight in-memory cache

## Trade-offs

1. **Stale Data** - Users may see outdated information from the last successful fetch
2. **No Real-time Updates** - Cached data won't reflect immediate changes
3. **Cache on reload** - Cache is lost on page refresh

## Testing Fallback Behavior

To test the fallback mechanism:

1. **Simulate API Error**: Use browser DevTools to throttle/offline mode
2. **Observe Logs**: Check browser console for fallback messages
3. **Verify Rendering**: Component should still render with cached data
4. **Clear Cache**: Use `clearAllCache()` to test true fallback behavior

## Future Improvements

Possible enhancements:

- Persistent cache using localStorage for longer retention
- Cache invalidation strategies (time-based, manual)
- Monitoring dashboard for cache hit rates
- Exponential backoff retry logic before falling back
- User notification when using cached data
