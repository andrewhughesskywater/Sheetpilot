/**
 * @fileoverview Weekly Summary Table Component
 *
 * Renders a table showing hours worked by project and day for a selected week.
 *
 * @author SheetPilot Team
 * @version 1.0.0
 */

import { useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import {
  calculateWeekSummary,
  getDayName,
  formatDateShort,
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
  comment?: string;
  lastSubmitted?: string;
}

/**
 * Props for WeeklySummaryTable component
 */
interface WeeklySummaryTableProps {
  archiveData: TimesheetEntry[];
  weekDays: Date[];
}

/**
 * Format hours as string with decimal places
 */
const formatHours = (hours: number | null): string => {
  if (hours === null || hours === 0) return "-";
  return hours.toFixed(2);
};

/**
 * WeeklySummaryTable Component
 *
 * Displays a table with hours worked by project and day.
 *
 * @param archiveData - Array of submitted timesheet entries
 * @param weekDays - Array of dates representing the 7 days of the week
 * @returns Rendered table or empty message
 */
export const WeeklySummaryTable: React.FC<WeeklySummaryTableProps> = ({
  archiveData,
  weekDays,
}) => {
  // Calculate week summary
  const weekSummary = useMemo(
    () => calculateWeekSummary(archiveData, weekDays),
    [archiveData, weekDays]
  );

  // Calculate day totals
  const dayTotals = useMemo(() => {
    if (weekSummary.length === 0) return new Array(7).fill(0);
    const totals = new Array(7).fill(0);
    weekSummary.forEach((summary) => {
      summary.days.forEach((hours, dayIndex) => {
        totals[dayIndex] += hours;
      });
    });
    return totals;
  }, [weekSummary]);

  // Calculate grand total
  const grandTotal = useMemo(() => {
    return dayTotals.reduce((sum, hours) => sum + hours, 0);
  }, [dayTotals]);

  if (weekSummary.length === 0) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="body1" color="text.secondary">
          No submitted entries for this week.
        </Typography>
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} sx={{ flexGrow: 1, overflow: "auto" }}>
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
            <TableCell align="center" className="weekly-summary-total-header">
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
            <TableCell align="center" className="weekly-summary-grand-total">
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
  );
};

export default WeeklySummaryTable;
