import { useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { TimesheetRow } from '../timesheet.schema';
import { detectWeekdayPattern } from '../../../utils/smartDate';

export function useWeekdayPatternDetection(
  _timesheetDraftData: TimesheetRow[],
  _weekdayPatternRef: MutableRefObject<boolean>
) {
  useEffect(() => {
    _weekdayPatternRef.current = detectWeekdayPattern(_timesheetDraftData);
  }, [_timesheetDraftData, _weekdayPatternRef]);
}
