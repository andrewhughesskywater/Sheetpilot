/**
 * @fileoverview Timesheet Grid Contract
 * 
 * Defines the interface for timesheet grid implementations.
 * Any grid implementation (Handsontable, AG Grid, HTML table, etc.) must provide this interface.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { ReactElement } from 'react';
import type { TimesheetRow } from '../business-logic/timesheet-validation';
import type { IPlugin } from '../../shared/plugin-types';

/**
 * Validation result for a timesheet entry
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Grid event handlers
 */
export interface GridEventHandlers {
  onDataChange?: (rows: TimesheetRow[]) => void;
  onSubmit?: () => Promise<void>;
  onRowAdded?: (row: TimesheetRow) => void;
  onRowRemoved?: (rowIndex: number) => void;
  onCellValueChanged?: (rowIndex: number, columnKey: string, newValue: unknown, oldValue: unknown) => void;
}

/**
 * Grid options for configuration
 */
export interface GridOptions {
  /** Grid data */
  data: TimesheetRow[];
  /** Is grid in loading state */
  isLoading?: boolean;
  /** Is grid in read-only mode */
  readOnly?: boolean;
  /** Show row numbers */
  showRowNumbers?: boolean;
  /** Enable sorting */
  enableSorting?: boolean;
  /** Enable column resizing */
  enableColumnResize?: boolean;
  /** Enable row resizing */
  enableRowResize?: boolean;
  /** Event handlers */
  handlers?: GridEventHandlers;
}

/**
 * Timesheet grid interface
 * Implementations must provide a way to render and interact with timesheet data
 */
export interface ITimesheetGrid extends IPlugin {
  /**
   * Render the grid as a React component
   * @param options Grid options
   * @returns React element
   */
  render(options: GridOptions): ReactElement;

  /**
   * Validate a timesheet row
   * @param row Row to validate
   * @returns Validation result
   */
  validate(row: TimesheetRow): ValidationResult;

  /**
   * Get current grid data
   * @returns Current grid data
   */
  getData?(): TimesheetRow[];

  /**
   * Set grid data
   * @param data New grid data
   */
  setData?(data: TimesheetRow[]): void;
}

