import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { HotTable } from '@handsontable/react-wrapper';
import type { HotTableRef } from '@handsontable/react-wrapper';
import { registerAllModules } from 'handsontable/registry';
import { registerEditor } from 'handsontable/editors';
import 'handsontable/styles/handsontable.css';
import 'handsontable/styles/ht-theme-horizon.css';
import '@/components/timesheet/TimesheetGrid.css'; // Reuse TimesheetGrid styles

import type { MacroRow } from '@/utils/macroStorage';
import { saveMacros, loadMacros } from '@/utils/macroStorage';
import { PROJECTS, CHARGE_CODES, getToolsForProject, doesToolNeedChargeCode, doesProjectNeedTools } from '@sheetpilot/shared/business-config';
import { formatTimeInput } from '@/components/timesheet/schema/timesheet.schema';
import { SpellcheckEditor } from '@/components/timesheet/editors/SpellcheckEditor';

// Register Handsontable modules
registerAllModules();
registerEditor('spellcheckText', SpellcheckEditor);

// Define a type that matches Handsontable's internal CellChange tuple structure
// [row, prop, oldValue, newValue]
// prop can be string, number, or function (though we only use string/number)
type HandsontableChange = [number, string | number | unknown, unknown, unknown];

interface MacroManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (macros: MacroRow[]) => void;
}

const MacroManagerDialog = ({ open, onClose, onSave }: MacroManagerDialogProps) => {
  const [macroData, setMacroData] = useState<MacroRow[]>([]);
  const hotTableRef = useRef<HotTableRef>(null);
  const isInternalChangeRef = useRef(false);

  // Load macros when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadMacros();
      // Ensure we always have 5 rows
      const filledMacros = Array(5).fill(null).map((_, idx) => loaded[idx] || {
        name: '',
        timeIn: '',
        timeOut: '',
        project: '',
        tool: null,
        chargeCode: null,
        taskDescription: ''
      });
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
      currentData = hotTableRef.current.hotInstance.getSourceData() as MacroRow[];
    }
    
    saveMacros(currentData);
    onSave(currentData);
    onClose();
  };

  // Cell-level configuration (cascades over column config)
  const cellsFunction = useCallback((row: number, col: number) => {
    // Add bounds checking
    if (row < 0 || row >= macroData.length) {
      return {};
    }
    
    const rowData = macroData[row];
    if (!rowData) {
      return {};
    }

    // Column indices based on columnDefinitions below:
    // 0: Name, 1: Start, 2: End, 3: Project, 4: Tool, 5: Charge Code, 6: Task Desc
    
    // Tool column (4) - dynamic dropdown based on selected project
    if (col === 4) {
      const project = rowData.project;
      if (!project || !doesProjectNeedTools(project)) {
        return { 
          className: 'htDimmed htCenter', 
          placeholder: project ? 'N/A' : '',
          readOnly: true,
          source: []
        };
      }
      return { 
        source: [...getToolsForProject(project)], 
        placeholder: 'Pick a Tool',
        readOnly: false,
        className: 'htCenter'
      };
    }
    
    // Charge code column (5) - conditional based on selected tool
    if (col === 5) {
      const tool = rowData.tool;
      if (!tool || !doesToolNeedChargeCode(tool)) {
        return { 
          className: 'htDimmed htCenter', 
          placeholder: tool ? 'N/A' : '',
          readOnly: true
        };
      }
      return { 
        placeholder: 'Pick a Charge Code',
        readOnly: false,
        className: 'htCenter'
      };
    }
    
    return {};
  }, [macroData]);

  const handleAfterChange = useCallback((changes: HandsontableChange[] | null, source: string) => {
    if (!changes || source === 'loadData' || isInternalChangeRef.current) return;
    
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
      if (field === 'project') {
        const project = String(newVal ?? '');
        if (!doesProjectNeedTools(project)) {
          next[rowIndex] = { 
            ...next[rowIndex], 
            project, 
            tool: null, 
            chargeCode: null 
          };
        } else {
          // If project changed but still needs tools, keep tool if valid or reset? 
          // TimesheetGrid logic resets if invalid, but let's keep it simple: reset if project changes
          if (oldVal !== newVal) {
             // Check if existing tool is valid for new project? 
             // Usually better to clear to avoid invalid combinations
             next[rowIndex] = { 
               ...next[rowIndex], 
               project, 
               tool: null, 
               chargeCode: null 
             };
          } else {
             next[rowIndex] = { ...next[rowIndex], project };
          }
        }
        hasChanges = true;
      } 
      else if (field === 'tool') {
        const tool = String(newVal ?? '');
        if (!doesToolNeedChargeCode(tool)) {
          next[rowIndex] = { ...next[rowIndex], tool, chargeCode: null };
        } else {
          next[rowIndex] = { ...next[rowIndex], tool };
        }
        hasChanges = true;
      }
      else if ((field === 'timeIn' || field === 'timeOut') && newVal) {
        // Format time
        const formatted = formatTimeInput(String(newVal));
        if (formatted !== newVal) {
          next[rowIndex] = { ...next[rowIndex], [field]: formatted };
          // We need to update the cell directly if we want to show formatted value immediately
          // But since we update state, the render cycle should handle it via updateData
          hasChanges = true;
        } else {
           next[rowIndex] = { ...next[rowIndex], [field]: newVal };
           hasChanges = true;
        }
      }
      else {
        // Standard update
        next[rowIndex] = { ...next[rowIndex], [field]: newVal };
        hasChanges = true;
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
  }, [macroData]);

  // Column definitions
  const columnDefinitions = useMemo(() => [
    { data: 'name', title: 'Macro Name', type: 'text', placeholder: 'Name your macro', className: 'htLeft' },
    { data: 'timeIn', title: 'Start', type: 'text', placeholder: '0800', className: 'htCenter', width: 60 },
    { data: 'timeOut', title: 'End', type: 'text', placeholder: '1700', className: 'htCenter', width: 60 },
    { data: 'project', 
      title: 'Project', 
      type: 'dropdown', 
      source: [...PROJECTS], 
      strict: true, 
      allowInvalid: false, 
      placeholder: 'Pick a project', 
      className: 'htCenter',
      trimDropdown: false
    },
    { data: 'tool', title: 'Tool', type: 'dropdown', source: [], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'chargeCode', title: 'Charge Code', type: 'dropdown', source: [...CHARGE_CODES], strict: true, allowInvalid: false, placeholder: '', className: 'htCenter' },
    { data: 'taskDescription', title: 'Task Description', editor: 'spellcheckText', placeholder: 'Description', className: 'htLeft', maxLength: 120 }
  ], []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: { height: '80vh', maxHeight: 800 }
      }}
    >
      <DialogTitle>
        Edit Macros
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 2, pb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Configure up to 5 macros for quick timesheet entry. Use keyboard shortcuts Ctrl+1 through Ctrl+5 to apply them.
          </Typography>
        </Box>
        
        <Box sx={{ flexGrow: 1, width: '100%', minHeight: 400, p: 1 }}>
          <HotTable
            ref={hotTableRef}
            data={macroData.length > 0 ? macroData : Array(5).fill(null).map(() => ({
              name: '',
              timeIn: '',
              timeOut: '',
              project: '',
              tool: null,
              chargeCode: null,
              taskDescription: ''
            }))}
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
            contextMenu={['undo', 'redo', 'copy', 'cut']}
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
