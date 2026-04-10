import { useEffect, useRef } from "react";

/**
 * Hook that pauses/resumes a callback based on page visibility.
 * When the page is hidden (tab not visible), the interval is cleared.
 * When the page becomes visible again, the interval is restarted.
 *
 * Usage:
 * ```
 * usePageVisibility(() => {
 *   // This callback will only run when the page is visible
 *   const intervalId = setInterval(() => { ... }, 5000);
 *   return intervalId; // Return the intervalId to be cleared
 * });
 * ```
 */
export function usePageVisibility(
  setupInterval: () => number | undefined,
  dependencies: React.DependencyList = [],
) {
  const intervalIdRef = useRef<number | undefined>(undefined);

  // Initial setup
  useEffect(() => {
    intervalIdRef.current = setupInterval();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page is now hidden - clear the interval
        if (intervalIdRef.current !== undefined) {
          clearInterval(intervalIdRef.current);
          intervalIdRef.current = undefined;
        }
      } else {
        // Page is now visible - restart the interval if needed
        if (intervalIdRef.current === undefined) {
          intervalIdRef.current = setupInterval();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (intervalIdRef.current !== undefined) {
        clearInterval(intervalIdRef.current);
        intervalIdRef.current = undefined;
      }
    };
  }, dependencies);
}
