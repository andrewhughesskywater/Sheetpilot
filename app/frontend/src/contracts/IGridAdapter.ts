/**
 * @fileoverview Grid Adapter Contract
 * 
 * Adapter pattern for different grid library implementations.
 * Provides a common interface for grid library operations.
 * 
 * @author Andrew Hughes
 * @version 1.0.0
 * @since 2025
 */

import type { TimesheetRow } from '../../../backend/src/business-logic/timesheet-validation';

/**
 * Column definition for grid
 */
export interface GridColumnDef {
  /** Column data key */
  data: string;
  /** Column header title */
  title: string;
  /** Column type (text, date, dropdown, etc.) */
  type?: string;
  /** Column width */
  width?: number;
  /** Column source for dropdowns */
  source?: string[];
  /** Is column read-only */
  readOnly?: boolean;
  /** Column placeholder text */
  placeholder?: string;
  /** Column class name */
  className?: string;
  /** Is column strict (must match source) */
  strict?: boolean;
  /** Allow invalid values */
  allowInvalid?: boolean;
}

/**
 * Grid configuration options
 */
export interface GridAdapterOptions {
  /** Column definitions */
  columns: GridColumnDef[];
  /** Initial data */
  data: TimesheetRow[];
  /** Grid width */
  width?: string | number;
  /** Grid height */
  height?: string | number;
  /** Enable row headers */
  rowHeaders?: boolean;
  /** Enable column headers */
  colHeaders?: boolean;
  /** Enable sorting */
  columnSorting?: boolean;
  /** Enable column resizing */
  manualColumnResize?: boolean;
  /** Enable row resizing */
  manualRowResize?: boolean;
  /** Read-only mode */
  readOnly?: boolean;
  /** License key (if needed) */
  licenseKey?: string;
}

/**
 * Event callback types
 */
export type AfterChangeCallback = (changes: unknown[][], source: string) => void;
export type BeforeValidateCallback = (value: unknown, row: number, prop: string | number) => string | unknown;
export type AfterValidateCallback = (isValid: boolean, value: unknown, row: number, prop: string | number) => boolean;
export type AfterRemoveRowCallback = (index: number, amount: number) => void;
export type BeforePasteCallback = (data: unknown[][]) => boolean;

/**
 * Grid adapter interface
 * Wraps different grid library implementations with a common interface
 */
export interface IGridAdapter {
  /**
   * Initialize the grid adapter with a container element
   * @param container HTML element to attach grid to
   * @param options Grid configuration options
   */
  initialize(container: HTMLElement, options: GridAdapterOptions): void;

  /**
   * Set grid data
   * @param data New grid data
   */
  setData(data: TimesheetRow[]): void;

  /**
   * Get current grid data
   * @returns Current grid data
   */
  getData(): TimesheetRow[];

  /**
   * Update grid data while preserving state (selection, scroll position)
   * @param data New grid data
   */
  updateData?(data: TimesheetRow[]): void;

  /**
   * Register event handlers
   */
  on?(event: 'afterChange', callback: AfterChangeCallback): void;
  on?(event: 'beforeValidate', callback: BeforeValidateCallback): void;
  on?(event: 'afterValidate', callback: AfterValidateCallback): void;
  on?(event: 'afterRemoveRow', callback: AfterRemoveRowCallback): void;
  on?(event: 'beforePaste', callback: BeforePasteCallback): void;

  /**
   * Render or re-render the grid
   */
  render?(): void;

  /**
   * Destroy the grid and clean up resources
   */
  destroy(): void;

  /**
   * Get the underlying grid instance (library-specific)
   */
  getInstance?(): unknown;
}

