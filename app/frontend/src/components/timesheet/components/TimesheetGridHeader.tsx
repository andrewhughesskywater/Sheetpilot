import { useState, useEffect } from "react";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import SaveIcon from "@mui/icons-material/Save";
import SummarizeIcon from "@mui/icons-material/Summarize";
import WeeklySummaryDialog from "@/components/timesheet/WeeklySummaryDialog";
import { useData } from "@/contexts/DataContext";

/**
 * Submitted timesheet entry from archive
 */
interface TimesheetEntry {
  id: number;
  date: string;
  hours: number | null;
  project: string;
  tool?: string;
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

interface TimesheetGridHeaderProps {
  saveButtonState: "saved" | "saving" | "save";
  onSave: () => void;
  isAdmin: boolean;
  archiveEntries: TimesheetEntry[];
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
  archiveEntries,
}: TimesheetGridHeaderProps) {
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const { refreshArchiveData, archiveData } = useData();
  const saveButtonConfig = SAVE_BUTTON_CONFIG[saveButtonState];
  const isSaveDisabled = saveButtonState !== "save";

  // Ensure archive data is loaded when dialog opens
  useEffect(() => {
    if (showWeeklySummary) {
      void refreshArchiveData();
    }
  }, [showWeeklySummary, refreshArchiveData]);

  // Use context data if available, fallback to prop
  const entriesToUse = archiveData.timesheet?.length
    ? archiveData.timesheet
    : archiveEntries;

  return (
    <>
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

        {/* Weekly Summary Button */}
        <Button
          variant="outlined"
          onClick={() => setShowWeeklySummary(true)}
          startIcon={<SummarizeIcon />}
          sx={{
            textTransform: "none",
            minWidth: 150,
          }}
        >
          Weekly Summary
        </Button>

        {isAdmin && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Admin users cannot submit timesheet entries to SmartSheet.
          </Alert>
        )}
      </div>

      {/* Weekly Summary Dialog */}
      <WeeklySummaryDialog
        open={showWeeklySummary}
        onClose={() => setShowWeeklySummary(false)}
        entries={entriesToUse}
      />
    </>
  );
}
