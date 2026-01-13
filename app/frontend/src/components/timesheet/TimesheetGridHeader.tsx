import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import SaveIcon from '@mui/icons-material/Save';

interface TimesheetGridHeaderProps {
  saveButtonState: 'saved' | 'saving' | 'save';
  onSave: () => void;
  isAdmin: boolean;
}

export default function TimesheetGridHeader({ saveButtonState, onSave, isAdmin }: TimesheetGridHeaderProps) {
  return (
    <div className="timesheet-header">
      {/* Save Button */}
      <Button
        className="save-button"
        variant="contained"
        onClick={onSave}
        disabled={saveButtonState === 'saving' || saveButtonState === 'saved'}
        startIcon={
          saveButtonState === 'saving' ? (
            <CircularProgress size={16} sx={{ color: 'inherit' }} />
          ) : (
            <SaveIcon />
          )
        }
        sx={{
          backgroundColor: 
            saveButtonState === 'saved' 
              ? '#4CAF50' // Green for "Saved" state
              : saveButtonState === 'saving'
              ? 'var(--md-sys-color-primary)'
              : '#2196F3', // Blue for "Save" state
          color: 
            saveButtonState === 'saved'
              ? '#FFFFFF' // White text on green
              : '#FFFFFF', // White text for blue/primary backgrounds
          '&:disabled': {
            backgroundColor: 
              saveButtonState === 'saved'
                ? '#4CAF50' // Green for "Saved" state
                : saveButtonState === 'saving'
                ? 'var(--md-sys-color-primary)'
                : '#2196F3',
            color: '#FFFFFF',
          },
          textTransform: 'none',
          minWidth: 120,
        }}
      >
        {saveButtonState === 'saved' 
          ? 'Saved' 
          : saveButtonState === 'saving' 
          ? 'Saving' 
          : 'Save'}
      </Button>
      
      {isAdmin && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Admin users cannot submit timesheet entries to SmartSheet.
        </Alert>
      )}
    </div>
  );
}
