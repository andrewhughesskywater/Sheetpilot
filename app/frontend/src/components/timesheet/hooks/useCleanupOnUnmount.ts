import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export function useCleanupOnUnmount(
  saveTimersRef: MutableRefObject<Map<number, NodeJS.Timeout>>,
  pendingSaveRef: MutableRefObject<Map<number, unknown>>,
  inFlightSavesRef: MutableRefObject<Map<number, AbortController>>,
) {
  useEffect(() => {
    return () => {
      // Clear timers and abort in-flight saves on unmount
      for (const t of saveTimersRef.current.values()) clearTimeout(t);
      pendingSaveRef.current.clear();
      for (const c of inFlightSavesRef.current.values()) c.abort();
      inFlightSavesRef.current.clear();
    };
  }, [inFlightSavesRef, pendingSaveRef, saveTimersRef]);
}
