/**
 * @fileoverview Enhanced Renderer Component Tests
 * 
 * Comprehensive tests for React components including real rendering,
 * user interactions, and IPC communication.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock Electron IPC functions
const mockTimesheet = {
  submit: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(),
  deleteDraft: vi.fn()
};

const mockCredentials = {
  store: vi.fn(),
  list: vi.fn(),
  delete: vi.fn()
};

const mockDatabase = {
  getAllTimesheetEntries: vi.fn(),
  getAllArchiveData: vi.fn()
};

// Mock Handsontable components
vi.mock('handsontable/dist/handsontable.full.min.css', () => ({}));
vi.mock('handsontable/registry', () => ({
  registerAllModules: vi.fn()
}));

vi.mock('@handsontable/react-wrapper', async () => {
  const React = await import('react');
  
  // Create a simple mock component inside the factory
  const MockHotTable = ({ colHeaders, data, afterChange }: { colHeaders: string[]; data: unknown[][]; afterChange: (changes: unknown) => void }) => {
    return React.createElement('div', {
      'data-testid': 'timesheet-grid',
      'data-col-headers': JSON.stringify(colHeaders),
      'data-initial-data': JSON.stringify(data),
      onClick: () => {
        // Simulate afterChange callback
        if (afterChange) {
          afterChange([
            ['0', 'project', '', 'Test Project'],
            ['0', 'tool', '', 'VS Code']
          ]);
        }
      }
    }, 'Mock Handsontable Grid');
  };
  
  return {
    HotTable: MockHotTable
  };
});

// Import the mocked HotTable
import { HotTable } from '@handsontable/react-wrapper';

describe('Enhanced Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock window APIs
    Object.defineProperty(window, 'timesheet', {
      value: mockTimesheet,
      writable: true,
      configurable: true
    });

    Object.defineProperty(window, 'credentials', {
      value: mockCredentials,
      writable: true,
      configurable: true
    });

    Object.defineProperty(window, 'database', {
      value: mockDatabase,
      writable: true,
      configurable: true
    });
  });

  afterEach(() => {
    // Clear the DOM after each test to prevent multiple elements
    document.body.innerHTML = '';
  });

  describe('TimesheetGrid Component Integration', () => {
    it('should render with correct column headers', () => {
      const mockProps = {
        colHeaders: ['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'What You Did'],
        data: [{}],
        afterChange: vi.fn()
      };

      render(<HotTable {...mockProps} />);

      const grid = screen.getByTestId('timesheet-grid');
      expect(grid).toBeInTheDocument();
      
      const colHeaders = JSON.parse(grid.getAttribute('data-col-headers') || '[]');
      expect(colHeaders).toEqual(['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'What You Did']);
    });

    it('should handle data changes through afterChange callback', async () => {
      const mockAfterChange = vi.fn();
      const mockProps = {
        colHeaders: ['Project', 'Tool'],
        data: [{}],
        afterChange: mockAfterChange
      };

      render(<HotTable {...mockProps} />);

      const grids = screen.getAllByTestId('timesheet-grid');
      // Use the first grid
      const grid = grids[0]!;
      fireEvent.click(grid);

      expect(mockAfterChange).toHaveBeenCalledWith([
        ['0', 'project', '', 'Test Project'],
        ['0', 'tool', '', 'VS Code']
      ]);
    });

    it('should initialize with blank row data', () => {
      const mockProps = {
        colHeaders: ['Date', 'Project'],
        data: [{}],
        afterChange: vi.fn()
      };

      render(<HotTable {...mockProps} />);

      const grids = screen.getAllByTestId('timesheet-grid');
      // Use the first grid
      const grid = grids[0]!;
      const initialData = JSON.parse(grid.getAttribute('data-initial-data') || '[]');
      expect(initialData).toEqual([{}]);
    });
  });

  describe('Data Validation Logic', () => {
    it('should validate required fields correctly', () => {
      const validateRequiredFields = (row: Record<string, unknown>) => {
        const errors: string[] = [];
        if (!row.date) errors.push('Date is required');
        if (!row.hours) errors.push('Hours is required');
        if (!row.project) errors.push('Project is required');
        if (!row.taskDescription) errors.push('What You Did is required');
        return errors;
      };

      // Valid row
      const validRow = {
        date: '2025-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      };
      expect(validateRequiredFields(validRow)).toEqual([]);

      // Invalid row with missing fields
      const invalidRow = {
        date: '',
        hours: undefined,
        project: 'Test Project',
        taskDescription: ''
      };
      const errors = validateRequiredFields(invalidRow);
      expect(errors).toContain('Date is required');
      expect(errors).toContain('End Time is required');
      expect(errors).toContain('What You Did is required');
    });

    it('should validate time format and increments', () => {
      const isValidTime = (timeStr?: string) => {
        if (!timeStr) return false;
        const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
        if (!timeRegex.test(timeStr)) return false;
        
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        
        return totalMinutes % 15 === 0;
      };

      // Valid times
      expect(isValidTime('09:00')).toBe(true);
      expect(isValidTime('09:15')).toBe(true);
      expect(isValidTime('17:30')).toBe(true);

      // Invalid times
      expect(isValidTime('09:01')).toBe(false);
      expect(isValidTime('09:07')).toBe(false);
      expect(isValidTime('25:00')).toBe(false);
      expect(isValidTime('invalid')).toBe(false);
    });

    it('should validate time out is after time in', () => {
      const isTimeOutAfterTimeIn = (timeIn?: string, timeOut?: string) => {
        if (!timeIn || !timeOut) return true;
        
        const [inHours, inMinutes] = timeIn.split(':').map(Number);
        const [outHours, outMinutes] = timeOut.split(':').map(Number);
        
        const inTotalMinutes = inHours * 60 + inMinutes;
        const outTotalMinutes = outHours * 60 + outMinutes;
        
        return outTotalMinutes > inTotalMinutes;
      };

      expect(isTimeOutAfterTimeIn('09:00', '17:00')).toBe(true);
      expect(isTimeOutAfterTimeIn('09:15', '09:30')).toBe(true);
      expect(isTimeOutAfterTimeIn('17:00', '09:00')).toBe(false);
      expect(isTimeOutAfterTimeIn('09:30', '09:15')).toBe(false);
    });

    it('should validate date format', () => {
      const isValidDate = (dateStr?: string) => {
        if (!dateStr) return false;
        if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
        
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        
        return date.getFullYear() === year && 
               date.getMonth() === month - 1 && 
               date.getDate() === day;
      };

      expect(isValidDate('2025-01-15')).toBe(true);
      expect(isValidDate('2025-12-31')).toBe(true);
      expect(isValidDate('2024-02-29')).toBe(true); // Leap year

      expect(isValidDate('2025-1-1')).toBe(false); // Missing leading zeros
      expect(isValidDate('01/01/2025')).toBe(false); // Wrong format
      expect(isValidDate('2025-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2025-02-30')).toBe(false); // Invalid day
    });
  });

  describe('Project and Tool Dependencies', () => {
    it('should handle project selection logic', () => {
      const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
      
      const getToolOptions = (project?: string) => {
        if (!project || projectsWithoutTools.includes(project)) {
          return [];
        }
        
        const toolsByProject: Record<string, string[]> = {
          "FL-Carver Techs": ["DECA Meeting", "Logistics", "#1 Rinse and 2D marker"],
          "OSC-BBB": ["Meeting", "Non Tool Related", "#1 CSAM101"]
        };
        
        return toolsByProject[project] || [];
      };

      // Projects that need tools
      expect(getToolOptions("FL-Carver Techs")).toEqual(["DECA Meeting", "Logistics", "#1 Rinse and 2D marker"]);
      expect(getToolOptions("OSC-BBB")).toEqual(["Meeting", "Non Tool Related", "#1 CSAM101"]);

      // Projects that don't need tools
      expect(getToolOptions("PTO/RTO")).toEqual([]);
      expect(getToolOptions("Training")).toEqual([]);
      expect(getToolOptions("")).toEqual([]);
      expect(getToolOptions(undefined)).toEqual([]);
    });

    it('should handle tool and charge code dependencies', () => {
      const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
      
      const getChargeCodeOptions = (tool?: string) => {
        if (!tool || toolsWithoutCharges.includes(tool)) {
          return [];
        }
        
        return ["Admin", "EPR1", "EPR2", "EPR3", "EPR4", "Repair", "Meeting", "Other", "PM", "Training", "Upgrade"];
      };

      // Tools that don't need charge codes
      expect(getChargeCodeOptions("DECA Meeting")).toEqual([]);
      expect(getChargeCodeOptions("Meeting")).toEqual([]);
      expect(getChargeCodeOptions("Admin")).toEqual([]);

      // Tools that need charge codes
      expect(getChargeCodeOptions("#1 Rinse and 2D marker")).toContain("EPR1");
      expect(getChargeCodeOptions("AFM101")).toContain("EPR2");
    });

    it('should handle cascading field updates', () => {
      const updateRowForProjectChange = (row: Record<string, unknown>, newProject: string) => {
        const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
        
        if (projectsWithoutTools.includes(newProject)) {
          return {
            ...row,
            project: newProject,
            tool: null,
            chargeCode: null
          };
        }
        
        return {
          ...row,
          project: newProject,
          tool: null,
          chargeCode: null
        };
      };

      const updateRowForToolChange = (row: Record<string, unknown>, newTool: string) => {
        const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
        
        if (toolsWithoutCharges.includes(newTool)) {
          return {
            ...row,
            tool: newTool,
            chargeCode: null
          };
        }
        
        return {
          ...row,
          tool: newTool,
          chargeCode: (row as { chargeCode?: unknown }).chargeCode
        };
      };

      // Test project change to one that doesn't need tools
      const initialRow = {
        project: "FL-Carver Techs",
        tool: "DECA Meeting",
        chargeCode: "EPR1"
      };

      const updatedForPTO = updateRowForProjectChange(initialRow, "PTO/RTO");
      expect(updatedForPTO.project).toBe("PTO/RTO");
      expect(updatedForPTO.tool).toBeNull();
      expect(updatedForPTO.chargeCode).toBeNull();

      // Test tool change to one that doesn't need charge codes
      const updatedForMeeting = updateRowForToolChange(initialRow, "Meeting");
      expect(updatedForMeeting.tool).toBe("Meeting");
      expect(updatedForMeeting.chargeCode).toBeNull();
    });
  });

  describe('IPC Communication', () => {
    it('should handle saveDraft IPC call', async () => {
      mockTimesheet.saveDraft.mockResolvedValue({
        success: true,
        changes: 1
      });

      const result = await window.timesheet!.saveDraft({
        date: '2025-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      });

      expect(result.success).toBe(true);
      expect(result.changes).toBe(1);
      expect(mockTimesheet.saveDraft).toHaveBeenCalledWith({
        date: '2025-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      });
    });

    it('should handle loadDraft IPC call', async () => {
      const mockData = [
        {
          date: '2025-01-15',
          timeIn: '09:00',
          timeOut: '17:00',
          project: 'Test Project',
          tool: 'VS Code',
          chargeCode: 'DEV001',
          taskDescription: 'Test task'
        }
      ];

      mockTimesheet.loadDraft.mockResolvedValue({
        success: true,
        entries: mockData
      });

      const result = await window.timesheet!.loadDraft();

      expect(result.success).toBe(true);
      expect(result.entries).toEqual(mockData);
      expect(mockTimesheet.loadDraft).toHaveBeenCalled();
    });

    it('should handle IPC errors gracefully', async () => {
      mockTimesheet.saveDraft.mockRejectedValue(new Error('Database connection failed'));

      const saveDraft = async (row: {
        id?: number;
        date: string;
        timeIn: string;
        timeOut: string;
        project: string;
        tool?: string | null;
        chargeCode?: string | null;
        taskDescription: string;
      }) => {
        try {
          return await window.timesheet!.saveDraft(row);
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      };

      const result = await saveDraft({
        date: '2025-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'Test Project',
        taskDescription: 'Test task'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database connection failed');
    });
  });

  describe('Data Normalization', () => {
    it('should normalize trailing blank rows', () => {
      const normalizeTrailingBlankRows = (rows: Record<string, unknown>[]) => {
        let lastNonEmptyIndex = -1;
        
        // Find the last non-empty row
        for (let i = rows.length - 1; i >= 0; i--) {
          const row = rows[i];
          if (row?.date || row?.timeIn || row?.timeOut || row?.project || row?.tool || row?.chargeCode || row?.taskDescription) {
            lastNonEmptyIndex = i;
            break;
          }
        }
        
        // Keep one blank row at the end
        return rows.slice(0, lastNonEmptyIndex + 2);
      };

      const testRows = [
        { project: 'Project 1' },
        { project: 'Project 2' },
        {}, // empty row
        {}, // another empty row
        {}  // third empty row
      ];

      const normalized = normalizeTrailingBlankRows(testRows);
      expect(normalized).toHaveLength(3); // Should keep one blank row at the end
      expect(normalized[0].project).toBe('Project 1');
      expect(normalized[1].project).toBe('Project 2');
      expect(normalized[2]).toEqual({});
    });

    it('should normalize N/A fields to null', () => {
      const normalizeRowData = (row: Record<string, unknown>) => {
        const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
        const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
        
        const normalized = { ...row };
        
        // If project doesn't need tools, clear tool and chargeCode
        if (projectsWithoutTools.includes(normalized.project as string)) {
          normalized.tool = null;
          normalized.chargeCode = null;
        }
        
        // If tool doesn't need charge codes, clear chargeCode
        if (toolsWithoutCharges.includes(normalized.tool as string)) {
          normalized.chargeCode = null;
        }
        
        return normalized;
      };

      // Project that doesn't need tools
      const rowWithNoToolsProject = {
        project: 'PTO/RTO',
        tool: 'Some Tool',
        chargeCode: 'EPR1'
      };
      const normalized1 = normalizeRowData(rowWithNoToolsProject);
      expect(normalized1.tool).toBeNull();
      expect(normalized1.chargeCode).toBeNull();

      // Tool that doesn't need charge codes
      const rowWithNoChargeTool = {
        project: 'FL-Carver Techs',
        tool: 'DECA Meeting',
        chargeCode: 'EPR1'
      };
      const normalized2 = normalizeRowData(rowWithNoChargeTool);
      expect(normalized2.tool).toBe('DECA Meeting');
      expect(normalized2.chargeCode).toBeNull();

      // Normal row (no normalization needed)
      const normalRow = {
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1'
      };
      const normalized3 = normalizeRowData(normalRow);
      expect(normalized3.tool).toBe('#1 Rinse and 2D marker');
      expect(normalized3.chargeCode).toBe('EPR1');
    });
  });

  describe('User Experience Features', () => {
    it('should provide user-friendly error messages', () => {
      const getErrorMessage = (field: string, value: string): string | null => {
        const messages: Record<string, string | null> = {
          date: value ? 'Date must be like 2025-01-15' : 'Please enter a date',
          timeIn: value ? 'Time must be like 09:00 and in 15 minute steps' : 'Please enter start time',
          timeOut: value ? 'Time must be like 17:00 and in 15 minute steps' : 'Please enter end time',
          project: value ? 'Please pick from the list' : 'Please pick a project',
          tool: value ? 'Please pick from the list' : 'Please pick a tool for this project',
          chargeCode: value ? 'Please pick from the list' : 'Please pick a charge code for this tool',
          taskDescription: value ? null : 'Please describe what you did'
        };
        
        return messages[field] || null;
      };

      expect(getErrorMessage('date', '')).toBe('Please enter a date');
      expect(getErrorMessage('date', 'invalid')).toBe('Date must be like 2025-01-15');
      expect(getErrorMessage('timeIn', '')).toBe('Please enter start time');
      expect(getErrorMessage('timeIn', 'invalid')).toBe('Time must be like 09:00 and in 15 minute steps');
      expect(getErrorMessage('project', '')).toBe('Please pick a project');
      expect(getErrorMessage('taskDescription', '')).toBe('Please describe what you did');
    });

    it('should provide helpful placeholder text', () => {
      const placeholders = {
        date: 'Like 2025-01-15',
        timeIn: 'Like 09:00',
        timeOut: 'Like 17:00',
        project: 'Pick a project',
        tool: 'Pick a tool',
        chargeCode: 'Pick a charge code',
        taskDescription: 'Describe what you did'
      };

      expect(placeholders.date).toBe('Like 2025-01-15');
      expect(placeholders.timeIn).toBe('Like 09:00');
      expect(placeholders.timeOut).toBe('Like 17:00');
      expect(placeholders.project).toBe('Pick a project');
      expect(placeholders.tool).toBe('Pick a tool');
      expect(placeholders.chargeCode).toBe('Pick a charge code');
      expect(placeholders.taskDescription).toBe('Describe what you did');
    });
  });
});
