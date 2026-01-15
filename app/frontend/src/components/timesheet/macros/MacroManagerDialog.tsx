import { useState, useEffect, useRef, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { HotTable } from "@handsontable/react-wrapper";
import type { HotTableRef } from "@handsontable/react-wrapper";
import { registerAllModules } from "handsontable/registry";
import { registerEditor } from "handsontable/editors";
import "handsontable/styles/handsontable.css";
import "handsontable/styles/ht-theme-horizon.css";
import "@/components/timesheet/TimesheetGrid.css"; // Reuse TimesheetGrid styles

import type { MacroRow } from "@/utils/macroStorage";
import { saveMacros, loadMacros } from "@/utils/macroStorage";
import { SpellcheckEditor } from "@/components/timesheet/editors/SpellcheckEditor";
import {
  getToolColumnConfig,
  getChargeCodeColumnConfig,
  handleProjectChange,
  handleToolChange,
  handleHoursChange,
  handleStandardUpdate,
} from "./macroManagerDialog.helpers";
import type { HandsontableChange } from "./macroManagerDialog.types";
import { columnDefinitions } from "./macroManagerDialog.columns";

// Register Handsontable modules
registerAllModules();
registerEditor("spellcheckText", SpellcheckEditor);

interface MacroManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (macros: MacroRow[]) => void;
}

const MacroManagerDialog = ({
  open,
  onClose,
  onSave,
}: MacroManagerDialogProps) => {
  const [macroData, setMacroData] = useState<MacroRow[]>([]);
  const hotTableRef = useRef<HotTableRef>(null);
  const isInternalChangeRef = useRef(false);

  // Load macros when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadMacros();
      // Ensure we always have 5 rows
      const filledMacros = Array(5)
        .fill(null)
        .map(
          (_, idx) =>
            loaded[idx] || {
              name: "",
              project: "",
              tool: null,
              chargeCode: null,
              taskDescription: "",
            }
        );
      // This is an appropriate use of setState in useEffect - we're synchronizing
      // with external state (localStorage) when the dialog opens
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMacroData(filledMacros);
    }
  }, [open]);

  // Initialize table after dialog is fully opened and data is loaded
  useEffect(() => {
    if (!open || macroData.length === 0) return;

    const timer = setTimeout(() => {
      const hotInstance = hotTableRef.current?.hotInstance;
      if (hotInstance) {
        // Load data and force a render
        hotInstance.loadData(macroData);
        hotInstance.render();
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [open, macroData]);

  const handleSave = () => {
    // Get the latest data from Handsontable to ensure we have all edits
    let currentData = macroData;
    if (hotTableRef.current?.hotInstance) {
      currentData =
        hotTableRef.current.hotInstance.getSourceData() as MacroRow[];
    }

    saveMacros(currentData);
    onSave(currentData);
    onClose();
  };

  // Cell-level configuration (cascades over column config)
  const cellsFunction = useCallback(
    (row: number, col: number) => {
      // Add bounds checking
      if (row < 0 || row >= macroData.length) {
        return {};
      }

      const rowData = macroData[row];
      if (!rowData) {
        return {};
      }

      // Column indices based on columnDefinitions below:
      // 0: Name, 1: Hours, 2: Project, 3: Tool, 4: Charge Code, 5: Task Desc

      // Tool column (3) - dynamic dropdown based on selected project
      if (col === 3) {
        return getToolColumnConfig(rowData);
      }

      // Charge code column (4) - conditional based on selected tool
      if (col === 4) {
        return getChargeCodeColumnConfig(rowData);
      }

      return {};
    },
    [macroData]
  );

  const handleAfterChange = useCallback(
    (changes: HandsontableChange[] | null, source: string) => {
      if (!changes || source === "loadData" || isInternalChangeRef.current)
        return;

      const hotInstance = hotTableRef.current?.hotInstance;
      if (!hotInstance) return;

      const next = [...macroData];
      let hasChanges = false;

      changes.forEach(([row, prop, oldVal, newVal]) => {
        if (oldVal === newVal) return;

        const rowIndex = row as number;
        if (!next[rowIndex]) return;

        // Cast prop to keyof MacroRow - we know our columns use string keys
        const field = prop as keyof MacroRow;

        // Handle Cascading Logic
        if (field === "project") {
          hasChanges =
            handleProjectChange(next, rowIndex, newVal, oldVal) || hasChanges;
        } else if (field === "tool") {
          hasChanges = handleToolChange(next, rowIndex, newVal) || hasChanges;
        } else if (
          field === "hours" &&
          newVal !== undefined &&
          newVal !== null &&
          newVal !== ""
        ) {
          hasChanges = handleHoursChange(next, rowIndex, newVal) || hasChanges;
        } else {
          hasChanges =
            handleStandardUpdate(next, rowIndex, field, newVal) || hasChanges;
        }
      });

      if (hasChanges) {
        // Update state
        setMacroData(next);

        // Reflect changes back to grid (especially for cascading clears and formatting)
        // prevent recursion loop
        isInternalChangeRef.current = true;
        hotInstance.loadData(next);
        isInternalChangeRef.current = false;
      }
    },
    [macroData]
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: "80vh", maxHeight: 800 },
      }}
    >
      <DialogTitle>Edit Macros</DialogTitle>
      <DialogContent sx={{ p: 0, display: "flex", flexDirection: "column" }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Configure up to 5 macros for quick timesheet entry. Use keyboard
            shortcuts Ctrl+1 through Ctrl+5 to apply them.
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1, width: "100%", minHeight: 400, p: 1 }}>
          <HotTable
            ref={hotTableRef}
            data={
              macroData.length > 0
                ? macroData
                : Array(5)
                    .fill(null)
                    .map(() => ({
                      name: "",
                      hours: undefined,
                      project: "",
                      tool: null,
                      chargeCode: null,
                      taskDescription: "",
                    }))
            }
            columns={columnDefinitions}
            cells={cellsFunction}
            afterChange={handleAfterChange}
            themeName="ht-theme-horizon"
            width="100%"
            height={400}
            rowHeaders={true}
            colHeaders={true}
            manualColumnResize={true}
            stretchH="all"
            licenseKey="non-commercial-and-evaluation"
            minRows={5}
            maxRows={5}
            contextMenu={["undo", "redo", "copy", "cut"]}
            enterMoves={{ row: 0, col: 1 }}
            tabMoves={{ row: 0, col: 1 }}
            autoWrapRow={true}
            autoWrapCol={true}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save Macros
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MacroManagerDialog;
