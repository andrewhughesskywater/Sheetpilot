export function clearInvalidIfPresent(
  hotInstance: { getCellMeta: (row: number, col: number) => { className?: string | string[] }; setCellMeta: (row: number, col: number, key: string, value: unknown) => void },
  row: number,
  col: number
): void {
  const rawClass = hotInstance.getCellMeta(row, col).className;
  const currentClass = Array.isArray(rawClass) ? rawClass.join(' ') : (rawClass || '');
  if (currentClass.includes('htInvalid')) {
    hotInstance.setCellMeta(row, col, 'className', currentClass.replace('htInvalid', '').trim());
  }
}
