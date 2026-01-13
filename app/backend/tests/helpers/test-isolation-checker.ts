/**
 * @fileoverview Test Isolation Checker
 * 
 * Utilities for detecting test isolation issues:
 * - Shared state between tests
 * - Missing cleanup (afterEach hooks)
 * - Database/file system isolation
 * - Mock state isolation
 */

export interface IsolationViolation {
  type: 'shared_state' | 'missing_cleanup' | 'database_isolation' | 'mock_isolation' | 'file_system_isolation';
  testFile: string;
  testName?: string;
  description: string;
  severity: 'error' | 'warning';
}

export interface IsolationReport {
  violations: IsolationViolation[];
  passed: boolean;
}

/**
 * Checks for common isolation issues in test files
 */
export class TestIsolationChecker {
  private violations: IsolationViolation[] = [];

  /**
   * Check if test file has proper cleanup hooks
   */
  checkCleanupHooks(testFileContent: string, filePath: string): void {
    // Check for beforeEach without corresponding afterEach
    const hasBeforeEach = /beforeEach\s*\(/g.test(testFileContent);
    const hasAfterEach = /afterEach\s*\(/g.test(testFileContent);
    const hasBeforeAll = /beforeAll\s*\(/g.test(testFileContent);
    const hasAfterAll = /afterAll\s*\(/g.test(testFileContent);

    if (hasBeforeEach && !hasAfterEach) {
      this.violations.push({
        type: 'missing_cleanup',
        testFile: filePath,
        description: 'Test file has beforeEach but no afterEach hook for cleanup',
        severity: 'warning',
      });
    }

    if (hasBeforeAll && !hasAfterAll) {
      this.violations.push({
        type: 'missing_cleanup',
        testFile: filePath,
        description: 'Test file has beforeAll but no afterAll hook for cleanup',
        severity: 'warning',
      });
    }
  }

  /**
   * Check for shared state patterns
   */
  checkSharedState(testFileContent: string, filePath: string): void {
    // Check for module-level variables that might be shared
    const moduleLevelVars = testFileContent.match(/^(const|let|var)\s+\w+\s*=/gm);
    
    if (moduleLevelVars) {
      // Check if variables are reset in beforeEach/afterEach
      const hasReset = /(beforeEach|afterEach).*\{[\s\S]*?(=\s*undefined|null|\[\]|\{\})/g.test(testFileContent);
      
      if (!hasReset && moduleLevelVars.length > 3) {
        this.violations.push({
          type: 'shared_state',
          testFile: filePath,
          description: 'Test file has module-level variables that may be shared between tests',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Check for database isolation issues
   */
  checkDatabaseIsolation(testFileContent: string, filePath: string): void {
    // Check if database operations are used
    const hasDbOperations = /(insert|update|delete|select|query|transaction)/gi.test(testFileContent);
    
    if (hasDbOperations) {
      // Check for cleanup of test database
      const hasCleanup = /(cleanup|teardown|remove|delete|close|shutdown).*db/gi.test(testFileContent);
      const hasIsolatedDb = /(tmpdir|temp|test.*db|isolated)/gi.test(testFileContent);
      
      if (!hasCleanup && !hasIsolatedDb) {
        this.violations.push({
          type: 'database_isolation',
          testFile: filePath,
          description: 'Test file uses database operations but may not have proper isolation/cleanup',
          severity: 'error',
        });
      }
    }
  }

  /**
   * Check for mock isolation issues
   */
  checkMockIsolation(testFileContent: string, filePath: string): void {
    // Check for vi.mock or jest.mock usage
    const hasMocks = /(vi\.mock|jest\.mock|mock\(|vi\.fn)/g.test(testFileContent);
    
    if (hasMocks) {
      // Check for mock cleanup
      const hasMockCleanup = /(vi\.clearAllMocks|vi\.resetAllMocks|jest\.clearAllMocks|jest\.resetAllMocks)/g.test(testFileContent);
      
      if (!hasMockCleanup) {
        this.violations.push({
          type: 'mock_isolation',
          testFile: filePath,
          description: 'Test file uses mocks but may not have proper cleanup',
          severity: 'warning',
        });
      }
    }
  }

  /**
   * Check for file system isolation issues
   */
  checkFileSystemIsolation(testFileContent: string, filePath: string): void {
    // Check for file system operations
    const hasFsOperations = /(fs\.|writeFile|readFile|mkdir|rmdir|unlink|existsSync)/g.test(testFileContent);
    
    if (hasFsOperations) {
      // Check for cleanup of test files
      const hasCleanup = /(unlink|rmdir|remove|delete|cleanup).*test/g.test(testFileContent);
      const hasTempFiles = /(tmpdir|temp|test.*file)/gi.test(testFileContent);
      
      if (!hasCleanup && !hasTempFiles) {
        this.violations.push({
          type: 'file_system_isolation',
          testFile: filePath,
          description: 'Test file uses file system operations but may not have proper cleanup',
          severity: 'error',
        });
      }
    }
  }

  /**
   * Analyze a test file for isolation issues
   */
  analyzeTestFile(filePath: string, content: string): void {
    this.checkCleanupHooks(content, filePath);
    this.checkSharedState(content, filePath);
    this.checkDatabaseIsolation(content, filePath);
    this.checkMockIsolation(content, filePath);
    this.checkFileSystemIsolation(content, filePath);
  }

  /**
   * Get isolation report
   */
  getReport(): IsolationReport {
    const errors = this.violations.filter(v => v.severity === 'error');
    
    return {
      violations: this.violations,
      passed: errors.length === 0,
    };
  }

  /**
   * Reset violations
   */
  reset(): void {
    this.violations = [];
  }
}
