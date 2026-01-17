/**
 * @fileoverview Weekly Summary Navigation Hooks
 *
 * Custom hooks for week navigation in the weekly summary dialog.
 * Handles previous/next week navigation and availability checks.
 */

import { useMemo, useCallback } from "react";

/**
 * Hook for handling week navigation
 */
export function useWeekNavigation(
  allWeeks: string[],
  currentWeekKey: string,
  setCurrentWeekKey: (key: string) => void
) {
  // Navigation handlers
  const handlePreviousWeek = useCallback(() => {
    if (allWeeks.length === 0) {
      return;
    }

    setCurrentWeekKey((prevKey) => {
      const currentIndex = allWeeks.indexOf(prevKey);

      // If current week is not in allWeeks, find the closest previous week
      if (currentIndex === -1) {
        // Find the latest week that is before prevKey
        // Since allWeeks is sorted, we can find the last one that's less than prevKey
        for (let i = allWeeks.length - 1; i >= 0; i--) {
          const week = allWeeks[i];
          if (week && week < prevKey) {
            return week;
          }
        }
        return prevKey; // No previous week found
      } else if (currentIndex > 0) {
        const week = allWeeks[currentIndex - 1];
        return week ?? prevKey;
      }
      return prevKey; // Already at first week
    });
  }, [allWeeks, setCurrentWeekKey]);

  const handleNextWeek = useCallback(() => {
    if (allWeeks.length === 0) {
      return;
    }

    setCurrentWeekKey((prevKey) => {
      const currentIndex = allWeeks.indexOf(prevKey);

      // If current week is not in allWeeks, find the closest next week
      if (currentIndex === -1) {
        // Find the earliest week that is after prevKey
        // Since allWeeks is sorted, we can find the first one that's greater than prevKey
        for (let i = 0; i < allWeeks.length; i++) {
          const week = allWeeks[i];
          if (week && week > prevKey) {
            return week;
          }
        }
        return prevKey; // No next week found
      } else if (currentIndex < allWeeks.length - 1) {
        const week = allWeeks[currentIndex + 1];
        return week ?? prevKey;
      }
      return prevKey; // Already at last week
    });
  }, [allWeeks, setCurrentWeekKey]);

  // Check if navigation is possible
  const canGoPrevious = useMemo(() => {
    if (allWeeks.length === 0) {
      return false;
    }
    const currentIndex = allWeeks.indexOf(currentWeekKey);
    if (currentIndex === -1) {
      // Check if there's any week before currentWeekKey
      return allWeeks.some((weekKey) => weekKey < currentWeekKey);
    }
    return currentIndex > 0;
  }, [allWeeks, currentWeekKey]);

  const canGoNext = useMemo(() => {
    if (allWeeks.length === 0) {
      return false;
    }
    const currentIndex = allWeeks.indexOf(currentWeekKey);
    if (currentIndex === -1) {
      // Check if there's any week after currentWeekKey
      return allWeeks.some((weekKey) => weekKey > currentWeekKey);
    }
    return currentIndex < allWeeks.length - 1;
  }, [allWeeks, currentWeekKey]);

  return {
    handlePreviousWeek,
    handleNextWeek,
    canGoPrevious,
    canGoNext,
  };
}
