import { useEffect } from 'react';
import type { MutableRefObject } from 'react';

export function useWeekdayPatternDetection(
  _timesheetDraftData: unknown[],
  _weekdayPatternRef: MutableRefObject<string | null>
) {
  useEffect(() => {
    // Placeholder to detect weekday patterns
  }, [_timesheetDraftData]);
}
