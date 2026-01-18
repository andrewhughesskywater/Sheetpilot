import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SaveIcon from "@mui/icons-material/Save";

interface TimesheetGridHeaderProps {
  saveButtonState: "saved" | "saving" | "save";
  onSave: () => void;
  isAdmin: boolean;
}

type SaveButtonState = TimesheetGridHeaderProps["saveButtonState"];

const SAVE_BUTTON_CONFIG: Record<
  SaveButtonState,
  {
    label: string;
    backgroundColor: string;
    textColor: string;
    disabledBackgroundColor: string;
    disabledTextColor: string;
  }
> = {
  saved: {
    label: "Saved",
    backgroundColor: "#4CAF50",
    textColor: "#FFFFFF",
    disabledBackgroundColor: "#4CAF50",
    disabledTextColor: "#FFFFFF",
  },
  saving: {
    label: "Saving",
    backgroundColor: "var(--md-sys-color-primary)",
    textColor: "#FFFFFF",
    disabledBackgroundColor: "var(--md-sys-color-primary)",
    disabledTextColor: "#FFFFFF",
  },
  save: {
    label: "Save",
    backgroundColor: "#2196F3",
    textColor: "#FFFFFF",
    disabledBackgroundColor: "#2196F3",
    disabledTextColor: "#FFFFFF",
  },
};

export default function TimesheetGridHeader({
  saveButtonState,
  onSave,
  isAdmin,
}: TimesheetGridHeaderProps) {
  const saveButtonConfig = SAVE_BUTTON_CONFIG[saveButtonState];
  const isSaveDisabled = saveButtonState !== "save";

  return (
    <div className="timesheet-header">
      {/* Save Button */}
      <Button
        className="save-button"
        variant="contained"
        onClick={onSave}
        disabled={isSaveDisabled}
        startIcon={
          saveButtonState === "saving" ? (
            <CircularProgress size={16} sx={{ color: "inherit" }} />
          ) : (
            <SaveIcon />
          )
        }
        sx={{
          backgroundColor: saveButtonConfig.backgroundColor,
          color: saveButtonConfig.textColor,
          "&:disabled": {
            backgroundColor: saveButtonConfig.disabledBackgroundColor,
            color: saveButtonConfig.disabledTextColor,
          },
          textTransform: "none",
          minWidth: 120,
        }}
      >
        {saveButtonConfig.label}
      </Button>

      {isAdmin && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Admin users cannot submit timesheet entries to SmartSheet.
        </Alert>
      )}
    </div>
  );
}
