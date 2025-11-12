import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import type { MacroRow } from '../../utils/macroStorage';
import { saveMacros, loadMacros } from '../../utils/macroStorage';
import { PROJECTS, CHARGE_CODES, getToolsForProject, doesToolNeedChargeCode, doesProjectNeedTools } from '../../config/business-config';
import { formatTimeInput } from './timesheet.schema';

interface MacroManagerDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (macros: MacroRow[]) => void;
}

const MacroManagerDialog = ({ open, onClose, onSave }: MacroManagerDialogProps) => {
  const [macroData, setMacroData] = useState<MacroRow[]>([]);
  const [expandedMacro, setExpandedMacro] = useState<number | false>(0);

  // Load macros when dialog opens
  useEffect(() => {
    if (open) {
      const loaded = loadMacros();
      // Use setTimeout to defer setState to avoid sync setState in effect
      setTimeout(() => setMacroData(loaded), 0);
    }
  }, [open]);

  const handleMacroChange = (index: number, field: keyof MacroRow, value: string | null) => {
    const next = [...macroData];
    
    // Format time inputs
    if ((field === 'timeIn' || field === 'timeOut') && value) {
      value = formatTimeInput(value);
    }
    
    // Cascade project → tool → chargeCode
    if (field === 'project') {
      const needsTools = value && doesProjectNeedTools(value);
      next[index] = {
        ...next[index],
        project: value || '',
        tool: needsTools ? next[index].tool : null,
        chargeCode: needsTools ? next[index].chargeCode : null
      };
    } else if (field === 'tool') {
      const needsCharge = value && doesToolNeedChargeCode(value);
      next[index] = {
        ...next[index],
        tool: value,
        chargeCode: needsCharge ? next[index].chargeCode : null
      };
    } else {
      next[index] = { ...next[index], [field]: value || '' };
    }
    
    setMacroData(next);
  };

  const handleSave = () => {
    saveMacros(macroData);
    onSave(macroData);
    onClose();
  };

  const handleAccordionChange = (macroIndex: number) => (_event: React.SyntheticEvent, isExpanded: boolean) => {
    setExpandedMacro(isExpanded ? macroIndex : false);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Edit Macros
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Configure up to 5 macros for quick timesheet entry. Use keyboard shortcuts Ctrl+1 through Ctrl+5 to apply them.
        </Typography>
        
        {macroData.map((macro, index) => (
          <Accordion
            key={index}
            expanded={expandedMacro === index}
            onChange={handleAccordionChange(index)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>
                Macro {index + 1} (Ctrl+{index + 1}): {macro.name || '(Not configured)'}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Macro Name"
                  value={macro.name || ''}
                  onChange={(e) => handleMacroChange(index, 'name', e.target.value)}
                  fullWidth
                  size="small"
                />
                
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    label="Start Time"
                    value={macro.timeIn || ''}
                    onChange={(e) => handleMacroChange(index, 'timeIn', e.target.value)}
                    placeholder="0000 to 2400"
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="End Time"
                    value={macro.timeOut || ''}
                    onChange={(e) => handleMacroChange(index, 'timeOut', e.target.value)}
                    placeholder="0000 to 2400"
                    size="small"
                    sx={{ flex: 1 }}
                  />
                </Box>
                
                <FormControl fullWidth size="small">
                  <InputLabel>Project</InputLabel>
                  <Select
                    value={macro.project || ''}
                    label="Project"
                    onChange={(e) => handleMacroChange(index, 'project', e.target.value)}
                  >
                    <MenuItem value="">
                      <em>None</em>
                    </MenuItem>
                    {PROJECTS.map((project) => (
                      <MenuItem key={project} value={project}>
                        {project}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                {macro.project && doesProjectNeedTools(macro.project) && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Tool</InputLabel>
                    <Select
                      value={macro.tool || ''}
                      label="Tool"
                      onChange={(e) => handleMacroChange(index, 'tool', e.target.value)}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {getToolsForProject(macro.project).map((tool) => (
                        <MenuItem key={tool} value={tool}>
                          {tool}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                
                {macro.tool && doesToolNeedChargeCode(macro.tool) && (
                  <FormControl fullWidth size="small">
                    <InputLabel>Charge Code</InputLabel>
                    <Select
                      value={macro.chargeCode || ''}
                      label="Charge Code"
                      onChange={(e) => handleMacroChange(index, 'chargeCode', e.target.value)}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      {CHARGE_CODES.map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                
                <TextField
                  label="Task Description"
                  value={macro.taskDescription || ''}
                  onChange={(e) => handleMacroChange(index, 'taskDescription', e.target.value)}
                  fullWidth
                  size="small"
                  multiline
                  rows={2}
                  inputProps={{ maxLength: 120 }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
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
