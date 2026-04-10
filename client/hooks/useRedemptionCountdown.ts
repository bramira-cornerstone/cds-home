import { useState, useEffect, useMemo } from "react";
import {
  getRedemptionDeadlineForEdition,
  getDropWeekForEdition,
  getRedemptionDeadlineRaw,
} from "@/lib/supabaseRedemptionDeadline";
import { useSharedCountdownBreakdown } from "@/hooks/useSharedCountdown";

export interface CountdownTime {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  deadline: Date | null;
  isComingSoon: boolean; // True when redemptions_close is explicitly null in DB
}

/**
 * Calculate time remaining until deadline
 */
function calculateCountdown(deadline: Date | null): CountdownTime {
  if (!deadline) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      deadline: null,
      isComingSoon: false,
    };
  }

  const now = new Date();
  const diff = deadline.getTime() - now.getTime();

  if (diff <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      deadline,
      isComingSoon: false,
    };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / (24 * 60 * 60));
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60);
  const seconds = totalSeconds % 60;

  return {
    days,
    hours,
    minutes,
    seconds,
    isExpired: false,
    deadline,
    isComingSoon: false,
  };
}

/**
 * Hook to track redemption countdown until deadline
 * Returns countdown time, isExpired flag, and isComingSoon flag
 * Uses shared countdown hook to avoid creating per-instance intervals
 */
export function useRedemptionCountdown(
  editionId: number | null,
): CountdownTime & { loading: boolean } {
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [isComingSoon, setIsComingSoon] = useState(false);

  // Fetch deadline once on mount or when editionId changes
  useEffect(() => {
    if (!editionId) {
      setDeadline(null);
      setLoading(false);
      setIsComingSoon(false);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const initializeCountdown = async () => {
      try {
        // Get the drop_week for this edition
        const dropWeek = await getDropWeekForEdition(
          editionId,
          abortController.signal,
        );

        if (cancelled) return;

        if (!dropWeek) {
          setDeadline(null);
          setLoading(false);
          setIsComingSoon(false);
          return;
        }

        // Get the redemptions_close value (distinguishing null from error)
        const result = await getRedemptionDeadlineRaw(
          dropWeek,
          abortController.signal,
        );

        if (cancelled) return;

        // If found a drop_week_windows entry with redemptions_close = null, it's coming soon
        if (result.found && result.value === null) {
          setDeadline(null);
          setIsComingSoon(true);
          setLoading(false);
          return;
        }

        // Otherwise, use the deadline normally
        const newDeadline =
          result.found && result.value ? new Date(result.value) : null;
        setDeadline(newDeadline);
        setIsComingSoon(false);
        setLoading(false);
      } catch (err) {
        // Only log non-abort errors
        if (err instanceof Error && err.name !== "AbortError") {
        }
        if (!cancelled) {
          setDeadline(null);
          setLoading(false);
          setIsComingSoon(false);
        }
      }
    };

    initializeCountdown();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [editionId]);

  // Use shared countdown hook for the countdown calculation (no per-instance interval)
  const deadlineMs = useMemo(
    () => (deadline ? deadline.getTime() : 0),
    [deadline],
  );
  const countdownBreakdown = useSharedCountdownBreakdown(deadlineMs);

  // Calculate whether countdown is expired
  const isExpired = useMemo(() => {
    if (isComingSoon) return false;
    if (!deadline) return true;
    return Date.now() >= deadline.getTime();
  }, [deadline, isComingSoon]);

  return {
    days: countdownBreakdown?.days ?? 0,
    hours: countdownBreakdown?.hours ?? 0,
    minutes: countdownBreakdown?.minutes ?? 0,
    seconds: countdownBreakdown?.seconds ?? 0,
    isExpired,
    deadline,
    isComingSoon,
    loading,
  };
}
