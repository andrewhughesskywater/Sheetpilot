import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import EditIcon from '@mui/icons-material/Edit';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SummarizeIcon from '@mui/icons-material/Summarize';
import type { MacroRow } from '@/utils/macroStorage';
import { isMacroEmpty } from '@/utils/macroStorage';

type ButtonStatus = 'neutral' | 'ready' | 'warning';
type SaveButtonState = 'saved' | 'saving' | 'save';

interface MacroAndActionsToolbarProps {
  macros: MacroRow[];
  onApplyMacro: (index: number) => void;
  onEditMacros: () => void;
  buttonStatus: ButtonStatus;
  onSubmit: () => void;
  isSubmitting: boolean;
  onStop: () => void;
  isAdmin: boolean;
  onShowWeeklySummary: () => void;
  saveButtonState: SaveButtonState;
  onSave: () => void;
}

export default function MacroAndActionsToolbar({
  macros,
  onApplyMacro,
  onEditMacros,
  buttonStatus,
  onSubmit,
  isSubmitting,
  onStop,
  isAdmin,
  onShowWeeklySummary,
  saveButtonState,
  onSave,
}: MacroAndActionsToolbarProps) {
  // Determine submit button appearance based on save state and validation status
  const getSubmitButtonConfig = () => {
    if (isSubmitting) {
      return {
        label: 'Submitting...',
        backgroundColor: 'var(--md-sys-color-primary)',
        color: 'var(--md-sys-color-on-primary)',
        disabled: true,
      };
    }

    // If there are validation problems, show as disabled/gray
    if (buttonStatus === 'warning' || buttonStatus === 'neutral') {
      return {
        label: 'Submit',
        backgroundColor: 'var(--md-sys-color-surface-variant)',
        color: 'var(--md-sys-color-on-surface-variant)',
        disabled: true,
      };
    }

    // Ready to submit - check save state
    if (saveButtonState === 'saved') {
      return {
        label: 'Submit',
        backgroundColor: 'var(--sw-status-success)', // Green - saved and ready
        color: 'var(--md-sys-color-on-primary)',
        disabled: isAdmin,
      };
    } else if (saveButtonState === 'saving') {
      return {
        label: 'Saving...',
        backgroundColor: 'var(--md-sys-color-primary)', // Blue - saving
        color: 'var(--md-sys-color-on-primary)',
        disabled: true,
      };
    } else {
      // saveButtonState === 'save' - unsaved changes
      return {
        label: 'Save First',
        backgroundColor: 'var(--sw-status-warning)', // Orange - needs save
        color: 'var(--md-sys-color-on-primary)',
        disabled: false,
        onClick: onSave,
      };
    }
  };

  const submitConfig = getSubmitButtonConfig();

  return (
    <div className="macro-actions-toolbar">
      {/* Left section: Edit Macros icon + Macro buttons */}
      <div className="macro-section">
        {/* Edit Macros - Icon only, far left */}
        <Tooltip title="Edit Macros" placement="bottom">
          <IconButton
            onClick={onEditMacros}
            size="medium"
            sx={{
              color: 'var(--md-sys-color-primary)',
              backgroundColor: 'transparent',
              minHeight: '40px',
              maxHeight: '40px',
              height: '40px',
              width: '40px',
              '&:hover': {
                backgroundColor: 'var(--md-sys-color-primary-container)',
              },
            }}
          >
            <EditIcon />
          </IconButton>
        </Tooltip>

        {/* Macro buttons */}
        {macros.map((macro, index) => {
          const isEmpty = isMacroEmpty(macro);
          const displayName = macro.name?.trim() || `Macro ${index + 1}`;
          const label = isEmpty 
            ? `Macro ${index + 1}`
            : displayName.length > 30
              ? `${displayName.slice(0, 30)}...`
              : displayName;
          
          const tooltipText = isEmpty 
            ? `Macro ${index + 1} not configured`
            : `${displayName}${macro.taskDescription ? ` - ${macro.taskDescription}` : ''}`;
          
          return (
            <Button
              key={index}
              className="macro-button"
              variant="outlined"
              size="medium"
              disabled={isEmpty}
              onClick={() => onApplyMacro(index)}
              title={tooltipText}
            >
              <span className="macro-button-label">
                {label}
                <span className="macro-button-shortcut">Ctrl+{index + 1}</span>
              </span>
            </Button>
          );
        })}
      </div>

      {/* Right section: Summary and Submit actions */}
      <div className="actions-section">
        <Button
          variant="outlined"
          size="medium"
          onClick={onShowWeeklySummary}
          startIcon={<SummarizeIcon />}
          className="action-button"
          sx={{
            textTransform: 'none',
            minWidth: 100,
            borderRadius: 'var(--md-sys-shape-corner-medium)',
            fontSize: '14px',
            fontWeight: 500,
          }}
        >
          Summary
        </Button>
        <Button
          variant="contained"
          size="medium"
          onClick={submitConfig.onClick || onSubmit}
          disabled={submitConfig.disabled}
          className="submit-button"
          startIcon={
            saveButtonState === 'saving' || isSubmitting ? (
              <CircularProgress size={16} sx={{ color: 'inherit' }} />
            ) : (
              <PlayArrowIcon />
            )
          }
          sx={{
            backgroundColor: `${submitConfig.backgroundColor} !important`,
            color: `${submitConfig.color} !important`,
            opacity: '1 !important',
            pointerEvents: 'auto !important',
            cursor: submitConfig.disabled ? 'not-allowed' : 'pointer',
            borderRadius: 'var(--md-sys-shape-corner-medium)',
            fontSize: '14px',
            fontWeight: 500,
            '&.Mui-disabled': {
              backgroundColor: `${submitConfig.backgroundColor} !important`,
              color: `${submitConfig.color} !important`,
              opacity: '1 !important',
              pointerEvents: 'none !important',
            },
            '&:hover:not(.Mui-disabled)': {
              backgroundColor: `${submitConfig.backgroundColor} !important`,
              color: `${submitConfig.color} !important`,
              opacity: '1 !important',
              filter: 'brightness(0.9)',
            },
            textTransform: 'none',
            minWidth: 140,
            boxShadow: 'none !important',
            border: 'none !important',
            outline: 'none !important',
            isolation: 'isolate',
          }}
        >
          {submitConfig.label}
        </Button>
        {isSubmitting && (
          <Button
            variant="contained"
            size="medium"
            color="error"
            startIcon={<StopIcon />}
            onClick={onStop}
            className="action-button"
            sx={{ 
              minWidth: 100,
              textTransform: 'none',
              borderRadius: 'var(--md-sys-shape-corner-medium)',
              fontSize: '14px',
              fontWeight: 500,
            }}
          >
            Stop
          </Button>
        )}
      </div>
    </div>
  );
}
