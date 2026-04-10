import { useEffect, useState } from "react";
import {
  sortMarketplaceByBehavior,
  type MarketItem,
} from "@/lib/marketplaceAlgorithm";

export interface MarketplaceAlgorithmComponentProps {
  items: MarketItem[];
  userAddress: string | undefined;
  onSorted: (sortedItems: MarketItem[]) => void;
  isLoading?: (loading: boolean) => void;
}

/**
 * MarketplaceAlgorithmComponent
 *
 * Wraps the marketplace algorithm to provide personalized sorting of market cards
 * based on the connected wallet's marketplace behavior.
 *
 * Behavior-based sorting includes:
 * 1. PlayerName preferences
 * 2. Team preferences
 * 3. SetName preferences
 * 4. Creator preferences
 * 5. Price range preferences
 * 6. GameDate preferences (recent vs historic)
 * 7. Minted count preferences
 * 8. Serial number preferences
 * 9. Offer patterns
 * 10. Edition popularity (fallback for users with minimal activity)
 *
 * Applies 2x recency weight for activity within the last 30 days.
 */
export function MarketplaceAlgorithmComponent({
  items,
  userAddress,
  onSorted,
  isLoading,
}: MarketplaceAlgorithmComponentProps) {
  const [isSorting, setIsSorting] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(
    null,
  );

  useEffect(() => {
    // Skip if no user address or no items
    if (!userAddress || !items || items.length === 0) {
      onSorted(items);
      return;
    }

    // Create abort controller for this sort operation
    const controller = new AbortController();
    setAbortController(controller);
    setIsSorting(true);
    isLoading?.(true);

    const performSort = async () => {
      try {
        const sortedItems = await sortMarketplaceByBehavior(
          [...items], // Create a copy to avoid mutations
          userAddress,
          controller.signal,
        );
        onSorted(sortedItems);
      } catch (err) {
        // On error, return unsorted items
        if (err instanceof Error && err.name === "AbortError") {
          console.debug("[MarketplaceAlgorithmComponent] Sort was cancelled");
        } else {
          console.error(
            "[MarketplaceAlgorithmComponent] Error sorting items:",
            err,
          );
        }
        onSorted(items);
      } finally {
        setIsSorting(false);
        isLoading?.(false);
      }
    };

    performSort();

    // Cleanup function
    return () => {
      controller.abort();
    };
  }, [items, userAddress, onSorted, isLoading]);

  // Component doesn't render anything - it's a logic component
  return null;
}

export default MarketplaceAlgorithmComponent;
