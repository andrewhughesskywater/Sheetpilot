import Button from '@mui/material/Button';
import RefreshIcon from '@mui/icons-material/Refresh';
import { ValidationErrors } from '@/components/timesheet/validation/ValidationErrors';
import type { ValidationError } from '@/components/timesheet/cell-processing/timesheet.cell-processing';

interface TimesheetGridFooterProps {
  validationErrors: ValidationError[];
  onShowAllErrors: () => void;
  onRefresh: () => void;
  isAdmin: boolean;
  isLoading: boolean;
}

export default function TimesheetGridFooter({
  validationErrors,
  onShowAllErrors,
  onRefresh,
  isAdmin,
  isLoading
}: TimesheetGridFooterProps) {
  return (
    <div className="timesheet-footer">
      <ValidationErrors
        errors={validationErrors}
        onShowAllErrors={onShowAllErrors}
      />
      {isAdmin && (
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
      )}
    </div>
  );
}
