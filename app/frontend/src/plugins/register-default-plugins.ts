import { PluginRegistry } from '@sheetpilot/shared/plugin-registry';
import { loadPluginConfig, resolvePluginVariant } from '@sheetpilot/shared/plugin-config';
import { TIMESHEET_PLUGIN_NAMESPACES } from '@sheetpilot/shared/plugin-types';
import { HandsontableTimesheetUIPlugin } from './timesheet-ui-handsontable';
import { BasicTimesheetValidationPlugin } from './timesheet-validation-basic';

/**
 * Register frontend (renderer) default plugins and load config.
 */
export async function registerDefaultFrontendPlugins(): Promise<void> {
  const registry = PluginRegistry.getInstance();

  // Load config (renderer pathless variant)
  const config = loadPluginConfig();
  registry.loadConfig(config);

  // Register Timesheet UI plugins
  await registry.registerPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui, 'handsontable', new HandsontableTimesheetUIPlugin());

  // Register Timesheet Validation plugins
  await registry.registerPlugin(TIMESHEET_PLUGIN_NAMESPACES.validation, 'basic', new BasicTimesheetValidationPlugin());

  // Ensure active plugin names are set from flags/config
  const uiVariant = resolvePluginVariant(TIMESHEET_PLUGIN_NAMESPACES.ui, config);
  try {
    registry.setActivePlugin(TIMESHEET_PLUGIN_NAMESPACES.ui, uiVariant);
  } catch {
    // Fallback to handsontable if variant missing
    registry.setActivePlugin(TIMESHEET_PLUGIN_NAMESPACES.ui, 'handsontable');
  }

  const validationVariant = resolvePluginVariant(TIMESHEET_PLUGIN_NAMESPACES.validation, config);
  try {
    registry.setActivePlugin(TIMESHEET_PLUGIN_NAMESPACES.validation, validationVariant);
  } catch {
    registry.setActivePlugin(TIMESHEET_PLUGIN_NAMESPACES.validation, 'basic');
  }
}
