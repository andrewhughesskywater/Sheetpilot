import type { MutableRefObject } from 'react';
import { useEffect } from 'react';

import { detectWeekdayPattern } from '../../../utils/smartDate';
import type { TimesheetRow } from '../timesheet.schema';

export function useWeekdayPatternDetection(
  _timesheetDraftData: TimesheetRow[],
  _weekdayPatternRef: MutableRefObject<boolean>
) {
  useEffect(() => {
    _weekdayPatternRef.current = detectWeekdayPattern(_timesheetDraftData);
  }, [_timesheetDraftData, _weekdayPatternRef]);
}
