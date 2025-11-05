import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';
import { HotTable } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import type { HotTableRef } from '@handsontable/react-wrapper';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import type { MacroRow } from '../../utils/macroStorage';
import { saveMacros, loadMacros } from '../../utils/macroStorage';
import { projects, chargeCodes, projectsWithoutTools, toolsWithoutCharges, getToolOptions, toolNeedsChargeCode, projectNeedsTools } from './timesheet.options';
import { formatTimeInput } from './timesheet.schema';
import './MacroManagerDialog.css';

// Register all Handsontable modules
registerAllModules();

interface MacroManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (macros: MacroRow[]) => void;
}

const MacroManagerDialog = ({ open, onClose, onSave }: MacroManagerDialogProps) => {
  const hotTableRef = useRef<HotTableRef>(null);
  const [macroData, setMacroData] = useState<MacroRow[]>([]);

  // Load macros when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadMacros();
      setMacroData(loaded);
    }
  }, [open]);

  // Handle changes to macro data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleAfterChange = useCallback((changes: any, source: string) => {
    if (!changes || source === 'loadData') return;

    const next = [...macroData];

    for (const change of changes) {
      const [rowIdx, prop, oldVal, newVal] = change;
      if (!next[rowIdx]) continue;

      const currentRow = next[rowIdx];
      const propStr = String(prop);

      // Format time inputs
      if ((propStr === 'timeIn' || propStr === 'timeOut') && newVal && newVal !== oldVal) {
        next[rowIdx] = { ...currentRow, [propStr]: formatTimeInput(String(newVal)) };
        continue;
      }

      // Cascade project → tool → chargeCode
      if (propStr === 'project' && newVal !== oldVal) {
        const project = String(newVal ?? '');
        next[rowIdx] = projectsWithoutTools.has(project)
          ? { ...currentRow, project, tool: null, chargeCode: null }
          : { ...currentRow, project };
      } else if (propStr === 'tool' && newVal !== oldVal) {
        const tool = String(newVal ?? '');
        next[rowIdx] = toolsWithoutCharges.has(tool)
          ? { ...currentRow, tool, chargeCode: null }
          : { ...currentRow, tool };
      } else {
        next[rowIdx] = { ...currentRow, [propStr]: newVal ?? '' };
      }
    }

    setMacroData(next);
  }, [macroData]);

  // Cell-level configuration (same as main grid)
  const cellsFunction = useCallback((row: number, col: number) => {
    if (row < 0 || row >= macroData.length) {
      return {};
    }

    const rowData = macroData[row];
    if (!rowData) {
      return {};
    }

    // Tool column - dynamic dropdown based on selected project
    if (col === 2) {
      const project = rowData?.project;
      if (!project || !projectNeedsTools(project)) {
        return {
          className: 'htDimmed',
          placeholder: project ? 'N/A' : '',
          readOnly: true,
          source: []
        };
      }
      return {
        source: getToolOptions(project),
        placeholder: 'Pick a Tool',
        readOnly: false
      };
    }

    // Charge code column - conditional based on selected tool
    if (col === 3) {
      const tool = rowData?.tool;
      if (!tool || !toolNeedsChargeCode(tool)) {
        return {
          className: 'htDimmed',
          placeholder: tool ? 'N/A' : '',
          readOnly: true
        };
      }
      return {
        placeholder: 'Pick a Charge Code',
        readOnly: false
      };
    }

    return {};
  }, [macroData]);

  // Column definitions (without date column)
  const columnDefinitions = useMemo(() => [
    { data: 'timeIn', title: 'Start Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'timeOut', title: 'End Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'project', title: 'Project', type: 'dropdown', source: projects, strict: true, allowInvalid: false, placeholder: 'Pick a project', className: 'htCenter', trimDropdown: false },
    { data: 'tool', title: 'Tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'chargeCode', title: 'Charge Code', type: 'dropdown', source: chargeCodes, strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'taskDescription', title: 'Task Description', type: 'text', placeholder: '', className: 'htLeft', maxLength: 120 }
  ], []);

  // Custom row headers for macro labels
  const rowHeaders = useMemo(() => {
    return ['Macro 1', 'Macro 2', 'Macro 3', 'Macro 4', 'Macro 5'];
  }, []);

  const handleSave = useCallback(() => {
    saveMacros(macroData);
    onSave(macroData);
    onClose();
  }, [macroData, onSave, onClose]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        className: 'macro-manager-dialog-paper'
      }}
    >
      <DialogTitle className="macro-manager-dialog-title">
        Edit Macros
      </DialogTitle>
      <DialogContent className="macro-manager-dialog-content">
        <div className="macro-manager-instructions">
          Configure up to 5 macros for quick timesheet entry. Leave rows empty if not needed.
          Macros can be applied using buttons or keyboard shortcuts (Ctrl+1 through Ctrl+5).
        </div>
        <div className="macro-manager-table-container">
          <HotTable
            ref={hotTableRef}
            data={macroData}
            columns={columnDefinitions}
            cells={cellsFunction}
            afterChange={handleAfterChange}
            themeName="ht-theme-horizon"
            width="100%"
            height="auto"
            rowHeaders={rowHeaders}
            colHeaders={true}
            customBorders={[]}
            contextMenu={false}
            manualColumnResize={true}
            stretchH="all"
            licenseKey="non-commercial-and-evaluation"
            minRows={5}
            maxRows={5}
            readOnly={false}
            fillHandle={true}
            outsideClickDeselects={true}
            fragmentSelection={false}
            disableVisualSelection={false}
            selectionMode="single"
          />
        </div>
      </DialogContent>
      <DialogActions className="macro-manager-dialog-actions">
        <Button onClick={handleCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained" color="primary">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MacroManagerDialog;

