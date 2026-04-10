import { useEffect, useState, useRef } from "react";

// Global shared timer that updates all countdowns synchronously
let sharedTimerInterval: NodeJS.Timeout | null = null;
const subscribersRef = new Set<() => void>();

function startSharedTimer() {
  if (sharedTimerInterval !== null) return;

  sharedTimerInterval = setInterval(() => {
    // Notify all subscribers that time has ticked
    subscribersRef.forEach((callback) => callback());
  }, 1000);
}

function stopSharedTimer() {
  if (subscribersRef.size === 0 && sharedTimerInterval !== null) {
    clearInterval(sharedTimerInterval);
    sharedTimerInterval = null;
  }
}

function subscribeToSharedTimer(callback: () => void) {
  subscribersRef.add(callback);
  startSharedTimer();
  return () => {
    subscribersRef.delete(callback);
    stopSharedTimer();
  };
}

/**
 * Hook for efficient countdown display using a shared global timer.
 * Instead of each component having its own setInterval, all countdowns
 * subscribe to a single shared timer and update together every second.
 *
 * This reduces the number of setInterval handlers from N (number of countdowns)
 * to 1, significantly improving performance when there are many countdowns.
 */
export function useSharedCountdown(endTimestampSeconds: number): string | null {
  const [displayText, setDisplayText] = useState<string | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const endDate = new Date(endTimestampSeconds * 1000);
      const diffMs = endDate.getTime() - now.getTime();

      if (diffMs <= 0) {
        setDisplayText(null);
        return;
      }

      const diffSeconds = Math.floor(diffMs / 1000);
      const days = Math.floor(diffSeconds / 86400);
      const hours = Math.floor((diffSeconds % 86400) / 3600);
      const minutes = Math.floor((diffSeconds % 3600) / 60);
      const seconds = diffSeconds % 60;

      const parts = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0 || days > 0) parts.push(`${hours}h`);
      if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
      parts.push(`${seconds}s`);

      const formatString = parts.length > 0 ? parts.join(" ") : "0s";
      setDisplayText(formatString);
    };

    // Initial update
    updateCountdown();

    // Subscribe to shared timer
    const unsubscribe = subscribeToSharedTimer(updateCountdown);

    return unsubscribe;
  }, [endTimestampSeconds]);

  return displayText;
}

/**
 * Hook for countdown breakdown (days, hours, minutes, seconds)
 * Uses the shared timer but returns the component breakdown
 */
export function useSharedCountdownBreakdown(
  endTimestampMs: number,
): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} | null {
  const [breakdown, setBreakdown] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now();
      const diff = endTimestampMs - now;

      if (diff <= 0) {
        setBreakdown({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setBreakdown({ days, hours, minutes, seconds });
    };

    // Initial update
    updateCountdown();

    // Subscribe to shared timer
    const unsubscribe = subscribeToSharedTimer(updateCountdown);

    return unsubscribe;
  }, [endTimestampMs]);

  return breakdown;
}
