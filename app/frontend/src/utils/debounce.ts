/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 *
 * @param func The function to debounce
 * @param wait The number of milliseconds to delay
 * @returns The debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
    }, wait);
  };
}

/**
 * React hook-friendly debounce that returns a stable debounced callback
 * Use this for debouncing callbacks in React components
 */
export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(callback: T, delay: number): T {
  // This is a simple implementation - for React hooks, you'd typically use useMemo/useCallback
  // But this works for our use case with refs
  return debounce(callback, delay) as T;
}
