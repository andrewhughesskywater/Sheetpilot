import { useState } from 'react';
import type { ValidationError } from '../utils/timesheetGridUtils';

export function useValidationState() {
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  return {
    validationErrors,
    setValidationErrors,
    showErrorDialog,
    setShowErrorDialog,
  } as const;
}
