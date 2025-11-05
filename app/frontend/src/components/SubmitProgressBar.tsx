/**
 * SubmitProgressBar Component
 * 
 * Animated progress bar that morphs from a submit button into a full-width
 * progress indicator during timesheet submission. Shows real-time progress
 * with percentage updates.
 */

import { Button } from '@mui/material';
import { PlayArrow as PlayArrowIcon } from '@mui/icons-material';
import type { ReactNode } from 'react';
import './SubmitProgressBar.css';

export interface SubmitProgressBarProps {
  /** Whether submission is in progress */
  isSubmitting: boolean;
  /** Progress percentage (0-100) */
  progress: number;
  /** Current entry number being processed */
  currentEntry: number;
  /** Total number of entries to process */
  totalEntries: number;
  /** Progress message */
  message?: string;
  /** Button text when not submitting */
  children: ReactNode;
  /** Click handler for submit button */
  onSubmit: () => void;
  /** Button status for styling */
  status: 'neutral' | 'ready' | 'warning';
  /** Whether button is disabled */
  disabled?: boolean;
  /** Icon to display on button */
  icon?: ReactNode;
}

export function SubmitProgressBar({
  isSubmitting,
  progress,
  currentEntry,
  totalEntries,
  message,
  children,
  onSubmit,
  status,
  disabled = false,
  icon
}: SubmitProgressBarProps) {
  // Determine if button should be disabled
  const isDisabled = disabled || status === 'neutral' || status === 'warning';
  
  // Determine status class
  const statusClass = `submit-progress-${status}`;

  if (!isSubmitting) {
    // Render as button when not submitting
    return (
      <div className="submit-progress-container">
        <Button
          variant="contained"
          size="large"
          className={`submit-progress-button ${statusClass}`}
          startIcon={icon || <PlayArrowIcon />}
          onClick={onSubmit}
          disabled={isDisabled}
        >
          {children}
        </Button>
      </div>
    );
  }

  // Render as progress bar when submitting
  const progressPercent = Math.min(100, Math.max(0, progress));
  
  return (
    <div className="submit-progress-container">
      <div className="submit-progress-bar-wrapper">
        <div className="submit-progress-bar">
          <div 
            className="submit-progress-fill"
            style={{ width: `${progressPercent}%` }}
          >
            <div className="submit-progress-shine" />
          </div>
          <div className="submit-progress-text">
            {message || `Submitting entry ${currentEntry} of ${totalEntries}`}
          </div>
        </div>
        <div className="submit-progress-percent">
          {progressPercent.toFixed(0)}%
        </div>
      </div>
    </div>
  );
}

