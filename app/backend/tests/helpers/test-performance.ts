/**
 * @fileoverview Test Performance Utilities
 * 
 * Utilities for tracking and reporting test execution times
 */

export interface TestPerformanceMetrics {
  testName: string;
  suiteName: string;
  executionTime: number;
  timeout: number;
  isSlow: boolean;
}

export interface SuitePerformanceMetrics {
  suiteName: string;
  totalTests: number;
  totalTime: number;
  averageTime: number;
  slowTests: TestPerformanceMetrics[];
  timeout: number;
}

const SLOW_TEST_THRESHOLD_MS = 1000; // 1 second
const SLOW_SUITE_THRESHOLD_MS = 5000; // 5 seconds

export class TestPerformanceTracker {
  private testMetrics: Map<string, TestPerformanceMetrics> = new Map();
  private suiteMetrics: Map<string, SuitePerformanceMetrics> = new Map();
  private startTimes: Map<string, number> = new Map();

  startTest(testName: string, suiteName: string, timeout: number = 5000): void {
    const key = `${suiteName}::${testName}`;
    this.startTimes.set(key, Date.now());
  }

  endTest(testName: string, suiteName: string, timeout: number = 5000): TestPerformanceMetrics {
    const key = `${suiteName}::${testName}`;
    const startTime = this.startTimes.get(key);
    
    if (!startTime) {
      throw new Error(`No start time recorded for test: ${testName}`);
    }

    const executionTime = Date.now() - startTime;
    const isSlow = executionTime > SLOW_TEST_THRESHOLD_MS;

    const metrics: TestPerformanceMetrics = {
      testName,
      suiteName,
      executionTime,
      timeout,
      isSlow,
    };

    this.testMetrics.set(key, metrics);
    this.startTimes.delete(key);

    // Update suite metrics
    this.updateSuiteMetrics(suiteName, metrics);

    return metrics;
  }

  private updateSuiteMetrics(suiteName: string, testMetrics: TestPerformanceMetrics): void {
    let suiteMetrics = this.suiteMetrics.get(suiteName);
    
    if (!suiteMetrics) {
      suiteMetrics = {
        suiteName,
        totalTests: 0,
        totalTime: 0,
        averageTime: 0,
        slowTests: [],
        timeout: testMetrics.timeout,
      };
      this.suiteMetrics.set(suiteName, suiteMetrics);
    }

    suiteMetrics.totalTests++;
    suiteMetrics.totalTime += testMetrics.executionTime;
    suiteMetrics.averageTime = suiteMetrics.totalTime / suiteMetrics.totalTests;

    if (testMetrics.isSlow) {
      suiteMetrics.slowTests.push(testMetrics);
    }
  }

  getTestMetrics(testName: string, suiteName: string): TestPerformanceMetrics | undefined {
    const key = `${suiteName}::${testName}`;
    return this.testMetrics.get(key);
  }

  getSuiteMetrics(suiteName: string): SuitePerformanceMetrics | undefined {
    return this.suiteMetrics.get(suiteName);
  }

  getAllMetrics(): {
    tests: TestPerformanceMetrics[];
    suites: SuitePerformanceMetrics[];
  } {
    return {
      tests: Array.from(this.testMetrics.values()),
      suites: Array.from(this.suiteMetrics.values()),
    };
  }

  getSlowTests(): TestPerformanceMetrics[] {
    return Array.from(this.testMetrics.values()).filter(m => m.isSlow);
  }

  getSlowSuites(): SuitePerformanceMetrics[] {
    return Array.from(this.suiteMetrics.values()).filter(
      m => m.totalTime > SLOW_SUITE_THRESHOLD_MS
    );
  }

  generateReport(): string {
    const metrics = this.getAllMetrics();
    const slowTests = this.getSlowTests();
    const slowSuites = this.getSlowSuites();

    let report = '# Test Performance Report\n\n';
    
    report += `## Summary\n\n`;
    report += `- Total Tests: ${metrics.tests.length}\n`;
    report += `- Total Suites: ${metrics.suites.length}\n`;
    report += `- Slow Tests (>${SLOW_TEST_THRESHOLD_MS}ms): ${slowTests.length}\n`;
    report += `- Slow Suites (>${SLOW_SUITE_THRESHOLD_MS}ms): ${slowSuites.length}\n\n`;

    if (slowTests.length > 0) {
      report += `## Slow Tests\n\n`;
      slowTests
        .sort((a, b) => b.executionTime - a.executionTime)
        .forEach(test => {
          report += `- **${test.suiteName}::${test.testName}**: ${test.executionTime}ms\n`;
        });
      report += '\n';
    }

    if (slowSuites.length > 0) {
      report += `## Slow Suites\n\n`;
      slowSuites
        .sort((a, b) => b.totalTime - a.totalTime)
        .forEach(suite => {
          report += `- **${suite.suiteName}**: ${suite.totalTime}ms (avg: ${suite.averageTime.toFixed(2)}ms, ${suite.totalTests} tests)\n`;
        });
      report += '\n';
    }

    return report;
  }

  reset(): void {
    this.testMetrics.clear();
    this.suiteMetrics.clear();
    this.startTimes.clear();
  }
}

// Global instance for use in tests
export const testPerformanceTracker = new TestPerformanceTracker();
