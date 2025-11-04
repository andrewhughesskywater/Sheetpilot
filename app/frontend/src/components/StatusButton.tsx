/**
 * StatusButton Component
 * Reusable button with status-based coloring
 * - neutral: No data or inactive state (gray, disabled)
 * - ready: Ready for action (teal/green, enabled)
 * - warning: Has issues/validation errors (orange, disabled)
 */

import { Button, CircularProgress } from '@mui/material';
import type { ReactNode } from 'react';
import './StatusButton.css';

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
  /** Processing state text (e.g., "Submitting...") */
  processingText?: string;
  /** Icon to display when not processing */
  icon?: ReactNode;
  /** Additional disabled conditions beyond status */
  disabled?: boolean;
  /** Button size */
  size?: 'small' | 'medium' | 'large';
  /** Additional CSS class names */
  className?: string;
}

export function StatusButton({
  status,
  children,
  onClick,
  isProcessing = false,
  processingText,
  icon,
  disabled = false,
  size = 'large',
  className = ''
}: StatusButtonProps) {
  // Determine if button should be disabled
  const isDisabled = isProcessing || disabled || status === 'neutral' || status === 'warning';

  // Determine status class
  const statusClass = `status-button-${status}`;

  return (
    <Button
      variant="contained"
      size={size}
      className={`status-button ${statusClass} ${className}`}
      startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : icon}
      onClick={onClick}
      disabled={isDisabled}
    >
      {isProcessing && processingText ? processingText : children}
    </Button>
  );
}

