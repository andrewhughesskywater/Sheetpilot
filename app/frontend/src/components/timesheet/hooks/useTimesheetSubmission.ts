import { useEffect, useRef, useState } from 'react';

export function useTimesheetSubmission(
  _token: string | undefined,
  _isAdmin: boolean | undefined,
  _timesheetDraftData: unknown[],
  _refreshTimesheetDraft: () => Promise<void> | void,
  _refreshArchiveData: () => Promise<void> | void
) {
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
