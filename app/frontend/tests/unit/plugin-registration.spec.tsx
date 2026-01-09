import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginRegistry } from '@sheetpilot/shared/plugin-registry';
import { TIMESHEET_PLUGIN_NAMESPACES } from '@sheetpilot/shared/plugin-types';

describe('Frontend Plugin Registration', () => {
  beforeEach(() => {
    // Reset the plugin registry singleton before each test
    PluginRegistry.resetInstance();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should register plugins in browser environment without process.env errors', async () => {
    // Import after setup to ensure clean state
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    // Should not throw an error about process being undefined
    await expect(registerDefaultFrontendPlugins()).resolves.not.toThrow();
  });

  it('should successfully register UI plugin', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const uiPlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    expect(uiPlugin).toBeDefined();
    expect(uiPlugin).not.toBeNull();
  });

  it('should register HandsontableTimesheetUIPlugin with correct methods', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const uiPlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    expect(uiPlugin).toHaveProperty('buildColumns');
    expect(uiPlugin).toHaveProperty('buildCellsMeta');
    expect(uiPlugin).toHaveProperty('metadata');
    expect(typeof uiPlugin?.buildColumns).toBe('function');
    expect(typeof uiPlugin?.buildCellsMeta).toBe('function');
  });

  it('should set active UI plugin to handsontable by default', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const activePlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    expect(activePlugin).toBeDefined();
    expect(activePlugin?.metadata?.name).toBe('handsontable-timesheet-ui');
  });

  it('should build columns with proper structure', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const uiPlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    const columns = uiPlugin?.buildColumns?.([]);

    expect(columns).toBeDefined();
    expect(Array.isArray(columns)).toBe(true);
    expect(columns).toHaveLength(7);

    // Verify each column has required properties
    const expectedColumns = ['date', 'timeIn', 'timeOut', 'project', 'tool', 'chargeCode', 'taskDescription'];
    columns?.forEach((col: any, index: number) => {
      expect(col).toHaveProperty('data', expectedColumns[index]);
      expect(col).toHaveProperty('type');
      expect(col).toHaveProperty('title');
      expect(col).toHaveProperty('placeholder');
    });
  });

  it('should include column headers in buildColumns output', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const uiPlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    const columns = uiPlugin?.buildColumns?.([]);

    const headers = columns?.map((col: any) => col.title);
    expect(headers).toEqual(['Date', 'Start Time', 'End Time', 'Project', 'Tool', 'Charge Code', 'What You Did']);
  });

  it('should include placeholders in buildColumns output', async () => {
    const { registerDefaultFrontendPlugins } = await import('../../src/plugins/register-default-plugins');

    await registerDefaultFrontendPlugins();

    const registry = PluginRegistry.getInstance();
    const uiPlugin = registry.getPlugin(TIMESHEET_PLUGIN_NAMESPACES.ui);

    const columns = uiPlugin?.buildColumns?.([]);

    columns?.forEach((col: any) => {
      expect(col).toHaveProperty('placeholder');
      expect(typeof col.placeholder).toBe('string');
      expect(col.placeholder.length).toBeGreaterThan(0);
    });
  });
});
