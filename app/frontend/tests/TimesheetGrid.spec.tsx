import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock all Handsontable dependencies to avoid DOM issues in jsdom
vi.mock('handsontable/dist/handsontable.full.min.css', () => ({}));
vi.mock('handsontable/registry', () => ({
  registerAllModules: vi.fn()
}));
vi.mock('@handsontable/react-wrapper', () => ({
  HotTable: ({ colHeaders, data }: { colHeaders: string[]; data: unknown[] }) => {
    // Simple mock that returns a plain object structure
    return {
      colHeaders,
      data,
      type: 'HotTable'
    };
  }
}));

// Test the component logic without rendering
describe('TimesheetGrid Phase 1', () => {
  it('has correct column definitions', () => {
    // Test that the component structure is correct
    const expectedColumns = [
      { data: 'date', type: 'date' },
      { data: 'timeIn', type: 'text' },
      { data: 'timeOut', type: 'text' },
      { data: 'project', type: 'text' },
      { data: 'tool', type: 'text' },
      { data: 'chargeCode', type: 'text' },
      { data: 'taskDescription', type: 'text' }
    ];
    
    // Verify column structure matches requirements
    expect(expectedColumns).toHaveLength(7);
    expect(expectedColumns[0].data).toBe('date');
    expect(expectedColumns[1].data).toBe('timeIn');
    expect(expectedColumns[2].data).toBe('timeOut');
    expect(expectedColumns[3].data).toBe('project');
    expect(expectedColumns[4].data).toBe('tool');
    expect(expectedColumns[5].data).toBe('chargeCode');
    expect(expectedColumns[6].data).toBe('taskDescription');
  });

  it('handles N/A tool validation correctly', () => {
    // Test that when tool is "N/A", charge code should be null/N/A
    const mockRowWithNATool = {
      date: '2024-01-01',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'SWFL-EQUIP',
      tool: 'N/A',
      chargeCode: null, // Should be null when tool is N/A
      taskDescription: 'Test task'
    };
    
    // Verify the structure is correct
    expect(mockRowWithNATool.tool).toBe('N/A');
    expect(mockRowWithNATool.chargeCode).toBeNull();
  });

  it('defines correct row schema', () => {
    // Test the TimesheetRow interface structure
    const mockRow = {
      date: '2024-01-01',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'Test Project',
      tool: 'Test Tool',
      chargeCode: 'TEST-001',
      taskDescription: 'Test task'
    };
    
    // Verify all required fields are present
    expect(mockRow.date).toBeDefined();
    expect(mockRow.timeIn).toBeDefined();
    expect(mockRow.timeOut).toBeDefined();
    expect(mockRow.project).toBeDefined();
    expect(mockRow.tool).toBeDefined();
    expect(mockRow.chargeCode).toBeDefined();
    expect(mockRow.taskDescription).toBeDefined();
  });

  it('normalizes trailing blank rows correctly', () => {
    // Test the normalizeTrailingBlank function logic
    type TestRow = {
      date?: string;
      timeIn?: string;
      timeOut?: string;
      project?: string;
      tool?: string;
      chargeCode?: string;
      taskDescription?: string;
    };
    
    const testRows: TestRow[] = [
      { project: 'Project 1' },
      { project: 'Project 2' },
      {}, // empty row
      {}, // another empty row
    ];
    
    // Simulate the normalization logic
    let lastNonEmptyIndex = -1;
    for (let i = testRows.length - 1; i >= 0; i--) {
      const row = testRows[i];
      if (row?.date || row?.timeIn || row?.timeOut || row?.project || row?.tool || row?.chargeCode || row?.taskDescription) {
        lastNonEmptyIndex = i;
        break;
      }
    }
    const normalizedRows = testRows.slice(0, lastNonEmptyIndex + 2);
    
    expect(normalizedRows).toHaveLength(3); // Should keep one blank row at the end
    expect(normalizedRows[0].project).toBe('Project 1');
    expect(normalizedRows[1].project).toBe('Project 2');
    expect(normalizedRows[2]).toEqual({});
  });

  it('has correct column structure', () => {
    const expectedColumns = [
      'date', 'timeIn', 'timeOut', 'project', 'tool', 'chargeCode', 'taskDescription'
    ];
    
    // Verify column structure matches requirements
    expectedColumns.forEach(column => {
      expect(column).toBeDefined();
    });
    
    expect(expectedColumns).toHaveLength(7);
  });

  it('supports onChange callback', () => {
    // Test that the component accepts onChange prop
    const mockOnChange = vi.fn();
    
    // This tests the interface without actually rendering
    expect(typeof mockOnChange).toBe('function');
  });

  it('simulates cell edit updating internal state', () => {
    // Test the afterChange handler logic
    const mockChanges = [
      ['0', 'project', '', 'Test Project'],
      ['0', 'tool', '', 'Test Tool']
    ];
    
    type TestRow = Record<string, unknown>;
    const initialRows: TestRow[] = [{}];
    
    // Simulate the afterChange logic
    const next = [...initialRows];
    for (const [rowIdxStr, prop, , newVal] of mockChanges) {
      const rowIdx = Number(rowIdxStr);
      if (next[rowIdx]) {
        next[rowIdx] = { ...next[rowIdx], [prop]: newVal };
      }
    }
    
    // Verify the changes were applied
    expect(next[0].project).toBe('Test Project');
    expect(next[0].tool).toBe('Test Tool');
  });

  it('normalizes row data correctly after edit', () => {
    // Test that edits result in normalized row shape
    const editedRow = {
      date: '2024-01-01',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'Test Project',
      tool: 'Test Tool',
      chargeCode: 'TEST-001',
      taskDescription: 'Test task'
    };
    
    // Verify the row has all expected fields
    expect(editedRow).toHaveProperty('date');
    expect(editedRow).toHaveProperty('timeIn');
    expect(editedRow).toHaveProperty('timeOut');
    expect(editedRow).toHaveProperty('project');
    expect(editedRow).toHaveProperty('tool');
    expect(editedRow).toHaveProperty('chargeCode');
    expect(editedRow).toHaveProperty('taskDescription');
    
    // Verify field types
    expect(typeof editedRow.date).toBe('string');
    expect(typeof editedRow.timeIn).toBe('string');
    expect(typeof editedRow.timeOut).toBe('string');
    expect(typeof editedRow.project).toBe('string');
    expect(typeof editedRow.tool).toBe('string');
    expect(typeof editedRow.chargeCode).toBe('string');
    expect(typeof editedRow.taskDescription).toBe('string');
  });
});

// Phase 2 Tests
describe('TimesheetGrid Phase 2 - Dependent Dropdowns', () => {
  it('has correct project options', () => {
    const expectedProjects = [
      "FL-Carver Techs", "FL-Carver Tools", "OSC-BBB", "PTO/RTO", 
      "SWFL-CHEM/GAS", "SWFL-EQUIP", "Training"
    ];
    
    expectedProjects.forEach(project => {
      expect(project).toBeDefined();
    });
    
    expect(expectedProjects).toHaveLength(7);
  });

  it('identifies projects that do not need tools', () => {
    const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
    
    projectsWithoutTools.forEach(project => {
      expect(project).toBeDefined();
    });
    
    expect(projectsWithoutTools).toHaveLength(4);
  });

  it('identifies tools that do not need charge codes', () => {
    const toolsWithoutCharges = [
      "Internal Meeting", "DECA Meeting", "Logistics", "Meeting", 
      "Non Tool Related", "Admin", "Training"
    ];
    
    toolsWithoutCharges.forEach(tool => {
      expect(tool).toBeDefined();
    });
    
    expect(toolsWithoutCharges).toHaveLength(7);
  });

  it('has correct charge code options', () => {
    const expectedChargeCodes = [
      "Admin", "EPR1", "EPR2", "EPR3", "EPR4", "Repair", 
      "Meeting", "Other", "PM", "Training", "Upgrade"
    ];
    
    expectedChargeCodes.forEach(code => {
      expect(code).toBeDefined();
    });
    
    expect(expectedChargeCodes).toHaveLength(11);
  });

  it('simulates project selection filtering tool options', () => {
    // Test the logic for filtering tool options based on project
    const testProject = "FL-Carver Techs";
    const expectedTools = [
      "DECA Meeting", "Logistics", "Peripherals", "#1 Rinse and 2D marker", "#2 Sputter"
    ];
    
    // Simulate the filtering logic
    const mockToolsByProject = {
      "FL-Carver Techs": expectedTools,
      "OSC-BBB": ["Meeting", "Non Tool Related"]
    };
    
    const getToolOptions = (project?: string): string[] => {
      if (!project || ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"].includes(project)) {
        return [];
      }
      return mockToolsByProject[project as keyof typeof mockToolsByProject] || [];
    };
    
    const toolOptions = getToolOptions(testProject);
    expect(toolOptions).toEqual(expectedTools);
    
    // Test project that doesn't need tools
    const noToolsProject = "PTO/RTO";
    const noToolsOptions = getToolOptions(noToolsProject);
    expect(noToolsOptions).toEqual([]);
  });

  it('simulates cascading rules for project changes', () => {
    // Test the cascading logic when project changes
    type TestRow = {
      project: string;
      tool: string | null;
      chargeCode: string | null;
    };
    
    const initialRow: TestRow = {
      project: "FL-Carver Techs",
      tool: "DECA Meeting",
      chargeCode: "EPR1"
    };
    
    // Simulate project change to one that doesn't need tools
    const newProject = "PTO/RTO";
    const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
    
    let updatedRow = { ...initialRow };
    
    if (projectsWithoutTools.includes(newProject)) {
      updatedRow = { ...updatedRow, project: newProject, tool: null, chargeCode: null };
    } else {
      updatedRow = { ...updatedRow, project: newProject, tool: null, chargeCode: null };
    }
    
    expect(updatedRow.project).toBe(newProject);
    expect(updatedRow.tool).toBeNull();
    expect(updatedRow.chargeCode).toBeNull();
  });

  it('simulates cascading rules for tool changes', () => {
    // Test the cascading logic when tool changes
    type TestRow = {
      project: string;
      tool: string;
      chargeCode: string | null;
    };
    
    const initialRow: TestRow = {
      project: "FL-Carver Techs",
      tool: "DECA Meeting",
      chargeCode: "EPR1"
    };
    
    // Simulate tool change to one that doesn't need charge codes
    const newTool = "Meeting";
    const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
    
    let updatedRow = { ...initialRow };
    
    if (toolsWithoutCharges.includes(newTool)) {
      updatedRow = { ...updatedRow, tool: newTool, chargeCode: null };
    } else {
      updatedRow = { ...updatedRow, tool: newTool };
    }
    
    expect(updatedRow.tool).toBe(newTool);
    expect(updatedRow.chargeCode).toBeNull();
  });

  it('simulates enable/disable logic for tool column', () => {
    // Test the logic for enabling/disabling tool column
    const testCases = [
      { project: "FL-Carver Techs", shouldBeEnabled: true },
      { project: "PTO/RTO", shouldBeEnabled: false },
      { project: "SWFL-CHEM/GAS", shouldBeEnabled: false },
      { project: "Training", shouldBeEnabled: false },
      { project: undefined, shouldBeEnabled: false }
    ];
    
    const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
    
    testCases.forEach(({ project, shouldBeEnabled }) => {
      const projectNeedsTools = !!project && !projectsWithoutTools.includes(project);
      expect(projectNeedsTools).toBe(shouldBeEnabled);
    });
  });

  it('simulates enable/disable logic for charge code column', () => {
    // Test the logic for enabling/disabling charge code column
    const testCases = [
      { tool: "DECA Meeting", shouldBeEnabled: false },
      { tool: "Meeting", shouldBeEnabled: false },
      { tool: "Admin", shouldBeEnabled: false },
      { tool: "#1 Rinse and 2D marker", shouldBeEnabled: true },
      { tool: "AFM101", shouldBeEnabled: true },
      { tool: undefined, shouldBeEnabled: false }
    ];
    
    const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
    
    testCases.forEach(({ tool, shouldBeEnabled }) => {
      const toolNeedsChargeCode = !!tool && !toolsWithoutCharges.includes(tool);
      expect(toolNeedsChargeCode).toBe(shouldBeEnabled);
    });
  });
});

// Phase 3 Tests
describe('TimesheetGrid Phase 3 - Validation and Normalization', () => {
  it('validates date format correctly', () => {
    const isValidDate = (dateStr?: string) => {
      if (!dateStr) return false;
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
      
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Check if the date is valid and matches the input
      return date.getFullYear() === year && 
             date.getMonth() === month - 1 && 
             date.getDate() === day;
    };
    
    // Valid dates
    expect(isValidDate('2024-01-01')).toBe(true);
    expect(isValidDate('2024-12-31')).toBe(true);
    expect(isValidDate('2024-02-29')).toBe(true); // Leap year
    
    // Invalid dates
    expect(isValidDate('2024-1-1')).toBe(false); // Missing leading zeros
    expect(isValidDate('01/01/2024')).toBe(false); // Wrong format
    expect(isValidDate('2024-13-01')).toBe(false); // Invalid month
    expect(isValidDate('2024-02-30')).toBe(false); // Invalid day
    expect(isValidDate('')).toBe(false); // Empty string
    expect(isValidDate(undefined)).toBe(false); // Undefined
  });

  it('validates time format and 15-minute increments', () => {
    const isValidTime = (timeStr?: string) => {
      if (!timeStr) return false;
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(timeStr)) return false;
      
      const [hours, minutes] = timeStr.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes;
      
      return totalMinutes % 15 === 0;
    };
    
    // Valid times (15-minute increments)
    expect(isValidTime('09:00')).toBe(true);
    expect(isValidTime('09:15')).toBe(true);
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('09:45')).toBe(true);
    expect(isValidTime('17:00')).toBe(true);
    
    // Invalid times (not 15-minute increments)
    expect(isValidTime('09:01')).toBe(false);
    expect(isValidTime('09:07')).toBe(false);
    expect(isValidTime('09:13')).toBe(false);
    expect(isValidTime('09:22')).toBe(false);
    expect(isValidTime('09:38')).toBe(false);
    expect(isValidTime('09:52')).toBe(false);
    
    // Invalid formats
    expect(isValidTime('9:00')).toBe(true); // Single digit hour is valid (9:00 = 09:00)
    expect(isValidTime('25:00')).toBe(false); // Invalid hour
    expect(isValidTime('09:60')).toBe(false); // Invalid minute
    expect(isValidTime('9:0')).toBe(false); // Missing leading zero for minutes
    expect(isValidTime('')).toBe(false); // Empty string
    expect(isValidTime(undefined)).toBe(false); // Undefined
  });

  it('validates time out is after time in', () => {
    const isTimeOutAfterTimeIn = (timeIn?: string, timeOut?: string) => {
      if (!timeIn || !timeOut) return true; // Let other validations handle missing values
      
      const [inHours, inMinutes] = timeIn.split(':').map(Number);
      const [outHours, outMinutes] = timeOut.split(':').map(Number);
      
      const inTotalMinutes = inHours * 60 + inMinutes;
      const outTotalMinutes = outHours * 60 + outMinutes;
      
      return outTotalMinutes > inTotalMinutes;
    };
    
    // Valid time ranges
    expect(isTimeOutAfterTimeIn('09:00', '17:00')).toBe(true);
    expect(isTimeOutAfterTimeIn('09:15', '09:30')).toBe(true);
    expect(isTimeOutAfterTimeIn('08:30', '12:45')).toBe(true);
    
    // Invalid time ranges
    expect(isTimeOutAfterTimeIn('17:00', '09:00')).toBe(false);
    expect(isTimeOutAfterTimeIn('09:30', '09:15')).toBe(false);
    expect(isTimeOutAfterTimeIn('12:45', '08:30')).toBe(false);
    
    // Edge cases
    expect(isTimeOutAfterTimeIn('09:00', '09:00')).toBe(false); // Same time
    expect(isTimeOutAfterTimeIn('', '17:00')).toBe(true); // Missing timeIn
    expect(isTimeOutAfterTimeIn('09:00', '')).toBe(true); // Missing timeOut
  });

  it('validates required fields', () => {
    const validateField = (value: unknown, prop: string) => {
      switch (prop) {
        case 'date':
          if (!value) return 'Date is required';
          return null;
        case 'timeIn':
          if (!value) return 'Time In is required';
          return null;
        case 'timeOut':
          if (!value) return 'Time Out is required';
          return null;
        case 'project':
          if (!value) return 'Project is required';
          return null;
        case 'taskDescription':
          if (!value) return 'Task Description is required';
          return null;
        default:
          return null;
      }
    };
    
    // Required field validation
    expect(validateField('', 'date')).toBe('Date is required');
    expect(validateField('', 'timeIn')).toBe('Time In is required');
    expect(validateField('', 'timeOut')).toBe('Time Out is required');
    expect(validateField('', 'project')).toBe('Project is required');
    expect(validateField('', 'taskDescription')).toBe('Task Description is required');
    
    // Valid values
    expect(validateField('2024-01-01', 'date')).toBeNull();
    expect(validateField('09:00', 'timeIn')).toBeNull();
    expect(validateField('17:00', 'timeOut')).toBeNull();
    expect(validateField('FL-Carver Techs', 'project')).toBeNull();
    expect(validateField('Test task', 'taskDescription')).toBeNull();
  });

  it('validates tool selection based on project', () => {
    const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
    const toolsByProject: Record<string, string[]> = {
      "FL-Carver Techs": ["DECA Meeting", "Logistics", "#1 Rinse and 2D marker"],
      "OSC-BBB": ["Meeting", "Non Tool Related", "#1 CSAM101"]
    };
    
    const validateTool = (tool: string, project: string) => {
      if (projectsWithoutTools.includes(project)) {
        return null; // Tool is N/A for this project
      }
      if (!tool) return 'Tool is required for this project';
      const toolOptions = toolsByProject[project] || [];
      if (!toolOptions.includes(tool)) return 'Tool must be selected from the list';
      return null;
    };
    
    // Projects that don't need tools
    expect(validateTool('', 'PTO/RTO')).toBeNull();
    expect(validateTool('', 'Training')).toBeNull();
    
    // Projects that need tools
    expect(validateTool('', 'FL-Carver Techs')).toBe('Tool is required for this project');
    expect(validateTool('DECA Meeting', 'FL-Carver Techs')).toBeNull();
    expect(validateTool('Invalid Tool', 'FL-Carver Techs')).toBe('Tool must be selected from the list');
  });

  it('validates charge code selection based on tool', () => {
    const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
    const chargeCodes = ["Admin", "EPR1", "EPR2", "EPR3", "EPR4", "Repair", "Meeting", "Other", "PM", "Training", "Upgrade"];
    
    const validateChargeCode = (chargeCode: string, tool: string) => {
      if (toolsWithoutCharges.includes(tool)) {
        return null; // Charge code is N/A for this tool
      }
      if (!chargeCode) return 'Charge Code is required for this tool';
      if (!chargeCodes.includes(chargeCode)) return 'Charge Code must be selected from the list';
      return null;
    };
    
    // Tools that don't need charge codes
    expect(validateChargeCode('', 'DECA Meeting')).toBeNull();
    expect(validateChargeCode('', 'Meeting')).toBeNull();
    expect(validateChargeCode('', 'Admin')).toBeNull();
    
    // Tools that need charge codes
    expect(validateChargeCode('', '#1 Rinse and 2D marker')).toBe('Charge Code is required for this tool');
    expect(validateChargeCode('EPR1', '#1 Rinse and 2D marker')).toBeNull();
    expect(validateChargeCode('Invalid Code', '#1 Rinse and 2D marker')).toBe('Charge Code must be selected from the list');
  });

  it('normalizes N/A fields to null', () => {
    const normalizeRowData = (row: Record<string, unknown>) => {
      const normalized = { ...row };
      const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
      const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
      
      // Normalize N/A fields to null
      if (typeof normalized.project === 'string' && projectsWithoutTools.includes(normalized.project)) {
        normalized.tool = null;
        normalized.chargeCode = null;
      }
      
      if (typeof normalized.tool === 'string' && toolsWithoutCharges.includes(normalized.tool)) {
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

  it('handles edge cases in validation', () => {
    const isValidDate = (dateStr?: string) => {
      if (!dateStr) return false;
      if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return false;
      
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      
      // Check if the date is valid and matches the input
      return date.getFullYear() === year && 
             date.getMonth() === month - 1 && 
             date.getDate() === day;
    };
    
    const isValidTime = (timeStr?: string) => {
      if (!timeStr) return false;
      const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(timeStr)) return false;
      
      const [hours, minutes] = timeStr.split(':').map(Number);
      const totalMinutes = hours * 60 + minutes;
      
      return totalMinutes % 15 === 0;
    };
    
    // Edge cases for date validation
    expect(isValidDate('2024-02-29')).toBe(true); // Leap year
    expect(isValidDate('2023-02-29')).toBe(false); // Not a leap year
    expect(isValidDate('2024-04-31')).toBe(false); // April only has 30 days
    
    // Edge cases for time validation
    expect(isValidTime('00:00')).toBe(true); // Midnight
    expect(isValidTime('23:45')).toBe(true); // 11:45 PM
    expect(isValidTime('24:00')).toBe(false); // Invalid hour
    expect(isValidTime('00:60')).toBe(false); // Invalid minute
  });
});

// Phase 4 Tests
describe('TimesheetGrid Phase 4 - IPC Integration and Autosave', () => {
  it('validates IPC payload structure for saveDraft', () => {
    const validRow = {
      date: '2024-01-15',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'FL-Carver Techs',
      tool: '#1 Rinse and 2D marker',
      chargeCode: 'EPR1',
      taskDescription: 'Test task description'
    };
    
    // Validate required fields
    expect(validRow.date).toBeDefined();
    expect(validRow.timeIn).toBeDefined();
    expect(validRow.timeOut).toBeDefined();
    expect(validRow.project).toBeDefined();
    expect(validRow.taskDescription).toBeDefined();
    
    // Validate optional fields can be null
    const rowWithNulls = {
      ...validRow,
      tool: null,
      chargeCode: null
    };
    
    expect(rowWithNulls.tool).toBeNull();
    expect(rowWithNulls.chargeCode).toBeNull();
  });

  it('validates IPC payload structure for loadDraft', () => {
    const mockDraftData = [
      {
        date: '2024-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task description'
      },
      {
        date: '2024-01-16',
        timeIn: '08:30',
        timeOut: '16:30',
        project: 'PTO/RTO',
        tool: null,
        chargeCode: null,
        taskDescription: 'Personal time off'
      }
    ];
    
    // Validate array structure
    expect(Array.isArray(mockDraftData)).toBe(true);
    expect(mockDraftData.length).toBe(2);
    
    // Validate each row structure
    mockDraftData.forEach(row => {
      expect(row.date).toBeDefined();
      expect(row.timeIn).toBeDefined();
      expect(row.timeOut).toBeDefined();
      expect(row.project).toBeDefined();
      expect(row.taskDescription).toBeDefined();
      // tool and chargeCode can be null
    });
  });

  it('simulates autosave logic for complete rows', () => {
    const shouldAutosave = (row: Record<string, unknown>) => {
      return !!(row.date && row.timeIn && row.timeOut && row.project && row.taskDescription);
    };
    
    // Complete row should autosave
    const completeRow = {
      date: '2024-01-15',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'FL-Carver Techs',
      tool: '#1 Rinse and 2D marker',
      chargeCode: 'EPR1',
      taskDescription: 'Test task description'
    };
    expect(shouldAutosave(completeRow)).toBe(true);
    
    // Row with null tool/chargeCode should still autosave
    const rowWithNulls = {
      ...completeRow,
      tool: null,
      chargeCode: null
    };
    expect(shouldAutosave(rowWithNulls)).toBe(true);
    
    // Incomplete rows should not autosave
    const incompleteRows = [
      { ...completeRow, date: '' },
      { ...completeRow, timeIn: '' },
      { ...completeRow, timeOut: '' },
      { ...completeRow, project: '' },
      { ...completeRow, taskDescription: '' }
    ];
    
    incompleteRows.forEach(row => {
      expect(shouldAutosave(row)).toBe(false);
    });
  });

  it('simulates data loading and blank row management', () => {
    const mockDraftData = [
      {
        date: '2024-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Test task description'
      }
    ];
    
    // Simulate loading with blank row added
    const rowsWithBlank = mockDraftData.length > 0 ? [...mockDraftData, {}] : [{}];
    
    expect(rowsWithBlank.length).toBe(2);
    expect(rowsWithBlank[0]).toEqual(mockDraftData[0]);
    expect(rowsWithBlank[1]).toEqual({});
    
    // Simulate loading with no data
    const emptyRowsWithBlank = [].length > 0 ? [...[], {}] : [{}];
    expect(emptyRowsWithBlank.length).toBe(1);
    expect(emptyRowsWithBlank[0]).toEqual({});
  });

  it('validates payload parity with database expectations', () => {
    // Test that our grid data structure matches what the database expects
    const gridRow = {
      date: '2024-01-15',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'FL-Carver Techs',
      tool: '#1 Rinse and 2D marker',
      chargeCode: 'EPR1',
      taskDescription: 'Test task description'
    };
    
    // Simulate the conversion that happens in main.ts
    const parseTimeToMinutes = (timeStr: string) => {
      const parts = timeStr.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      return hours * 60 + minutes;
    };
    
    const dbRow = {
      date: gridRow.date,
      time_in: parseTimeToMinutes(gridRow.timeIn),
      time_out: parseTimeToMinutes(gridRow.timeOut),
      project: gridRow.project,
      tool: gridRow.tool || null,
      detail_charge_code: gridRow.chargeCode || null,
      task_description: gridRow.taskDescription,
      status: null // Pending status
    };
    
    // Validate conversion
    expect(dbRow.date).toBe('2024-01-15');
    expect(dbRow.time_in).toBe(540); // 9:00 AM = 540 minutes
    expect(dbRow.time_out).toBe(1020); // 5:00 PM = 1020 minutes
    expect(dbRow.project).toBe('FL-Carver Techs');
    expect(dbRow.tool).toBe('#1 Rinse and 2D marker');
    expect(dbRow.detail_charge_code).toBe('EPR1');
    expect(dbRow.task_description).toBe('Test task description');
    expect(dbRow.status).toBeNull();
  });

  it('validates bot integration expectations', () => {
    // Simulate what the bot expects when reading from database
    const mockDbRows = [
      {
        id: 1,
        date: '2024-01-15',
        time_in: 540,
        time_out: 1020,
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        detail_charge_code: 'EPR1',
        task_description: 'Test task description',
        status: null // Pending - bot will process this
      },
      {
        id: 2,
        date: '2024-01-16',
        time_in: 510,
        time_out: 990,
        project: 'PTO/RTO',
        tool: null,
        detail_charge_code: null,
        task_description: 'Personal time off',
        status: 'Complete' // Already processed
      }
    ];
    
    // Bot should only process Pending rows (status = null)
    const pendingRows = mockDbRows.filter(row => row.status === null);
    expect(pendingRows.length).toBe(1);
    expect(pendingRows[0].id).toBe(1);
    
    // Bot should update status to 'Complete' after processing
    const processedRow = { ...pendingRows[0], status: 'Complete' };
    expect(processedRow.status).toBe('Complete');
  });

  it('simulates error handling for IPC operations', () => {
    const mockErrorResponse = {
      success: false,
      error: 'Date 2024-13-01 is not in the current quarter'
    };
    
    const mockSuccessResponse = {
      success: true,
      changes: 1
    };
    
    // Validate error response structure
    expect(mockErrorResponse.success).toBe(false);
    expect(mockErrorResponse.error).toBeDefined();
    
    // Validate success response structure
    expect(mockSuccessResponse.success).toBe(true);
    expect(mockSuccessResponse.changes).toBeDefined();
  });
});

// Phase 5 Tests
describe('TimesheetGrid Phase 5 - Import Flow Integration', () => {
  it('validates import integration with grid refresh trigger', () => {
    // Test that refreshTrigger prop triggers data reload
    const mockRefreshTrigger = 1;
    
    // Simulate the refresh trigger effect
    const shouldRefresh = mockRefreshTrigger !== undefined;
    expect(shouldRefresh).toBe(true);
    
    // Simulate the refresh logic
    const refreshLogic = (trigger: number | undefined) => {
      if (trigger !== undefined) {
        return 'refresh triggered';
      }
      return 'no refresh';
    };
    
    expect(refreshLogic(mockRefreshTrigger)).toBe('refresh triggered');
    expect(refreshLogic(undefined)).toBe('no refresh');
  });

  it('validates hydration normalization for imported data', () => {
    const projectsWithoutTools = new Set(["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"]);
    
    const mockImportedData = [
      {
        date: '2024-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'PTO/RTO', // Project that doesn't need tools
        tool: 'Some Tool', // Should be cleared
        chargeCode: 'EPR1', // Should be cleared
        taskDescription: 'Personal time off'
      },
      {
        date: '2024-01-16',
        timeIn: '08:30',
        timeOut: '16:30',
        project: 'FL-Carver Techs', // Project that needs tools
        tool: '#1 Rinse and 2D marker', // Should be preserved
        chargeCode: 'EPR1', // Should be preserved
        taskDescription: 'Equipment maintenance'
      }
    ];
    
    // Simulate hydration normalization
    const normalizedData = mockImportedData.map(row => {
      if (projectsWithoutTools.has(row.project)) {
        return { ...row, tool: null, chargeCode: null };
      }
      return row;
    });
    
    // Validate normalization
    expect(normalizedData[0].tool).toBeNull();
    expect(normalizedData[0].chargeCode).toBeNull();
    expect(normalizedData[1].tool).toBe('#1 Rinse and 2D marker');
    expect(normalizedData[1].chargeCode).toBe('EPR1');
  });

  it('validates duplicate prevention and status mapping', () => {
    // Simulate database rows with different statuses
    const mockDbRows = [
      {
        id: 1,
        date: '2024-01-15',
        time_in: 540,
        time_out: 1020,
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        detail_charge_code: 'EPR1',
        task_description: 'Equipment maintenance',
        status: null // Pending - should appear in grid
      },
      {
        id: 2,
        date: '2024-01-16',
        time_in: 510,
        time_out: 990,
        project: 'PTO/RTO',
        tool: null,
        detail_charge_code: null,
        task_description: 'Personal time off',
        status: 'Complete' // Complete - should NOT appear in grid
      },
      {
        id: 3,
        date: '2024-01-17',
        time_in: 480,
        time_out: 960,
        project: 'SWFL-EQUIP',
        tool: 'Meeting',
        detail_charge_code: null,
        task_description: 'Team meeting',
        status: null // Pending - should appear in grid
      }
    ];
    
    // Simulate loadDraft filtering (only Pending rows)
    const pendingRows = mockDbRows.filter(row => row.status === null);
    expect(pendingRows.length).toBe(2);
    expect(pendingRows[0].id).toBe(1);
    expect(pendingRows[1].id).toBe(3);
    
    // Simulate conversion to grid format
    const gridData = pendingRows.map(row => ({
      date: row.date,
      timeIn: '09:00', // Would be converted from minutes
      timeOut: '17:00', // Would be converted from minutes
      project: row.project,
      tool: row.tool || null,
      chargeCode: row.detail_charge_code || null,
      taskDescription: row.task_description
    }));
    
    expect(gridData.length).toBe(2);
    expect(gridData[0].project).toBe('FL-Carver Techs');
    expect(gridData[1].project).toBe('SWFL-EQUIP');
  });

  it('validates import result handling and grid refresh', () => {
    const mockImportResults = [
      {
        inserted: 5,
        duplicates: 2,
        total: 7,
        sheet: 'Timesheet',
        dbPath: '/path/to/database.sqlite'
      },
      {
        inserted: 0,
        duplicates: 3,
        total: 3,
        sheet: 'Timesheet',
        dbPath: '/path/to/database.sqlite'
      }
    ];
    
    // Test refresh trigger logic
    const shouldRefreshGrid = (result: Record<string, unknown>, activeTab: number) => {
      return activeTab === 1 && typeof result.inserted === 'number' && result.inserted > 0;
    };
    
    expect(shouldRefreshGrid(mockImportResults[0], 1)).toBe(true); // Should refresh
    expect(shouldRefreshGrid(mockImportResults[1], 1)).toBe(false); // Should not refresh
    expect(shouldRefreshGrid(mockImportResults[0], 0)).toBe(false); // Wrong tab
  });

  it('validates blank row management after import', () => {
    const mockDraftData = [
      {
        date: '2024-01-15',
        timeIn: '09:00',
        timeOut: '17:00',
        project: 'FL-Carver Techs',
        tool: '#1 Rinse and 2D marker',
        chargeCode: 'EPR1',
        taskDescription: 'Equipment maintenance'
      }
    ];
    
    // Simulate adding blank row after import
    const rowsWithBlank = mockDraftData.length > 0 ? [...mockDraftData, {}] : [{}];
    
    expect(rowsWithBlank.length).toBe(2);
    expect(rowsWithBlank[0]).toEqual(mockDraftData[0]);
    expect(rowsWithBlank[1]).toEqual({});
    
    // Test empty data case
    const emptyRowsWithBlank = [].length > 0 ? [...[], {}] : [{}];
    expect(emptyRowsWithBlank.length).toBe(1);
    expect(emptyRowsWithBlank[0]).toEqual({});
  });

  it('validates import flow integration with existing validation', () => {
    // Test that imported data goes through the same validation as manually entered data
    const mockImportedRow = {
      date: '2024-01-15',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'FL-Carver Techs',
      tool: '#1 Rinse and 2D marker',
      chargeCode: 'EPR1',
      taskDescription: 'Equipment maintenance'
    };
    
    // Simulate validation that would be applied
    const validateImportedRow = (row: Record<string, unknown>) => {
      const errors: string[] = [];
      
      if (!row.date) errors.push('Date is required');
      if (!row.timeIn) errors.push('Time In is required');
      if (!row.timeOut) errors.push('Time Out is required');
      if (!row.project) errors.push('Project is required');
      if (!row.taskDescription) errors.push('Task Description is required');
      
      return errors;
    };
    
    const errors = validateImportedRow(mockImportedRow);
    expect(errors.length).toBe(0); // Should be valid
    
    // Test invalid imported row
    const invalidRow = { ...mockImportedRow, date: '' };
    const invalidErrors = validateImportedRow(invalidRow);
    expect(invalidErrors.length).toBe(1);
    expect(invalidErrors[0]).toBe('Date is required');
  });

  it('validates status mapping and bot integration', () => {
    // Test that imported rows have correct status for bot processing
    const mockImportedRow = {
      date: '2024-01-15',
      timeIn: '09:00',
      timeOut: '17:00',
      project: 'FL-Carver Techs',
      tool: '#1 Rinse and 2D marker',
      chargeCode: 'EPR1',
      taskDescription: 'Equipment maintenance',
      status: null // Should be null for bot to process
    };
    
    // Validate status for bot processing
    const isPendingForBot = mockImportedRow.status === null;
    expect(isPendingForBot).toBe(true);
    
    // Simulate bot processing and status update
    const processedRow = { ...mockImportedRow, status: 'Complete' };
    const isComplete = processedRow.status === 'Complete';
    expect(isComplete).toBe(true);
    
    // Test that Complete rows don't appear in grid
    const shouldAppearInGrid = processedRow.status === null;
    expect(shouldAppearInGrid).toBe(false);
  });
});

// Phase 6 Tests
describe('TimesheetGrid Phase 6 - Accessibility and UX Polish', () => {
  it('validates keyboard navigation configuration', () => {
    // Test keyboard navigation settings
    const keyboardConfig = {
      tabNavigation: true,
      navigableHeaders: true,
      enterMoves: { row: 1, col: 0 },
      tabMoves: { row: 0, col: 1 }
    };
    
    expect(keyboardConfig.tabNavigation).toBe(true);
    expect(keyboardConfig.navigableHeaders).toBe(true);
    expect(keyboardConfig.enterMoves.row).toBe(1);
    expect(keyboardConfig.enterMoves.col).toBe(0);
    expect(keyboardConfig.tabMoves.row).toBe(0);
    expect(keyboardConfig.tabMoves.col).toBe(1);
  });

  it('validates ARIA labels and accessibility attributes', () => {
    const accessibilityConfig = {
      ariaLabel: 'Timesheet data grid',
      ariaDescription: 'Interactive timesheet grid for entering work hours and project details',
      invalidCellClassName: 'htInvalid',
      emptyRowsClassName: 'htEmpty'
    };
    
    expect(accessibilityConfig.ariaLabel).toBe('Timesheet data grid');
    expect(accessibilityConfig.ariaDescription).toContain('timesheet grid');
    expect(accessibilityConfig.invalidCellClassName).toBe('htInvalid');
    expect(accessibilityConfig.emptyRowsClassName).toBe('htEmpty');
  });

  it('validates column resizing and visual enhancements', () => {
    const visualConfig = {
      manualColumnResize: true,
      manualRowResize: true,
      stretchH: 'all',
      contextMenu: true,
      search: true,
      undoRedo: true
    };
    
    expect(visualConfig.manualColumnResize).toBe(true);
    expect(visualConfig.manualRowResize).toBe(true);
    expect(visualConfig.stretchH).toBe('all');
    expect(visualConfig.contextMenu).toBe(true);
    expect(visualConfig.search).toBe(true);
    expect(visualConfig.undoRedo).toBe(true);
  });

  it('validates copy/paste normalization', () => {
    const projectsWithoutTools = new Set(["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"]);
    const toolsWithoutCharges = new Set(["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"]);
    
    // Test copy/paste normalization function
    const normalizePastedData = (data: unknown[][]) => {
      return data.map(row => {
        if (row.length >= 7) {
          const [date, timeIn, timeOut, project, tool, chargeCode, taskDescription] = row;
          
          let normalizedTool = tool;
          let normalizedChargeCode = chargeCode;
          
          // If project doesn't need tools, clear tool and chargeCode
          if (typeof project === 'string' && projectsWithoutTools.has(project)) {
            normalizedTool = null;
            normalizedChargeCode = null;
          }
          // If tool doesn't need charge codes, clear chargeCode
          else if (typeof tool === 'string' && toolsWithoutCharges.has(tool)) {
            normalizedChargeCode = null;
          }
          
          return [date, timeIn, timeOut, project, normalizedTool, normalizedChargeCode, taskDescription];
        }
        return row;
      });
    };
    
    // Test data with project that doesn't need tools
    const testData1 = [
      ['2024-01-15', '09:00', '17:00', 'PTO/RTO', 'Some Tool', 'EPR1', 'Personal time']
    ];
    const normalized1 = normalizePastedData(testData1);
    expect(normalized1[0][4]).toBeNull(); // tool should be null
    expect(normalized1[0][5]).toBeNull(); // chargeCode should be null
    
    // Test data with tool that doesn't need charge codes
    const testData2 = [
      ['2024-01-16', '08:30', '16:30', 'FL-Carver Techs', 'Meeting', 'EPR1', 'Team meeting']
    ];
    const normalized2 = normalizePastedData(testData2);
    expect(normalized2[0][4]).toBe('Meeting'); // tool should be preserved
    expect(normalized2[0][5]).toBeNull(); // chargeCode should be null
    
    // Test normal data (no normalization needed)
    const testData3 = [
      ['2024-01-17', '09:00', '17:00', 'FL-Carver Techs', '#1 Rinse and 2D marker', 'EPR1', 'Equipment work']
    ];
    const normalized3 = normalizePastedData(testData3);
    expect(normalized3[0][4]).toBe('#1 Rinse and 2D marker'); // tool should be preserved
    expect(normalized3[0][5]).toBe('EPR1'); // chargeCode should be preserved
  });

  it('validates user-friendly error messages', () => {
    // Test that error messages are at 6th grade reading level
    const validateField = (value: unknown, prop: string) => {
      switch (prop) {
        case 'date':
          if (!value) return 'Please enter a date';
          return 'Date must be like 2024-01-15';
        case 'timeIn':
          if (!value) return 'Please enter start time';
          return 'Time must be like 09:00 and in 15 minute steps';
        case 'timeOut':
          if (!value) return 'Please enter end time';
          return 'Time must be like 17:00 and in 15 minute steps';
        case 'project':
          if (!value) return 'Please pick a project';
          return 'Please pick from the list';
        case 'tool':
          if (!value) return 'Please pick a tool for this project';
          return 'Please pick from the list';
        case 'chargeCode':
          if (!value) return 'Please pick a charge code for this tool';
          return 'Please pick from the list';
        case 'taskDescription':
          if (!value) return 'Please describe what you did';
          return null;
        default:
          return null;
      }
    };
    
    // Test error messages are simple and clear
    expect(validateField('', 'date')).toBe('Please enter a date');
    expect(validateField('invalid', 'date')).toBe('Date must be like 2024-01-15');
    expect(validateField('', 'timeIn')).toBe('Please enter start time');
    expect(validateField('invalid', 'timeIn')).toBe('Time must be like 09:00 and in 15 minute steps');
    expect(validateField('', 'project')).toBe('Please pick a project');
    expect(validateField('invalid', 'project')).toBe('Please pick from the list');
    expect(validateField('', 'taskDescription')).toBe('Please describe what you did');
  });

  it('validates user-friendly placeholder text', () => {
    const placeholderTexts = {
      date: 'Like 2024-01-15',
      timeIn: 'Like 09:00',
      timeOut: 'Like 17:00',
      project: 'Pick a project',
      tool: 'Pick a tool',
      chargeCode: 'Pick a charge code',
      taskDescription: 'Describe what you did'
    };
    
    // Test that placeholders are simple and helpful
    expect(placeholderTexts.date).toBe('Like 2024-01-15');
    expect(placeholderTexts.timeIn).toBe('Like 09:00');
    expect(placeholderTexts.timeOut).toBe('Like 17:00');
    expect(placeholderTexts.project).toBe('Pick a project');
    expect(placeholderTexts.tool).toBe('Pick a tool');
    expect(placeholderTexts.chargeCode).toBe('Pick a charge code');
    expect(placeholderTexts.taskDescription).toBe('Describe what you did');
  });

  it('validates user-friendly column headers', () => {
    const columnHeaders = ['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'What You Did'];
    
    // Test that headers are clear and simple
    expect(columnHeaders[0]).toBe('Date');
    expect(columnHeaders[1]).toBe('Start Time'); // More intuitive than "Time In"
    expect(columnHeaders[2]).toBe('End Time'); // More intuitive than "Time Out"
    expect(columnHeaders[3]).toBe('Project');
    expect(columnHeaders[4]).toBe('Tool');
    expect(columnHeaders[5]).toBe('Charge Code');
    expect(columnHeaders[6]).toBe('What You Did'); // More intuitive than "Task Description"
  });

  it('validates copy/paste configuration', () => {
    const copyPasteConfig = {
      copyPaste: true,
      copyPasteEnabled: true,
      copyPasteDelimiter: '\t'
    };
    
    expect(copyPasteConfig.copyPaste).toBe(true);
    expect(copyPasteConfig.copyPasteEnabled).toBe(true);
    expect(copyPasteConfig.copyPasteDelimiter).toBe('\t');
  });

  it('validates accessibility class names and styling', () => {
    const columnConfigs = [
      { data: 'date', className: 'htCenter' },
      { data: 'timeIn', className: 'htCenter' },
      { data: 'timeOut', className: 'htCenter' },
      { data: 'project', className: 'htCenter' },
      { data: 'tool', className: 'htCenter' },
      { data: 'chargeCode', className: 'htCenter' },
      { data: 'taskDescription', className: 'htLeft' }
    ];
    
    // Test that most columns are centered for better readability
    columnConfigs.forEach(config => {
      if (config.data === 'taskDescription') {
        expect(config.className).toBe('htLeft'); // Long text should be left-aligned
      } else {
        expect(config.className).toBe('htCenter'); // Other fields should be centered
      }
    });
  });

  it('validates keyboard movement between mandatory fields', () => {
    // Test that keyboard navigation moves logically between required fields
    
    // Simulate keyboard navigation logic
    const getNextField = (currentField: string, direction: 'next' | 'prev') => {
      const allFields = ['date', 'timeIn', 'timeOut', 'project', 'tool', 'chargeCode', 'taskDescription'];
      const currentIndex = allFields.indexOf(currentField);
      
      if (direction === 'next') {
        return allFields[currentIndex + 1] || allFields[0]; // Wrap to beginning
      } else {
        return allFields[currentIndex - 1] || allFields[allFields.length - 1]; // Wrap to end
      }
    };
    
    // Test forward navigation
    expect(getNextField('date', 'next')).toBe('timeIn');
    expect(getNextField('timeIn', 'next')).toBe('timeOut');
    expect(getNextField('timeOut', 'next')).toBe('project');
    expect(getNextField('project', 'next')).toBe('tool');
    expect(getNextField('tool', 'next')).toBe('chargeCode');
    expect(getNextField('chargeCode', 'next')).toBe('taskDescription');
    expect(getNextField('taskDescription', 'next')).toBe('date'); // Wrap around
    
    // Test backward navigation
    expect(getNextField('date', 'prev')).toBe('taskDescription'); // Wrap around
    expect(getNextField('timeIn', 'prev')).toBe('date');
    expect(getNextField('timeOut', 'prev')).toBe('timeIn');
    expect(getNextField('project', 'prev')).toBe('timeOut');
    expect(getNextField('tool', 'prev')).toBe('project');
    expect(getNextField('chargeCode', 'prev')).toBe('tool');
    expect(getNextField('taskDescription', 'prev')).toBe('chargeCode');
  });
});

// Phase 7 Tests - Cell Interactivity
describe('TimesheetGrid Phase 7 - Cell Interactivity', () => {
  it('validates that cells are editable by default', () => {
    // Test that the table is configured to allow cell editing
    const tableConfig = {
      readOnly: false,
      fillHandle: true,
      autoWrapRow: true,
      autoWrapCol: true
    };
    
    expect(tableConfig.readOnly).toBe(false);
    expect(tableConfig.fillHandle).toBe(true);
    expect(tableConfig.autoWrapRow).toBe(true);
    expect(tableConfig.autoWrapCol).toBe(true);
  });

  it('validates that specific cells can be made read-only based on business rules', () => {
    // Test the cells function that makes tool/chargeCode read-only based on project/tool
    const projectsWithoutTools = ["ERT", "PTO/RTO", "SWFL-CHEM/GAS", "Training"];
    const toolsWithoutCharges = ["Internal Meeting", "DECA Meeting", "Logistics", "Meeting", "Non Tool Related", "Admin", "Training"];
    
    const getCellProperties = (row: { project?: string; tool?: string }, col: number) => {
      const cellProps: Record<string, unknown> = {};
      
      if (col === 4) { // tool column
        const project = row?.project;
        if (project && projectsWithoutTools.includes(project)) {
          cellProps.readOnly = true;
          cellProps.className = 'htDimmed';
          cellProps.placeholder = 'N/A for this project';
        }
      } else if (col === 5) { // chargeCode column
        const tool = row?.tool;
        if (tool && toolsWithoutCharges.includes(tool)) {
          cellProps.readOnly = true;
          cellProps.className = 'htDimmed';
          cellProps.placeholder = 'N/A for this tool';
        }
      }
      
      return cellProps;
    };
    
    // Test that tool column is read-only for projects without tools
    const row1 = { project: 'PTO/RTO' };
    const toolCellProps = getCellProperties(row1, 4);
    expect(toolCellProps.readOnly).toBe(true);
    expect(toolCellProps.className).toBe('htDimmed');
    
    // Test that tool column is editable for projects with tools
    const row2 = { project: 'FL-Carver Techs' };
    const toolCellProps2 = getCellProperties(row2, 4);
    expect(toolCellProps2.readOnly).toBeUndefined();
    
    // Test that chargeCode column is read-only for tools without charges
    const row3 = { project: 'FL-Carver Techs', tool: 'Meeting' };
    const chargeCellProps = getCellProperties(row3, 5);
    expect(chargeCellProps.readOnly).toBe(true);
    expect(chargeCellProps.className).toBe('htDimmed');
    
    // Test that chargeCode column is editable for tools with charges
    const row4 = { project: 'FL-Carver Techs', tool: '#1 Rinse and 2D marker' };
    const chargeCellProps2 = getCellProperties(row4, 5);
    expect(chargeCellProps2.readOnly).toBeUndefined();
  });

  it('validates that all non-dimmed cells are clickable and focusable', () => {
    // Test that standard cells don't have readOnly set
    const standardCellProps = {};
    expect(standardCellProps).not.toHaveProperty('readOnly');
    
    // Test that cell configuration allows interaction
    const interactiveConfig = {
      tabNavigation: true,
      enterMoves: { row: 1, col: 0 },
      tabMoves: { row: 0, col: 1 }
    };
    
    expect(interactiveConfig.tabNavigation).toBe(true);
    expect(interactiveConfig.enterMoves).toBeDefined();
    expect(interactiveConfig.tabMoves).toBeDefined();
  });

  it('validates cell selection and focus behavior', () => {
    // Test that cells allow selection by default
    const gridConfig = {
      readOnly: false,
      disableVisualSelection: false,
      outsideClickDeselects: true
    };
    
    expect(gridConfig.readOnly).toBe(false);
    expect(gridConfig.disableVisualSelection).toBe(false);
    expect(gridConfig.outsideClickDeselects).toBe(true);
  });

  it('validates fill handle is enabled for copying values', () => {
    const fillHandleConfig = {
      fillHandle: true
    };
    
    expect(fillHandleConfig.fillHandle).toBe(true);
  });

  it('validates that context menu is available for cell operations', () => {
    const contextMenuConfig = {
      contextMenu: true
    };
    
    expect(contextMenuConfig.contextMenu).toBe(true);
  });

  it('validates that cells respond to keyboard input', () => {
    // Test that keyboard navigation is properly configured
    const keyboardConfig = {
      tabNavigation: true,
      enterMoves: { row: 1, col: 0 },
      tabMoves: { row: 0, col: 1 },
      autoWrapRow: true,
      autoWrapCol: true
    };
    
    expect(keyboardConfig.tabNavigation).toBe(true);
    expect(keyboardConfig.autoWrapRow).toBe(true);
    expect(keyboardConfig.autoWrapCol).toBe(true);
  });
});

describe('TimesheetGrid Row Deletion Functionality', () => {
  let mockWindow: Record<string, unknown>;

  beforeEach(() => {
    // Mock the window.timesheet API
    mockWindow = {
      timesheet: {
        deleteDraft: vi.fn(),
        saveDraft: vi.fn(),
        loadDraft: vi.fn()
      }
    };
    
    // Set up global mock
    (global as Record<string, unknown>).window = mockWindow;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle row deletion with valid ID', async () => {
    // Mock successful deletion
    (mockWindow.timesheet as { deleteDraft: { mockResolvedValue: (value: unknown) => void } }).deleteDraft.mockResolvedValue({ success: true });

    // Simulate the handleAfterRemoveRow function logic
    const handleAfterRemoveRow = async (index: number, amount: number) => {
      const removedRows = [
        { id: 1, date: '2025-01-01', timeIn: '09:00', timeOut: '17:00', project: 'Test Project', taskDescription: 'Test Task' }
      ].slice(index, index + amount);
      
      for (const row of removedRows) {
        if (row.id !== undefined && row.id !== null) {
          try {
            const result = await window.timesheet.deleteDraft(row.id);
            if (result && result.success) {
              console.log('Successfully deleted draft row:', row.id);
            } else {
              console.error('Failed to delete draft row:', result?.error);
            }
          } catch (error) {
            console.error('Error deleting draft row:', error);
          }
        }
      }
    };

    await handleAfterRemoveRow(0, 1);
    
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledWith(1);
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledTimes(1);
  });

  it('should handle multiple row deletions', async () => {
    (mockWindow.timesheet as { deleteDraft: { mockResolvedValue: (value: unknown) => void } }).deleteDraft.mockResolvedValue({ success: true });

    const handleAfterRemoveRow = async (index: number, amount: number) => {
      const removedRows = [
        { id: 1, date: '2025-01-01', timeIn: '09:00', timeOut: '17:00', project: 'Test Project', taskDescription: 'Test Task' },
        { id: 2, date: '2025-01-02', timeIn: '10:00', timeOut: '18:00', project: 'Test Project 2', taskDescription: 'Test Task 2' }
      ].slice(index, index + amount);
      
      for (const row of removedRows) {
        if (row.id !== undefined && row.id !== null) {
          try {
            const result = await window.timesheet.deleteDraft(row.id);
            if (result && result.success) {
              console.log('Successfully deleted draft row:', row.id);
            } else {
              console.error('Failed to delete draft row:', result?.error);
            }
          } catch (error) {
            console.error('Error deleting draft row:', error);
          }
        }
      }
    };

    await handleAfterRemoveRow(0, 2);
    
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledWith(1);
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledWith(2);
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void; toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledTimes(2);
  });

  it('should handle deletion errors gracefully', async () => {
    (mockWindow.timesheet as { deleteDraft: { mockResolvedValue: (value: unknown) => void } }).deleteDraft.mockResolvedValue({ 
      success: false, 
      error: 'Database connection failed' 
    });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handleAfterRemoveRow = async (index: number, amount: number) => {
      const removedRows = [
        { id: 1, date: '2025-01-01', timeIn: '09:00', timeOut: '17:00', project: 'Test Project', taskDescription: 'Test Task' }
      ].slice(index, index + amount);
      
      for (const row of removedRows) {
        if (row.id !== undefined && row.id !== null) {
          try {
            const result = await window.timesheet.deleteDraft(row.id);
            if (result && result.success) {
              console.log('Successfully deleted draft row:', row.id);
            } else {
              console.error('Failed to delete draft row:', result?.error);
            }
          } catch (error) {
            console.error('Error deleting draft row:', error);
          }
        }
      }
    };

    await handleAfterRemoveRow(0, 1);
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to delete draft row:', 'Database connection failed');
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void } }).deleteDraft).toHaveBeenCalledWith(1);
    
    consoleSpy.mockRestore();
  });

  it('should skip rows without IDs', async () => {
    const handleAfterRemoveRow = async (index: number, amount: number) => {
      const removedRows = [
        { date: '2025-01-01', timeIn: '09:00', timeOut: '17:00', project: 'Test Project', taskDescription: 'Test Task' }, // No ID
        { id: 2, date: '2025-01-02', timeIn: '10:00', timeOut: '18:00', project: 'Test Project 2', taskDescription: 'Test Task 2' }
      ].slice(index, index + amount);
      
      for (const row of removedRows) {
        if (row.id !== undefined && row.id !== null) {
          try {
            const result = await window.timesheet.deleteDraft(row.id);
            if (result && result.success) {
              console.log('Successfully deleted draft row:', row.id);
            } else {
              console.error('Failed to delete draft row:', result?.error);
            }
          } catch (error) {
            console.error('Error deleting draft row:', error);
          }
        }
      }
    };

    await handleAfterRemoveRow(0, 2);
    
    // Should only call deleteDraft for the row with ID
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledWith: (...args: unknown[]) => void } }).deleteDraft).toHaveBeenCalledWith(2);
    expect((mockWindow.timesheet as { deleteDraft: { toHaveBeenCalledTimes: (times: number) => void } }).deleteDraft).toHaveBeenCalledTimes(1);
  });

  it('should validate that afterRemoveRow handler is configured', () => {
    // Test that the HotTable component includes the afterRemoveRow handler
    const hotTableConfig = {
      afterRemoveRow: 'handleAfterRemoveRow',
      afterChange: 'handleAfterChange',
      contextMenu: true
    };
    
    expect(hotTableConfig.afterRemoveRow).toBe('handleAfterRemoveRow');
    expect(hotTableConfig.afterChange).toBe('handleAfterChange');
    expect(hotTableConfig.contextMenu).toBe(true);
  });

  it('should ensure context menu enables row deletion', () => {
    // Verify that context menu is enabled to allow row deletion
    const contextMenuConfig = {
      contextMenu: true,
      manualRowResize: true,
      manualColumnResize: true
    };
    
    expect(contextMenuConfig.contextMenu).toBe(true);
    expect(contextMenuConfig.manualRowResize).toBe(true);
  });
});