import { useEffect, useRef, useState } from 'react';

interface UseTimesheetSubmissionConfig {
  token: string | undefined;
  isAdmin: boolean | undefined;
  timesheetDraftData: unknown[];
  refreshTimesheetDraft: () => Promise<void> | void;
  refreshArchiveData: () => Promise<void> | void;
}

export function useTimesheetSubmission(_config: UseTimesheetSubmissionConfig) {
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(isProcessing);
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  const handleSubmitTimesheet = async () => {
    setIsProcessing(true);
    try {
      if (typeof window.timesheet?.submit !== 'function') {
        throw new Error('Submission API not available');
      }

      await window.timesheet.submit({
        entries: _config.timesheetDraftData,
        token: _config.token,
        isAdmin: _config.isAdmin,
      });

      await _config.refreshTimesheetDraft();
      await _config.refreshArchiveData();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopSubmission = () => {
    setIsProcessing(false);
  };

  return {
    isProcessing,
    setIsProcessing,
    isProcessingRef,
    handleSubmitTimesheet,
    handleStopSubmission,
  } as const;
}
