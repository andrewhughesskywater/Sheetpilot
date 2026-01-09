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
      // TODO: wire real submission
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
