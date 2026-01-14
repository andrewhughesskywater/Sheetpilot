/**
 * Column definitions for timesheet grid
 * 
 * Column configuration for Handsontable timesheet grid.
 * NO validators (validation happens in afterChange to prevent editor blocking)
 * CRITICAL: ID column must be first and hidden - this is the "Golden Rule" for Handsontable-SQL sync
 */

import { PROJECTS, CHARGE_CODES } from '@sheetpilot/shared/business-config';

/**
 * Get column definitions for timesheet grid
 * 
 * @returns Array of column definition objects
 */
export function getColumnDefinitions() {
  return [
    { data: 'id', title: 'ID', type: 'numeric', width: 0.1, readOnly: true }, // Hidden ID column for row identity
    { data: 'date', title: 'Date', type: 'date', dateFormat: 'MM/DD/YYYY', placeholder: 'MM/DD/YYYY', className: 'htCenter' },
    { data: 'timeIn', title: 'Start Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
    { data: 'timeOut', title: 'End Time', type: 'text', placeholder: '0000 to 2400', className: 'htCenter' },
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
    { data: 'taskDescription', title: 'Task Description', editor: 'spellcheckText', placeholder: '', className: 'htLeft', maxLength: 120 }
  ];
}
