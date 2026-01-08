import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export function useCleanupOnUnmount(
  saveTimersRef: MutableRefObject<Map<number, NodeJS.Timeout>>,
  pendingSaveRef: MutableRefObject<Map<number, unknown>>,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
) {
  useEffect(() => {
    // Capture ref values at effect time to avoid stale closure issues
    const saveTimers = saveTimersRef.current;
    const pendingSaves = pendingSaveRef.current;
    const inFlightSaves = inFlightSavesRef.current;
    
    return () => {
      // Clear timers and abort in-flight saves on unmount
      for (const t of saveTimers.values()) clearTimeout(t);
      pendingSaves.clear();
      for (const c of inFlightSaves.values()) c.abort();
      inFlightSaves.clear();
    };
  }, [inFlightSavesRef, pendingSaveRef, saveTimersRef]);
}
