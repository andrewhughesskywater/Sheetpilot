/**
 * @fileoverview Weekly Summary Dialog Component
 *
 * Displays a table showing hours worked by project and day for a selected week.
 * Allows navigation between weeks with submitted data.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
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
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import {
  getWeekBounds,
  getWeekKey,
  getAllWeeksWithData,
  calculateWeekSummary,
  formatWeekRange,
  getDayName,
  formatDateShort,
  getWeekDays,
} from "@/utils/weekSummary";
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
  detail_charge_code?: string;
  task_description: string;
  status?: string;
  submitted_at?: string;
}

interface WeeklySummaryDialogProps {
  open: boolean;
  onClose: () => void;
  entries?: TimesheetEntry[];
}

const WeeklySummaryDialog = ({
  open,
  onClose,
  entries = [],
}: WeeklySummaryDialogProps) => {
  // Get all weeks with data
  const allWeeks = useMemo(() => {
    return getAllWeeksWithData(entries || []);
  }, [entries]);

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
      ? (allWeeks[allWeeks.length - 1] ?? getWeekKey(currentWeekStart))
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

  // Calculate summary for current week
  const weekSummary = useMemo(() => {
    return calculateWeekSummary(entries || [], currentWeekSunday);
  }, [entries, currentWeekSunday]);

  // Calculate totals per day
  const dayTotals = useMemo(() => {
    const totals: [number, number, number, number, number, number, number] = [
      0, 0, 0, 0, 0, 0, 0,
    ];
    weekSummary.forEach((summary) => {
      summary.days.forEach((hours, dayIndex) => {
        if (dayIndex >= 0 && dayIndex < totals.length && totals[dayIndex] !== undefined) {
          totals[dayIndex]! += hours;
        }
      });
    });
    return totals;
  }, [weekSummary]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return dayTotals.reduce((sum, hours) => sum + hours, 0);
  }, [dayTotals]);

  // Navigation handlers
  const handlePreviousWeek = useCallback(() => {
    if (allWeeks.length === 0) {
      return;
    }

    setCurrentWeekKey((prevKey) => {
      const currentIndex = allWeeks.indexOf(prevKey);

      // If current week is not in allWeeks, find the closest previous week
      if (currentIndex === -1) {
        // Find the latest week that is before prevKey
        // Since allWeeks is sorted, we can find the last one that's less than prevKey
        for (let i = allWeeks.length - 1; i >= 0; i--) {
          const week = allWeeks[i];
          if (week && week < prevKey) {
            return week;
          }
        }
        return prevKey; // No previous week found
      } else if (currentIndex > 0) {
        const week = allWeeks[currentIndex - 1];
        return week ?? prevKey;
      }
      return prevKey; // Already at first week
    });
  }, [allWeeks]);

  const handleNextWeek = useCallback(() => {
    if (allWeeks.length === 0) {
      return;
    }

    setCurrentWeekKey((prevKey) => {
      const currentIndex = allWeeks.indexOf(prevKey);

      // If current week is not in allWeeks, find the closest next week
      if (currentIndex === -1) {
        // Find the earliest week that is after prevKey
        // Since allWeeks is sorted, we can find the first one that's greater than prevKey
        for (let i = 0; i < allWeeks.length; i++) {
          const week = allWeeks[i];
          if (week && week > prevKey) {
            return week;
          }
        }
        return prevKey; // No next week found
      } else if (currentIndex < allWeeks.length - 1) {
        const week = allWeeks[currentIndex + 1];
        return week ?? prevKey;
      }
      return prevKey; // Already at last week
    });
  }, [allWeeks]);

  // Check if navigation is possible
  const canGoPrevious = useMemo(() => {
    if (allWeeks.length === 0) {
      return false;
    }
    const currentIndex = allWeeks.indexOf(currentWeekKey);
    if (currentIndex === -1) {
      // Check if there's any week before currentWeekKey
      return allWeeks.some((weekKey) => weekKey < currentWeekKey);
    }
    return currentIndex > 0;
  }, [allWeeks, currentWeekKey]);

  const canGoNext = useMemo(() => {
    if (allWeeks.length === 0) {
      return false;
    }
    const currentIndex = allWeeks.indexOf(currentWeekKey);
    if (currentIndex === -1) {
      // Check if there's any week after currentWeekKey
      return allWeeks.some((weekKey) => weekKey > currentWeekKey);
    }
    return currentIndex < allWeeks.length - 1;
  }, [allWeeks, currentWeekKey]);

  // Format hours for display
  const formatHours = (hours: number): string => {
    if (hours === 0) return "0";
    return hours.toFixed(2);
  };

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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
        {weekSummary.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="body1" color="text.secondary">
              No submitted entries for this week.
            </Typography>
          </Box>
        ) : (
          <TableContainer
            component={Paper}
            sx={{ flexGrow: 1, overflow: "auto" }}
          >
            <Table stickyHeader className="weekly-summary-table">
              <TableHead>
                <TableRow>
                  <TableCell className="weekly-summary-project-header">
                    Project
                  </TableCell>
                  {weekDays.map((day, index) => (
                    <TableCell
                      key={index}
                      align="center"
                      className="weekly-summary-day-header"
                    >
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                          {getDayName(day)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateShort(day)}
                        </Typography>
                      </Box>
                    </TableCell>
                  ))}
                  <TableCell
                    align="center"
                    className="weekly-summary-total-header"
                  >
                    Total
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {weekSummary.map((summary) => (
                  <TableRow key={summary.project}>
                    <TableCell className="weekly-summary-project-cell">
                      {summary.project}
                    </TableCell>
                    {summary.days.map((hours, dayIndex) => (
                      <TableCell
                        key={dayIndex}
                        align="center"
                        className="weekly-summary-hours-cell"
                      >
                        {formatHours(hours)}
                      </TableCell>
                    ))}
                    <TableCell
                      align="center"
                      className="weekly-summary-project-total"
                    >
                      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                        {formatHours(summary.total)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="weekly-summary-total-row">
                  <TableCell className="weekly-summary-project-cell">
                    <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                      Total
                    </Typography>
                  </TableCell>
                  {dayTotals.map((hours, dayIndex) => (
                    <TableCell
                      key={dayIndex}
                      align="center"
                      className="weekly-summary-day-total"
                    >
                      <Typography variant="body2" sx={{ fontWeight: "bold" }}>
                        {formatHours(hours)}
                      </Typography>
                    </TableCell>
                  ))}
                  <TableCell
                    align="center"
                    className="weekly-summary-grand-total"
                  >
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: "bold", fontSize: "1.1em" }}
                    >
                      {formatHours(grandTotal)}
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        )}
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
