import type { HotTableRef } from '@handsontable/react-wrapper';
import type { RefObject } from 'react';
import { useCallback } from 'react';

import type { TimesheetRow } from '../timesheet.schema';
import { normalizePastedRows, validatePastedData } from '../utils/pasteNormalizer';

export function usePasteHandler() {
  const setTempDropdownValue = useCallback(
    (hotRef: RefObject<HotTableRef | null>, rowIdx: number, columnIndex: number, value: string | undefined): void => {
      if (!value) return;

      const hotInstance = hotRef.current?.hotInstance;
      if (!hotInstance) return;

      hotInstance.setDataAtCell(rowIdx, columnIndex, value);
    },
    []
  );

  interface ApplyPastedToolAndChargeCodeConfig {
    timesheetDraftData: TimesheetRow[];
    startRowIdx: number;
    pastedRowCount: number;
    hotRef: RefObject<HotTableRef | null>;
    getChargeCodesForProject?: (project: string, tool: string) => string[];
  }

  const applyPastedToolAndChargeCode = useCallback(
    (config: ApplyPastedToolAndChargeCodeConfig): void => {
      const { timesheetDraftData, startRowIdx, pastedRowCount, hotRef, getChargeCodesForProject } = config;
      for (let i = 0; i < pastedRowCount; i++) {
        const rowIdx = startRowIdx + i;
        const row = timesheetDraftData[rowIdx];

        if (!row) continue;

        // Apply tool from project defaults if not specified
        if (!row.tool && row.project) {
          const defaultTool = row.project; // Placeholder for actual logic
          setTempDropdownValue(hotRef, rowIdx, 4, defaultTool);
          row.tool = defaultTool;
        }

        // Apply charge code from project + tool defaults if not specified
        if (!row.chargeCode && row.project && row.tool && getChargeCodesForProject) {
          const codes = getChargeCodesForProject(row.project, row.tool);
          if (codes.length > 0) {
            setTempDropdownValue(hotRef, rowIdx, 5, codes[0]);
            row.chargeCode = codes[0];
          }
        }
      }
    },
    [setTempDropdownValue]
  );

  interface HandlePasteConfig {
    pastedData: unknown[][];
    timesheetDraftData: TimesheetRow[];
    setTimesheetDraftData: (rows: TimesheetRow[]) => void;
    hotRef: RefObject<HotTableRef | null>;
    getChargeCodesForProject?: (project: string, tool: string) => string[];
    onChange?: (rows: TimesheetRow[]) => void;
  }

  const handlePaste = useCallback(
    (config: HandlePasteConfig): boolean => {
      const { pastedData, timesheetDraftData, setTimesheetDraftData, hotRef, getChargeCodesForProject, onChange } =
        config;
      const validation = validatePastedData(pastedData);
      if (!validation.isValid) {
        window.logger?.warn('Invalid paste data', { errors: validation.errors });
        return false;
      }

      try {
        const normalizedRows = normalizePastedRows(pastedData, timesheetDraftData);
        const pastedRowCount = pastedData.length;

        setTimesheetDraftData(normalizedRows);
        onChange?.(normalizedRows);

        // Apply defaults to pasted rows
        applyPastedToolAndChargeCode({
          timesheetDraftData: normalizedRows,
          startRowIdx: timesheetDraftData.length,
          pastedRowCount,
          hotRef,
          getChargeCodesForProject,
        });

        window.logger?.info('Paste data applied successfully', { rowCount: pastedRowCount });
        return true;
      } catch (error) {
        window.logger?.error('Error applying paste data', {
          error: error instanceof Error ? error.message : String(error),
        });
        return false;
      }
    },
    [applyPastedToolAndChargeCode]
  );

  return {
    handlePaste,
    applyPastedToolAndChargeCode,
    setTempDropdownValue,
  };
}
