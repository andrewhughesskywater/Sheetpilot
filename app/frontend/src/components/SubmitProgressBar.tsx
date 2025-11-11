/**
 * SubmitProgressBar Component
 * 
 * Simple submit button using MUI LoadingButton
 */

import { LoadingButton } from '@mui/lab';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import type { ReactNode } from 'react';

export interface SubmitProgressBarProps {
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Progress percentage (0-100) - not used with LoadingButton */
  progress?: number;
  /** Current entry number being processed - not used with LoadingButton */
  currentEntry?: number;
  /** Total number of entries to process - not used with LoadingButton */
  totalEntries?: number;
  /** Progress message - not used with LoadingButton */
  message?: string;
  /** Button text when not submitting */
  children: ReactNode;
  /** Click handler for submit button */
  onSubmit: () => void;
  /** Click handler for cancel button - not supported with LoadingButton */
  onCancel?: () => void;
  /** Button status for styling */
  status: 'neutral' | 'ready' | 'warning';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Icon to display on button */
  icon?: ReactNode;
}

export function SubmitProgressBar({
  isSubmitting,
  children,
  onSubmit,
  status,
  disabled = false,
  icon
}: SubmitProgressBarProps) {
  // Determine if button should be disabled
  const isDisabled = disabled || status === 'neutral' || status === 'warning';
  
  // Map status to MUI color
  const getColor = () => {
    switch (status) {
      case 'ready':
        return 'success';
      case 'warning':
        return 'warning';
      case 'neutral':
      default:
        return 'primary';
    }
  };

  return (
    <LoadingButton
      variant="contained"
      size="large"
      loading={isSubmitting}
      loadingPosition="start"
      startIcon={icon || <PlayArrowIcon />}
      onClick={onSubmit}
      disabled={isDisabled}
      color={getColor()}
      sx={{ minWidth: 200 }}
    >
      {children}
    </LoadingButton>
  );
}

