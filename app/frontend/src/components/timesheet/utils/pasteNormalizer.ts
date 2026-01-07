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

function mapPastedRow(rawData: unknown[], columnCount: number): Partial<TimesheetRow> {
  const result: Partial<TimesheetRow> = { id: uuidv4() };

  if (columnCount >= 1) result.date = String(rawData[0] ?? '').trim();
  if (columnCount >= 2) result.timeIn = String(rawData[1] ?? '').trim();
  if (columnCount >= 3) result.timeOut = String(rawData[2] ?? '').trim();
  if (columnCount >= 4) result.project = String(rawData[3] ?? '').trim();
  if (columnCount >= 5) result.tool = String(rawData[4] ?? '').trim() || undefined;
  if (columnCount >= 6) result.chargeCode = String(rawData[5] ?? '').trim() || undefined;
  if (columnCount >= 7) result.taskDescription = String(rawData[6] ?? '').trim();

  return result;
}

export function normalizePastedRows(pastedData: unknown[][], existingRows: TimesheetRow[]): TimesheetRow[] {
  if (!pastedData || pastedData.length === 0) return existingRows;

  const metadata = detectPasteMetadata(pastedData);
  const startIdx = metadata.hasHeaders ? 1 : 0;
  const normalized: TimesheetRow[] = [];

  for (let i = startIdx; i < pastedData.length; i++) {
    const raw = pastedData[i];
    if (!Array.isArray(raw) || raw.length === 0) continue;

    const partial = mapPastedRow(raw, metadata.columnCount);
    if (!partial.date && !partial.timeIn && !partial.timeOut) continue; // Skip empty rows

    const row: TimesheetRow = {
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

    normalized.push(row);
  }

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
