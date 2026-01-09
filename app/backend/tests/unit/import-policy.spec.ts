import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Import policy - late import of logger and runtime deps', () => {
  it('main.ts must not statically import ../../shared/logger at top-level', () => {
    const mainPath = path.resolve(__dirname, '../../src/main.ts');
    const content = fs.readFileSync(mainPath, 'utf8');
    // Disallow top-level ESM import of shared/logger
    expect(content.includes("from '../../shared/logger'")).toBe(false);
  });

  it('preflight should exist to resolve critical modules', () => {
    const mainPath = path.resolve(__dirname, '../../src/main.ts');
    const content = fs.readFileSync(mainPath, 'utf8');
    // The project moved preflight logic into a dedicated module to keep main.ts thin.
    // Assert that main.ts still runs the preflight, and that the module list remains present.
    expect(content.includes('preflightResolveCriticalModules(')).toBe(true);

    const preflightPath = path.resolve(__dirname, '../../src/bootstrap/preflight/resolve-critical-modules.ts');
    const preflightContent = fs.readFileSync(preflightPath, 'utf8');
    expect(preflightContent.includes("['electron-log', 'electron-updater', 'better-sqlite3']")).toBe(true);
  });
});
