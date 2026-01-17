/**
 * Cell value application utilities for paste operations
 *
 * Handles applying tool and charge code values with temporary validation relaxation.
 */

/**
 * Apply tool value with temporary validation relaxation
 */
export function applyToolValue(
  hotInstance: {
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
    setDataAtCell: (
      row: number,
      col: number,
      value: unknown,
      source?: string
    ) => void;
  },
  targetRow: number,
  toolCol: number | unknown,
  tool: unknown,
  startCol: number
): void {
  if (
    startCol <= 3 &&
    tool !== undefined &&
    tool !== null &&
    tool !== "" &&
    typeof toolCol === "number" &&
    toolCol >= 0
  ) {
    hotInstance.setCellMeta(targetRow, toolCol, "allowInvalid", true);
    hotInstance.setCellMeta(targetRow, toolCol, "strict", false);
    hotInstance.setDataAtCell(targetRow, toolCol, tool, "paste");
    setTimeout(() => {
      hotInstance.setCellMeta(targetRow, toolCol, "allowInvalid", false);
      hotInstance.setCellMeta(targetRow, toolCol, "strict", true);
    }, 10);
  }
}

/**
 * Apply charge code value with temporary validation relaxation
 */
export function applyChargeCodeValue(
  hotInstance: {
    setCellMeta: (
      row: number,
      col: number,
      key: string,
      value: unknown
    ) => void;
    setDataAtCell: (
      row: number,
      col: number,
      value: unknown,
      source?: string
    ) => void;
  },
  targetRow: number,
  chargeCodeCol: number | unknown,
  chargeCode: unknown,
  startCol: number
): void {
  if (
    startCol <= 4 &&
    chargeCode !== undefined &&
    chargeCode !== null &&
    chargeCode !== "" &&
    typeof chargeCodeCol === "number" &&
    chargeCodeCol >= 0
  ) {
    hotInstance.setCellMeta(targetRow, chargeCodeCol, "allowInvalid", true);
    hotInstance.setCellMeta(targetRow, chargeCodeCol, "strict", false);
    hotInstance.setDataAtCell(targetRow, chargeCodeCol, chargeCode, "paste");
    setTimeout(() => {
      hotInstance.setCellMeta(targetRow, chargeCodeCol, "allowInvalid", false);
      hotInstance.setCellMeta(targetRow, chargeCodeCol, "strict", true);
    }, 10);
  }
}

/**
 * Update tool value in Handsontable
 */
export function updateToolInHot(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setDataAtCell: (
      row: number,
      col: number,
      value: unknown,
      source?: string
    ) => void;
  },
  rowIdx: number,
  tool: string | null
): void {
  const toolCol = hotInstance.propToCol("tool");
  if (typeof toolCol === "number" && toolCol >= 0) {
    hotInstance.setDataAtCell(rowIdx, toolCol, tool, "paste");
  }
}

/**
 * Update charge code value in Handsontable
 */
export function updateChargeCodeInHot(
  hotInstance: {
    propToCol: (prop: string) => number | unknown;
    setDataAtCell: (
      row: number,
      col: number,
      value: unknown,
      source?: string
    ) => void;
  },
  rowIdx: number,
  chargeCode: string | null
): void {
  const chargeCodeCol = hotInstance.propToCol("chargeCode");
  if (typeof chargeCodeCol === "number" && chargeCodeCol >= 0) {
    hotInstance.setDataAtCell(rowIdx, chargeCodeCol, chargeCode, "paste");
  }
}
