import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
import { useHandsontableTheme } from "@/hooks/useHandsontableTheme";
import {
  getToolColumnConfig,
  getChargeCodeColumnConfig,
  handleProjectChange,
  handleToolChange,
  handleHoursChange,
  handleStandardUpdate,
} from "./macroManagerDialog.helpers";
import type { HandsontableChange } from "./macroManagerDialog.types";
import { getColumnDefinitions } from "./macroManagerDialog.columns";
import {
  getAllProjectsAsync,
  getAllChargeCodesAsync,
} from "@sheetpilot/shared/business-config";
import { logError, logVerbose } from "@/services/ipc/logger";

// Register Handsontable modules
registerAllModules();
registerEditor("spellcheckText", SpellcheckEditor);

const createEmptyMacro = (): MacroRow => ({
  name: "",
  project: "",
  tool: null,
  chargeCode: null,
  taskDescription: "",
});

const applyMacroChange = (
  next: MacroRow[],
  rowIndex: number,
  field: keyof MacroRow,
  newVal: unknown,
  oldVal: unknown
): boolean => {
  if (field === "project") return handleProjectChange(next, rowIndex, newVal, oldVal);
  if (field === "tool") return handleToolChange(next, rowIndex, newVal);
  if (field === "hours" && newVal !== undefined && newVal !== null && newVal !== "") {
    return handleHoursChange(next, rowIndex, newVal);
  }
  return handleStandardUpdate(next, rowIndex, field, newVal);
};

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
  // Business config state - loaded from database (database is single source of truth)
  const [projects, setProjects] = useState<readonly string[]>([]);
  const [chargeCodes, setChargeCodes] = useState<readonly string[]>([]);
  const handsontableTheme = useHandsontableTheme();

  // Load business config from database when dialog opens
  useEffect(() => {
    if (open) {
      async function loadBusinessConfig() {
        logVerbose("[MacroManagerDialog] Loading business config from database");
        try {
          const [projectsResult, chargeCodesResult] = await Promise.all([
            getAllProjectsAsync(),
            getAllChargeCodesAsync(),
          ]);
          setProjects(projectsResult);
          setChargeCodes(chargeCodesResult);
          logVerbose("[MacroManagerDialog] Business config loaded", {
            projectsCount: projectsResult.length,
            chargeCodesCount: chargeCodesResult.length,
          });
        } catch (error) {
          logError("[MacroManagerDialog] Could not load business config from database", {
            error: error instanceof Error ? error.message : String(error),
          });
          // Keep empty arrays - database is source of truth, no fallback
        }
      }
      void loadBusinessConfig();
    }
  }, [open]);

  // Load macros when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadMacros();
      // Ensure we always have 5 rows - synchronizing with external state (localStorage)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMacroData(Array(5).fill(null).map((_, idx) => loaded[idx] || createEmptyMacro()));
    }
  }, [open]);
  
  // Column definitions - database is single source of truth
  const columnDefinitions = useMemo(
    () => getColumnDefinitions(projects, chargeCodes),
    [projects, chargeCodes]
  );

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
      const hasChanges = changes.reduce((didChange, change) => {
        const [row, prop, oldVal, newVal] = change;
        if (oldVal === newVal) return didChange;

        const rowIndex = row as number;
        if (!next[rowIndex]) return didChange;

        // Cast prop to keyof MacroRow - we know our columns use string keys
        const field = prop as keyof MacroRow;

        return applyMacroChange(next, rowIndex, field, newVal, oldVal) || didChange;
      }, false);

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
            Configure up to 5 macros for quick timesheet entry. Use Ctrl+1 through Ctrl+5 to apply them.
          </Typography>
        </Box>

        <Box sx={{ flexGrow: 1, width: "100%", minHeight: 400, p: 1 }}>
          <HotTable
            ref={hotTableRef}
            data={macroData.length > 0 ? macroData : Array(5).fill(null).map(() => ({ ...createEmptyMacro(), hours: undefined }))}
            columns={columnDefinitions}
            cells={cellsFunction}
            afterChange={handleAfterChange}
            themeName={handsontableTheme}
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
