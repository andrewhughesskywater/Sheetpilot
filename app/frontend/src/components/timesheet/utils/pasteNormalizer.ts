import { v4 as uuidv4 } from 'uuid';
import type { TimesheetRow } from '../timesheet.schema';

interface PasteMetadata {
  rowCount: number;
  columnCount: number;
  hasHeaders: boolean;
}

function detectPasteMetadata(pastedData: unknown[][]): PasteMetadata {
  const rowCount = pastedData.length;
  const columnCount = pastedData[0]?.length ?? 0;

  const headers = ['date', 'timeIn', 'timeOut', 'project', 'tool', 'chargeCode', 'task'];
  const firstRow = pastedData[0];
  const hasHeaders =
    firstRow &&
    firstRow.length > 0 &&
    firstRow.some((cell) => headers.some((h) => String(cell).toLowerCase().includes(h.toLowerCase())));

  return { rowCount, columnCount, hasHeaders };
}

function mapFieldValue(rawData: unknown[], index: number, columnCount: number): string | undefined {
  if (columnCount <= index) return undefined;
  const value = String(rawData[index] ?? '').trim();
  return value || undefined;
}

function mapPastedRow(rawData: unknown[], columnCount: number): Partial<TimesheetRow> {
  const result: Partial<TimesheetRow> = { id: uuidv4() };

  const date = mapFieldValue(rawData, 0, columnCount);
  if (date) result.date = date;
  
  const timeIn = mapFieldValue(rawData, 1, columnCount);
  if (timeIn) result.timeIn = timeIn;
  
  const timeOut = mapFieldValue(rawData, 2, columnCount);
  if (timeOut) result.timeOut = timeOut;
  
  const project = mapFieldValue(rawData, 3, columnCount);
  if (project) result.project = project;
  
  result.tool = mapFieldValue(rawData, 4, columnCount);
  result.chargeCode = mapFieldValue(rawData, 5, columnCount);
  
  const taskDescription = mapFieldValue(rawData, 6, columnCount);
  if (taskDescription) result.taskDescription = taskDescription;

  return result;
}

function isRowEmpty(partial: Partial<TimesheetRow>): boolean {
  return !partial.date && !partial.timeIn && !partial.timeOut;
}

function createTimesheetRow(partial: Partial<TimesheetRow>): TimesheetRow {
  return {
    id: partial.id || uuidv4(),
    date: partial.date || '',
    timeIn: partial.timeIn || '',
    timeOut: partial.timeOut || '',
    project: partial.project || '',
    tool: partial.tool,
    chargeCode: partial.chargeCode,
    taskDescription: partial.taskDescription || '',
    receipt: undefined,
    submitted: false,
    receiptVerificationRequired: false
  };
}

function processPastedRows(pastedData: unknown[][], metadata: PasteMetadata): TimesheetRow[] {
  const startIdx = metadata.hasHeaders ? 1 : 0;
  const normalized: TimesheetRow[] = [];

  for (let i = startIdx; i < pastedData.length; i++) {
    const raw = pastedData[i];
    if (!Array.isArray(raw) || raw.length === 0) continue;

    const partial = mapPastedRow(raw, metadata.columnCount);
    if (isRowEmpty(partial)) continue;

    normalized.push(createTimesheetRow(partial));
  }

  return normalized;
}

export function normalizePastedRows(pastedData: unknown[][], existingRows: TimesheetRow[]): TimesheetRow[] {
  if (!pastedData || pastedData.length === 0) return existingRows;

  const metadata = detectPasteMetadata(pastedData);
  const normalized = processPastedRows(pastedData, metadata);

  return [...existingRows, ...normalized];
}

export function validatePastedData(
  pastedData: unknown[][]
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Array.isArray(pastedData) || pastedData.length === 0) {
    errors.push('Pasted data is empty');
  }

  const metadata = detectPasteMetadata(pastedData);
  if (metadata.columnCount === 0) {
    errors.push('Pasted data has no columns');
  }

  if (metadata.columnCount > 7) {
    window.logger?.warn('Pasted data has more than 7 columns; extra columns will be ignored', {
      columnCount: metadata.columnCount
    });
  }

  return { isValid: errors.length === 0, errors };
}
