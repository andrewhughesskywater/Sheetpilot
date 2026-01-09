import SaveIcon from '@mui/icons-material/Save';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';

type SaveState = 'neutral' | 'saving' | 'saved';

interface TimesheetHeaderProps {
  saveButtonState: SaveState;
  onSave: () => void;
  isAdmin: boolean;
}

export function TimesheetHeader({ saveButtonState, onSave, isAdmin }: TimesheetHeaderProps) {
  return (
    <div className="timesheet-header">
      <Button
        className="save-button"
        variant="contained"
        onClick={onSave}
        disabled={saveButtonState === 'saving' || saveButtonState === 'saved'}
        startIcon={
          saveButtonState === 'saving' ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SaveIcon />
        }
        sx={{
          backgroundColor:
            saveButtonState === 'saved'
              ? '#4CAF50'
              : saveButtonState === 'saving'
                ? 'var(--md-sys-color-primary)'
                : '#2196F3',
          color: '#FFFFFF',
          '&:disabled': {
            backgroundColor:
              saveButtonState === 'saved'
                ? '#4CAF50'
                : saveButtonState === 'saving'
                  ? 'var(--md-sys-color-primary)'
                  : '#2196F3',
            color: '#FFFFFF',
          },
          textTransform: 'none',
          minWidth: 120,
        }}
      >
        {saveButtonState === 'saved' ? 'Saved' : saveButtonState === 'saving' ? 'Saving' : 'Save'}
      </Button>

      {isAdmin && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Admin users cannot submit timesheet entries to SmartSheet.
        </Alert>
      )}
    </div>
  );
}
