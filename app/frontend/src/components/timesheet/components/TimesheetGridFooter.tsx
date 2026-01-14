import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ValidationErrors } from '@/components/timesheet/validation/ValidationErrors';
import { SubmitProgressBar } from '@/components/SubmitProgressBar';
import type { ValidationError } from '@/components/timesheet/cell-processing/timesheet.cell-processing';

type ButtonStatus = 'neutral' | 'ready' | 'warning';

interface TimesheetGridFooterProps {
  validationErrors: ValidationError[];
  onShowAllErrors: () => void;
  onRefresh: () => void;
  buttonStatus: ButtonStatus;
  onSubmit: () => void;
  isSubmitting: boolean;
  onStop: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

export default function TimesheetGridFooter({
  validationErrors,
  onShowAllErrors,
  onRefresh,
  buttonStatus,
  onSubmit,
  isSubmitting,
  onStop,
  isAdmin,
  isLoading
}: TimesheetGridFooterProps) {
  return (
    <div className="timesheet-footer">
      <ValidationErrors
        errors={validationErrors}
        onShowAllErrors={onShowAllErrors}
      />
      <div style={{ display: 'flex', gap: 'var(--sp-space-2)', alignItems: 'center' }}>
        <Button
          variant="outlined"
          size="medium"
          startIcon={<RefreshIcon />}
          onClick={onRefresh}
          disabled={isLoading}
          sx={{
            minWidth: 'auto',
            textTransform: 'none'
          }}
        >
          Refresh
        </Button>
        <SubmitProgressBar
          status={buttonStatus}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          icon={<PlayArrowIcon />}
          disabled={isAdmin}
        >
          Submit Timesheet
        </SubmitProgressBar>
        {isSubmitting && (
          <Button
            variant="contained"
            size="large"
            color="error"
            startIcon={<StopIcon />}
            onClick={onStop}
            sx={{ minWidth: 200 }}
          >
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
