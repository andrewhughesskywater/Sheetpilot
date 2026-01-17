/**
 * @fileoverview Weekly Summary Dialog Component
 *
 * Displays a dialog with hours worked by project and day for a selected week.
 * Allows navigation between weeks with submitted data.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

import { useState, useMemo, useEffect, useRef } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import {
  getWeekBounds,
  getWeekKey,
  getAllWeeksWithData,
  formatWeekRange,
  getWeekDays,
} from "@/utils/weekSummary";
import { useWeekNavigation } from "./hooks/useWeekNavigation";
import WeeklySummaryTable from "./WeeklySummaryTable";
import "./WeeklySummaryDialog.css";

/**
 * Submitted timesheet entry from archive
 */
interface TimesheetEntry {
  id: number;
  date: string; // YYYY-MM-DD format
  hours: number | null;
  project: string;
  tool?: string;
  comment?: string;
  lastSubmitted?: string;
}

/**
 * Props for WeeklySummaryDialog component
 */
interface WeeklySummaryDialogProps {
  open: boolean;
  onClose: () => void;
  archiveData?: TimesheetEntry[];
}

/**
 * WeeklySummaryDialog Component
 *
 * Displays a modal dialog containing a table of submitted timesheet entries
 * for a selected week. Users can navigate between weeks using arrow buttons.
 *
 * @param open - Whether the dialog is open
 * @param onClose - Callback when dialog should close
 * @param archiveData - Array of submitted timesheet entries
 * @returns Dialog component with weekly summary table
 */
const WeeklySummaryDialog = ({
  open,
  onClose,
  archiveData = [],
}: WeeklySummaryDialogProps) => {
  // Get all weeks with data
  const allWeeks = useMemo(() => {
    return getAllWeeksWithData(archiveData || []);
  }, [archiveData]);

  // Calculate current week (Sunday-Saturday containing today)
  const currentWeekStart = useMemo(() => {
    const today = new Date();
    const { sunday } = getWeekBounds(today);
    return sunday;
  }, []);

  // Find initial week - use current week if it has data, otherwise use most recent week
  const initialWeekKey = useMemo(() => {
    const currentWeekKey = getWeekKey(currentWeekStart);
    if (allWeeks.includes(currentWeekKey)) {
      return currentWeekKey;
    }
    return allWeeks.length > 0
      ? allWeeks[allWeeks.length - 1] ?? getWeekKey(currentWeekStart)
      : getWeekKey(currentWeekStart);
  }, [allWeeks, currentWeekStart]);

  // State for current week - initialize with computed initial week
  const [currentWeekKey, setCurrentWeekKey] = useState<string>(initialWeekKey);
  const prevOpenRef = useRef(open);
  const prevAllWeeksLengthRef = useRef(allWeeks.length);

  // Update current week when dialog opens or when allWeeks changes from empty to populated
  useEffect(() => {
    const wasClosed = !prevOpenRef.current;
    const wasEmpty = prevAllWeeksLengthRef.current === 0;
    const nowHasData = allWeeks.length > 0;

    prevOpenRef.current = open;
    prevAllWeeksLengthRef.current = allWeeks.length;

    // Reset when dialog opens OR when data loads for the first time
    // Use setTimeout to avoid calling setState synchronously in effect
    if (open && (wasClosed || (wasEmpty && nowHasData))) {
      setTimeout(() => {
        setCurrentWeekKey(initialWeekKey ?? getWeekKey(currentWeekStart));
      }, 0);
    }
  }, [open, initialWeekKey, allWeeks.length, currentWeekStart]);

  // Parse current week Sunday date
  const currentWeekSunday = useMemo(() => {
    try {
      const parts = currentWeekKey.split("-").map(Number);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year === undefined || month === undefined || day === undefined) {
        throw new Error("Invalid date parts");
      }
      const date = new Date(year, month - 1, day);
      if (isNaN(date.getTime())) {
        // Fallback to current week if parsing fails
        const today = new Date();
        const { sunday } = getWeekBounds(today);
        return sunday;
      }
      return date;
    } catch {
      // Fallback to current week if parsing fails
      const today = new Date();
      const { sunday } = getWeekBounds(today);
      return sunday;
    }
  }, [currentWeekKey]);

  // Get week bounds
  const { sunday, saturday } = useMemo(
    () => getWeekBounds(currentWeekSunday),
    [currentWeekSunday]
  );

  // Get all 7 days of the week
  const weekDays = useMemo(
    () => getWeekDays(currentWeekSunday),
    [currentWeekSunday]
  );

  // Get the archive data for the current week
  const currentWeekData = useMemo(() => {
    return (
      archiveData?.filter((entry) => {
        const entryDate = new Date(entry.date);
        return entryDate >= sunday && entryDate <= saturday;
      }) ?? []
    );
  }, [archiveData, sunday, saturday]);

  // Determine if dialog can navigate to previous/next week
  const { canGoPrevious, canGoNext, handlePreviousWeek, handleNextWeek } =
    useWeekNavigation({
      allWeeks,
      currentWeekKey,
      setCurrentWeekKey,
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { height: "85vh", maxHeight: 900 },
      }}
    >
      <DialogTitle>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6" component="span">
            Weekly Summary
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconButton
              onClick={(_e) => {
                handlePreviousWeek();
              }}
              disabled={!canGoPrevious}
              size="small"
              aria-label="Previous week"
            >
              <ChevronLeftIcon />
            </IconButton>
            <Typography
              variant="body1"
              sx={{ minWidth: 200, textAlign: "center" }}
            >
              {formatWeekRange(sunday, saturday)}
            </Typography>
            <IconButton
              onClick={(_e) => {
                handleNextWeek();
              }}
              disabled={!canGoNext}
              size="small"
              aria-label="Next week"
            >
              <ChevronRightIcon />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column" }}>
        <WeeklySummaryTable archiveData={currentWeekData} weekDays={weekDays} />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} variant="contained" color="primary">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default WeeklySummaryDialog;
