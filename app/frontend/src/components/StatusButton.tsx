/**
 * StatusButton Component
 * Thin wrapper around MUI Button with status-based coloring
 * - neutral: No data or inactive state (gray, disabled)
 * - ready: Ready for action (success color, enabled)
 * - warning: Has issues/validation errors (warning color, disabled)
 */

import Button from '@mui/material/Button';
import type { ReactNode } from 'react';

export type ButtonStatus = 'neutral' | 'ready' | 'warning';

export interface StatusButtonProps {
  /** Current status of the button */
  status: ButtonStatus;
  /** Button text content */
  children: ReactNode;
  /** Click handler */
  onClick: () => void;
  /** Is the button currently processing */
  isProcessing?: boolean;
  /** Processing state text (e.g., "Submitting...") - not used with Button loading */
  processingText?: string;
  /** Icon to display when not processing */
  icon?: ReactNode;
  /** Additional disabled conditions beyond status */
  disabled?: boolean;
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS class names - not used */
  className?: string;
}

export function StatusButton({
  status,
  children,
  onClick,
  isProcessing = false,
  icon,
  disabled = false,
  size = 'large'
}: StatusButtonProps) {
  // Determine if button should be disabled
  const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';

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
    <Button
      variant="contained"
      size={size}
      loading={isProcessing}
      loadingPosition="start"
      startIcon={icon}
      onClick={onClick}
      disabled={isDisabled}
      color={getColor()}
    >
      {children}
    </Button>
  );
}

