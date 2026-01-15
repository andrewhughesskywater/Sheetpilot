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

export default function TimesheetGridHeader({
  saveButtonState,
  onSave,
  isAdmin,
  archiveEntries,
}: TimesheetGridHeaderProps) {
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const { refreshArchiveData, archiveData } = useData();

  // Ensure archive data is loaded when dialog opens
  useEffect(() => {
    if (showWeeklySummary) {
      void refreshArchiveData();
    }
  }, [showWeeklySummary, refreshArchiveData]);

  // Use context data if available, fallback to prop
  const entriesToUse =
    archiveData.timesheet && archiveData.timesheet.length > 0
      ? archiveData.timesheet
      : archiveEntries || [];

  return (
    <>
      <div className="timesheet-header">
        {/* Save Button */}
        <Button
          className="save-button"
          variant="contained"
          onClick={onSave}
          disabled={saveButtonState === "saving" || saveButtonState === "saved"}
          startIcon={
            saveButtonState === "saving" ? (
              <CircularProgress size={16} sx={{ color: "inherit" }} />
            ) : (
              <SaveIcon />
            )
          }
          sx={{
            backgroundColor:
              saveButtonState === "saved"
                ? "#4CAF50" // Green for "Saved" state
                : saveButtonState === "saving"
                  ? "var(--md-sys-color-primary)"
                  : "#2196F3", // Blue for "Save" state
            color:
              saveButtonState === "saved"
                ? "#FFFFFF" // White text on green
                : "#FFFFFF", // White text for blue/primary backgrounds
            "&:disabled": {
              backgroundColor:
                saveButtonState === "saved"
                  ? "#4CAF50" // Green for "Saved" state
                  : saveButtonState === "saving"
                    ? "var(--md-sys-color-primary)"
                    : "#2196F3",
              color: "#FFFFFF",
            },
            textTransform: "none",
            minWidth: 120,
          }}
        >
          {saveButtonState === "saved"
            ? "Saved"
            : saveButtonState === "saving"
              ? "Saving"
              : "Save"}
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
