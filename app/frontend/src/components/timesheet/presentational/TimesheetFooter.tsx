import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import { SubmitProgressBar } from '../../SubmitProgressBar';
import { ValidationErrors } from '../ValidationErrors';
import type { ValidationError } from '../utils/timesheetGridUtils';

type ButtonStatus = 'neutral' | 'ready' | 'warning';

interface TimesheetFooterProps {
  validationErrors: ValidationError[];
  onShowAllErrors: () => void;
  isTimesheetDraftLoading: boolean;
  onRefresh: () => Promise<void>;
  onSubmit: () => void;
  isSubmitting: boolean;
  onStop: () => void;
  isAdmin: boolean;
  buttonStatus: ButtonStatus;
}

export function TimesheetFooter({
  validationErrors,
  onShowAllErrors,
  isTimesheetDraftLoading,
  onRefresh,
  onSubmit,
  isSubmitting,
  onStop,
  isAdmin,
  buttonStatus,
}: TimesheetFooterProps) {
  return (
    <div className="timesheet-footer">
      <ValidationErrors errors={validationErrors} onShowAllErrors={onShowAllErrors} />
      <div className="timesheet-footer-actions">
        <Button
          variant="outlined"
          size="medium"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={isTimesheetDraftLoading}
          sx={{ minWidth: 'auto', textTransform: 'none' }}
        >
          Refresh
        </Button>
        <SubmitProgressBar status={buttonStatus} onSubmit={onSubmit} isSubmitting={isSubmitting} icon={<PlayArrowIcon />} disabled={isAdmin}>
          Submit Timesheet
        </SubmitProgressBar>
        {isSubmitting && (
          <Button variant="contained" size="large" color="error" startIcon={<StopIcon />} onClick={onStop} sx={{ minWidth: 200 }}>
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
