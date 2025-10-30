import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Import policy - late import of logger and runtime deps', () => {
  it('main.ts must not statically import ../../shared/logger at top-level', () => {
    const mainPath = path.resolve(__dirname, '../../src/main.ts');
    const content = fs.readFileSync(mainPath, 'utf8');
    // Disallow top-level ESM import of shared/logger
    expect(content.includes("from '../../shared/logger'"))
      .toBe(false);
  });

  it('preflight should exist to resolve critical modules', () => {
    const mainPath = path.resolve(__dirname, '../../src/main.ts');
    const content = fs.readFileSync(mainPath, 'utf8');
    expect(content.includes('function preflightResolve(')).toBe(true);
    expect(content.includes("['electron-log', 'electron-updater', 'better-sqlite3']")).toBe(true);
  });
});


