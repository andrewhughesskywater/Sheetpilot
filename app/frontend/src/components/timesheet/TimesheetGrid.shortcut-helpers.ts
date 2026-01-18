/**
 * Helper functions for TimesheetGrid keyboard shortcuts
 */

import type { HotTableRef } from "@handsontable/react-wrapper";

type GridContext = NonNullable<ReturnType<NonNullable<ReturnType<NonNullable<HotTableRef["hotInstance"]>["getShortcutManager"]>>["getContext"]>>;

/**
 * Get and validate grid context for shortcuts
 */
export function getGridContextForShortcuts(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>
): GridContext | null {
  const shortcutManager = hotInstance.getShortcutManager();
  if (!shortcutManager) {
    window.logger?.warn("Could not get shortcut manager");
    return null;
  }

  const gridContext = shortcutManager.getContext("grid");
  if (!gridContext) {
    window.logger?.warn("Could not get grid context for shortcuts");
    return null;
  }

  return gridContext;
}

/**
 * Register all macro shortcuts (Ctrl+1-5)
 */
export function registerMacroShortcuts(
  gridContext: GridContext,
  hotInstance: NonNullable<HotTableRef["hotInstance"]>,
  applyMacro: (index: number) => void
): void {
  // Register macro shortcuts (Ctrl+1-5)
  // When keyboard shortcut fires, ensure grid has focus so selection is detected correctly
  // Note: Handsontable uses KeyboardEvent.key values, so use 'Control' not 'Ctrl'
  for (let i = 1; i <= 5; i++) {
    const macroIndex = i - 1;
    // Use 'Control' for Ctrl key (Handsontable uses KeyboardEvent.key values)
    const shortcutKeys = [["Control", i.toString()]];
    
    try {
      const callback = createMacroShortcutCallback(hotInstance, applyMacro, macroIndex, i);
      gridContext.addShortcut({
        keys: shortcutKeys,
        preventDefault: true, // Prevent browser default behavior (e.g., switching tabs)
        callback,
        group: "timesheet-macros",
      });
      window.logger?.verbose("Registered macro shortcut", { shortcut: `Ctrl+${i}` });
    } catch (error) {
      window.logger?.error("Could not register macro shortcut", {
        shortcut: `Ctrl+${i}`,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

/**
 * Create callback for macro keyboard shortcut (Ctrl+1-5)
 */
export function createMacroShortcutCallback(
  hotInstance: NonNullable<HotTableRef["hotInstance"]>,
  applyMacro: (index: number) => void,
  macroIndex: number,
  shortcutNumber: number
): () => void {
  return () => {
    window.logger?.info("Macro keyboard shortcut triggered", { 
      shortcut: `Ctrl+${shortcutNumber}`, 
      macroIndex 
    });
    
    // Check if we can get selection immediately
    const immediateSelection = hotInstance.getSelected();
    if (immediateSelection && immediateSelection.length > 0) {
      // Selection exists, apply macro immediately
      applyMacro(macroIndex);
      return;
    }
    
    // No immediate selection found - this can happen when:
    // 1. Grid doesn't have focus
    // 2. Selection hasn't been updated yet by Handsontable
    // 3. User hasn't clicked on a cell yet
    
    // Try to focus the grid's table element (this tracks selection in Handsontable)
    const gridContainer = hotInstance.rootElement;
    if (gridContainer) {
      // Try to find and focus the table element
      const tableElement = gridContainer.querySelector('table.htCore') as HTMLTableElement;
      if (tableElement && typeof tableElement.focus === 'function') {
        tableElement.focus();
      }
    }
    
    // Use a small delay to let Handsontable process focus and update selection state
    // This is necessary because selection might not be immediately available
    setTimeout(() => {
      applyMacro(macroIndex);
    }, 0);
  };
}
