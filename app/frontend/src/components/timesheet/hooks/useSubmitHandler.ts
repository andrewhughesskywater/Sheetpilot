import { useCallback } from 'react';
import type { TimesheetRow } from '../timesheet.schema';

export function useSubmitHandler() {
  const validateSubmit = useCallback(
    (
      timesheetDraftData: TimesheetRow[],
      validationErrors: Array<{ rowIdx: number; field: string; message: string }>,
      userRole: string
    ): { isValid: boolean; errors: string[] } => {
      const errors: string[] = [];

      if (!timesheetDraftData || timesheetDraftData.length === 0) {
        errors.push('No timesheet data to submit');
      }

      const completeRows = timesheetDraftData.filter(
        (row) => row.date && row.timeIn && row.timeOut && row.project
      );

      if (completeRows.length === 0) {
        errors.push('No complete entries to submit');
      }

      if (validationErrors.length > 0) {
        errors.push(`Timesheet has ${validationErrors.length} validation error(s)`);
      }

      if (!userRole || userRole === 'guest') {
        errors.push('Only authenticated users can submit timesheets');
      }

      return { isValid: errors.length === 0, errors };
    },
    []
  );

  interface SubmitHandlerConfig {
    timesheetDraftData: TimesheetRow[];
    validationErrors: Array<{ rowIdx: number; field: string; message: string }>;
    userRole: string;
    setSubmitting: (state: boolean) => void;
    onSubmitSuccess?: () => void;
    onSubmitError?: (error: string) => void;
  }

  const handleSubmitTimesheet = useCallback(
    async (config: SubmitHandlerConfig): Promise<void> => {
      const { timesheetDraftData, validationErrors, userRole, setSubmitting, onSubmitSuccess, onSubmitError } = config;
      const { isValid, errors: validationMsgs } = validateSubmit(timesheetDraftData, validationErrors, userRole);

      if (!isValid) {
        const errorMsg = validationMsgs.join('; ');
        window.logger?.warn('Cannot submit timesheet', { reason: errorMsg });
        onSubmitError?.(errorMsg);
        return;
      }

      setSubmitting(true);

      try {
        const result = await window.timesheet?.submitTimesheet(timesheetDraftData);

        if (result?.success) {
          window.logger?.info('Timesheet submitted successfully');
          onSubmitSuccess?.();
        } else {
          const err = result?.error || 'Unknown error';
          window.logger?.error('Timesheet submission failed', { error: err });
          onSubmitError?.(err);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        window.logger?.error('Encountered error submitting timesheet', { error: errorMsg });
        onSubmitError?.(errorMsg);
      } finally {
        setSubmitting(false);
      }
    },
    [validateSubmit]
  );

  return { handleSubmitTimesheet, validateSubmit };
}
