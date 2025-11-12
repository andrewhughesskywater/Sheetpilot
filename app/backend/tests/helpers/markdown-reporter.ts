import type { Reporter } from 'vitest';
import type { File, Task, Suite } from 'vitest';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

interface MarkdownReporterOptions {
  outputFile?: string;
  outputDir?: string;
}

export class MarkdownReporter implements Reporter {
  private outputFile: string;
  private results: {
    files: Array<{
      file: string;
      tests: Array<{
        name: string;
        status: 'passed' | 'failed' | 'skipped';
        duration?: number;
        error?: string;
      }>;
      suites: Array<{
        name: string;
        tests: Array<{
          name: string;
          status: 'passed' | 'failed' | 'skipped';
          duration?: number;
          error?: string;
        }>;
      }>;
    }>;
    summary: {
      total: number;
      passed: number;
      failed: number;
      skipped: number;
      duration: number;
    };
  };

  constructor(options: MarkdownReporterOptions = {}) {
    const outputDir = options.outputDir || resolve(process.cwd(), 'test-results');
    const outputFile = options.outputFile || 'test-results.md';
    this.outputFile = resolve(outputDir, outputFile);
    this.results = {
      files: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };
  }

  onFinished(files: File[] = []) {
    // Process all files and collect test results
    files.forEach((file) => {
      const fileResult = {
        file: file.filepath || 'unknown',
        tests: [] as Array<{
          name: string;
          status: 'passed' | 'failed' | 'skipped';
          duration?: number;
          error?: string;
        }>,
        suites: [] as Array<{
          name: string;
          tests: Array<{
            name: string;
            status: 'passed' | 'failed' | 'skipped';
            duration?: number;
            error?: string;
          }>;
        }>
      };

      // Process tasks in the file
      const processTask = (task: Task, suiteName?: string) => {
        if (task.type === 'test') {
          const testResult = {
            name: task.name,
            status: task.mode === 'skip' ? 'skipped' as const : 
                   task.result?.state === 'pass' ? 'passed' as const :
                   task.result?.state === 'fail' ? 'failed' as const : 'failed' as const,
            duration: task.result?.duration,
            error: task.result?.errors?.[0]?.message || task.result?.errors?.[0]?.stack
          };

          if (suiteName) {
            let suite = fileResult.suites.find(s => s.name === suiteName);
            if (!suite) {
              suite = { name: suiteName, tests: [] };
              fileResult.suites.push(suite);
            }
            suite.tests.push(testResult);
          } else {
            fileResult.tests.push(testResult);
          }

          // Update summary
          this.results.summary.total++;
          if (testResult.status === 'passed') {
            this.results.summary.passed++;
          } else if (testResult.status === 'failed') {
            this.results.summary.failed++;
          } else {
            this.results.summary.skipped++;
          }
          if (testResult.duration) {
            this.results.summary.duration += testResult.duration;
          }
        } else if (task.type === 'suite') {
          const suite = task as Suite;
          const currentSuiteName = suiteName ? `${suiteName} > ${suite.name}` : suite.name;
          suite.tasks.forEach(subTask => processTask(subTask, currentSuiteName));
        }
      };

      file.tasks.forEach(task => processTask(task));

      if (fileResult.tests.length > 0 || fileResult.suites.length > 0) {
        this.results.files.push(fileResult);
      }
    });

    // Generate markdown
    const markdown = this.generateMarkdown();

    // Ensure output directory exists
    const outputDir = dirname(this.outputFile);
    try {
      mkdirSync(outputDir, { recursive: true });
    } catch {
      // Directory might already exist, ignore error
    }

    // Write markdown file
    writeFileSync(this.outputFile, markdown, 'utf-8');
  }

  private generateMarkdown(): string {
    const lines: string[] = [];

    // Header
    lines.push('# Test Results');
    lines.push('');
    lines.push(`Generated at: ${new Date().toISOString()}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tests | ${this.results.summary.total} |`);
    lines.push(`| Passed | ${this.results.summary.passed} |`);
    lines.push(`| Failed | ${this.results.summary.failed} |`);
    lines.push(`| Skipped | ${this.results.summary.skipped} |`);
    lines.push(`| Duration | ${(this.results.summary.duration / 1000).toFixed(2)}s |`);
    lines.push('');

    // Pass rate
    const passRate = this.results.summary.total > 0
      ? ((this.results.summary.passed / this.results.summary.total) * 100).toFixed(2)
      : '0.00';
    lines.push(`**Pass Rate:** ${passRate}%`);
    lines.push('');

    // Test Results by File
    if (this.results.files.length > 0) {
      lines.push('## Test Results by File');
      lines.push('');

      this.results.files.forEach((fileResult) => {
        lines.push(`### ${fileResult.file}`);
        lines.push('');

        // Tests without suites
        if (fileResult.tests.length > 0) {
          lines.push('#### Tests');
          lines.push('');
          lines.push('| Test | Status | Duration |');
          lines.push('|------|--------|----------|');
          fileResult.tests.forEach((test) => {
            const statusEmoji = test.status === 'passed' ? '✅' : 
                               test.status === 'failed' ? '❌' : '⏭️';
            const duration = test.duration ? `${(test.duration / 1000).toFixed(2)}s` : '-';
            lines.push(`| ${test.name} | ${statusEmoji} ${test.status} | ${duration} |`);
          });
          lines.push('');
        }

        // Suites
        if (fileResult.suites.length > 0) {
          fileResult.suites.forEach((suite) => {
            lines.push(`#### ${suite.name}`);
            lines.push('');
            lines.push('| Test | Status | Duration |');
            lines.push('|------|--------|----------|');
            suite.tests.forEach((test) => {
              const statusEmoji = test.status === 'passed' ? '✅' : 
                                 test.status === 'failed' ? '❌' : '⏭️';
              const duration = test.duration ? `${(test.duration / 1000).toFixed(2)}s` : '-';
              lines.push(`| ${test.name} | ${statusEmoji} ${test.status} | ${duration} |`);
            });
            lines.push('');
          });
        }
      });
    }

    // Failed Tests Details
    const failedTests = this.getAllFailedTests();
    if (failedTests.length > 0) {
      lines.push('## Failed Tests Details');
      lines.push('');
      failedTests.forEach((failedTest) => {
        lines.push(`### ${failedTest.file} - ${failedTest.name}`);
        lines.push('');
        if (failedTest.error) {
          lines.push('```');
          lines.push(failedTest.error);
          lines.push('```');
          lines.push('');
        }
      });
    }

    return lines.join('\n');
  }

  private getAllFailedTests(): Array<{ file: string; name: string; error?: string }> {
    const failed: Array<{ file: string; name: string; error?: string }> = [];
    
    this.results.files.forEach((fileResult) => {
      fileResult.tests
        .filter(t => t.status === 'failed')
        .forEach(test => {
          failed.push({
            file: fileResult.file,
            name: test.name,
            error: test.error
          });
        });

      fileResult.suites.forEach((suite) => {
        suite.tests
          .filter(t => t.status === 'failed')
          .forEach(test => {
            failed.push({
              file: fileResult.file,
              name: `${suite.name} > ${test.name}`,
              error: test.error
            });
          });
      });
    });

    return failed;
  }
}
