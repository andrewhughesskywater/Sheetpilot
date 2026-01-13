/**
 * @fileoverview Test Organization Compliance Validator
 * 
 * Validates that all test files follow the organization guidelines from
 * docs/TEST_ORGANIZATION.md
 * 
 * Checks:
 * - All test files in correct directories
 * - Naming conventions (kebab-case, .spec.ts)
 * - No root-level test files (except in app/tests/)
 * - Proper directory structure matches guidelines
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

interface TestFileInfo {
  path: string;
  relativePath: string;
  name: string;
  directory: string;
}

const ALLOWED_ROOT_TEST_DIRS = ['app/tests'];
const REQUIRED_TEST_DIRS = {
  backend: ['unit', 'integration', 'ipc', 'services', 'repositories', 'contracts', 'validation', 'middleware', 'smoke', 'fixtures', 'helpers'],
  frontend: ['components', 'integration', 'utils', 'hooks', 'smoke'],
  shared: ['unit', 'utils'],
};

const VALID_TEST_EXTENSIONS = ['.spec.ts', '.spec.tsx', '.test.ts', '.test.tsx'];

function isValidTestFileName(name: string): boolean {
  // Check extension
  const hasValidExtension = VALID_TEST_EXTENSIONS.some(ext => name.endsWith(ext));
  if (!hasValidExtension) {
    return false;
  }

  // Check for kebab-case (no underscores, no PascalCase except for component names)
  const baseName = name.replace(/\.(spec|test)\.(ts|tsx)$/, '');
  
  // Allow PascalCase for component test files (e.g., TimesheetGrid.spec.tsx)
  if (name.endsWith('.tsx')) {
    // Component tests can have PascalCase
    return true;
  }

  // For .ts files, check for snake_case (not allowed)
  if (baseName.includes('_')) {
    return false;
  }

  // Check for PascalCase in non-component tests (not allowed except for specific cases)
  if (baseName !== baseName.toLowerCase() && !name.endsWith('.tsx')) {
    // Allow some exceptions like "DatabaseViewer" but warn
    return true; // Warn instead of fail
  }

  return true;
}

function findTestFiles(dir: string, relativeBase: string = ''): TestFileInfo[] {
  const testFiles: TestFileInfo[] = [];
  
  if (!fs.existsSync(dir)) {
    return testFiles;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.join(relativeBase, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules, dist, build, coverage
      if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) {
        continue;
      }
      testFiles.push(...findTestFiles(fullPath, relativePath));
    } else if (entry.isFile()) {
      if (VALID_TEST_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
        testFiles.push({
          path: fullPath,
          relativePath: relativePath,
          name: entry.name,
          directory: relativeBase,
        });
      }
    }
  }

  return testFiles;
}

function validateBackendTestFile(file: TestFileInfo): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if in root of tests directory (not allowed)
  if (file.directory === '' || file.directory === 'tests') {
    errors.push(`Test file ${file.relativePath} is in root of tests directory. Should be in a subdirectory.`);
  }

  // Check naming convention
  if (!isValidTestFileName(file.name)) {
    if (file.name.includes('_')) {
      errors.push(`Test file ${file.relativePath} uses snake_case. Should use kebab-case.`);
    } else {
      warnings.push(`Test file ${file.relativePath} may not follow naming conventions.`);
    }
  }

  // Check directory structure
  const parts = file.directory.split(path.sep).filter(p => p);
  if (parts.length > 0) {
    const category = parts[parts.length - 1]!;
    if (!REQUIRED_TEST_DIRS.backend.includes(category) && category !== 'bot' && category !== 'plugins') {
      // Allow nested directories like services/bot, services/plugins
      if (parts.length === 1 || (parts.length === 2 && parts[0] === 'services')) {
        // This is okay
      } else {
        warnings.push(`Test file ${file.relativePath} is in unexpected directory: ${category}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateFrontendTestFile(file: TestFileInfo): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if in root of tests directory (not allowed)
  if (file.directory === '' || file.directory === 'tests') {
    errors.push(`Test file ${file.relativePath} is in root of tests directory. Should be in a subdirectory.`);
  }

  // Check naming convention
  if (!isValidTestFileName(file.name)) {
    if (file.name.includes('_')) {
      errors.push(`Test file ${file.relativePath} uses snake_case. Should use kebab-case.`);
    }
  }

  // Check directory structure
  const parts = file.directory.split(path.sep).filter(p => p);
  if (parts.length > 0) {
    const category = parts[parts.length - 1]!;
    if (!REQUIRED_TEST_DIRS.frontend.includes(category) && category !== 'timesheet') {
      // Allow nested directories like components/timesheet
      if (parts.length === 1 || (parts.length === 2 && parts[0] === 'components')) {
        // This is okay
      } else {
        warnings.push(`Test file ${file.relativePath} is in unexpected directory: ${category}`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateSharedTestFile(file: TestFileInfo): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Shared tests should be in unit/ or utils/ subdirectories
  const parts = file.directory.split(path.sep).filter(p => p);
  if (parts.length === 0) {
    errors.push(`Test file ${file.relativePath} is in root of tests directory. Should be in unit/ or utils/ subdirectory.`);
  } else {
    const category = parts[parts.length - 1]!;
    if (!REQUIRED_TEST_DIRS.shared.includes(category)) {
      warnings.push(`Test file ${file.relativePath} is in unexpected directory: ${category}`);
    }
  }

  // Check naming convention
  if (!isValidTestFileName(file.name)) {
    if (file.name.includes('_')) {
      errors.push(`Test file ${file.relativePath} uses snake_case. Should use kebab-case.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function validateTestOrganization(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate backend tests
  const backendTestsDir = path.join(workspaceRoot, 'app', 'backend', 'tests');
  if (fs.existsSync(backendTestsDir)) {
    const backendTestFiles = findTestFiles(backendTestsDir, 'app/backend/tests');
    for (const file of backendTestFiles) {
      const result = validateBackendTestFile(file);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  }

  // Validate frontend tests
  const frontendTestsDir = path.join(workspaceRoot, 'app', 'frontend', 'tests');
  if (fs.existsSync(frontendTestsDir)) {
    const frontendTestFiles = findTestFiles(frontendTestsDir, 'app/frontend/tests');
    for (const file of frontendTestFiles) {
      const result = validateFrontendTestFile(file);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  }

  // Validate shared tests
  const sharedTestsDir = path.join(workspaceRoot, 'app', 'shared', 'tests');
  if (fs.existsSync(sharedTestsDir)) {
    const sharedTestFiles = findTestFiles(sharedTestsDir, 'app/shared/tests');
    for (const file of sharedTestFiles) {
      const result = validateSharedTestFile(file);
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
  }

  // Validate cross-cutting tests (app/tests) - these can be at root
  const crossCuttingTestsDir = path.join(workspaceRoot, 'app', 'tests');
  if (fs.existsSync(crossCuttingTestsDir)) {
    const crossCuttingTestFiles = findTestFiles(crossCuttingTestsDir, 'app/tests');
    for (const file of crossCuttingTestFiles) {
      // Cross-cutting tests can be at root level
      if (!isValidTestFileName(file.name)) {
        if (file.name.includes('_')) {
          errors.push(`Test file ${file.relativePath} uses snake_case. Should use kebab-case.`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
  };
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateTestOrganization();
  
  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  if (result.errors.length > 0) {
    console.error('\n❌ Errors:');
    result.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }

  if (result.passed) {
    console.log('✅ All test files comply with organization guidelines.');
    process.exit(0);
  }
}
