/**
 * @fileoverview Test Quality Analyzer
 * 
 * Analyzes test files for quality metrics:
 * - Test complexity (cyclomatic complexity)
 * - Duplication detection
 * - Documentation coverage
 * - Test-to-source ratio
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '..');

interface TestQualityMetrics {
  filePath: string;
  complexity: number;
  linesOfCode: number;
  testCount: number;
  hasDocumentation: boolean;
  duplicationScore: number;
}

interface QualityReport {
  metrics: TestQualityMetrics[];
  summary: {
    totalFiles: number;
    averageComplexity: number;
    averageTestCount: number;
    documentationCoverage: number;
    averageDuplicationScore: number;
  };
}

/**
 * Calculate cyclomatic complexity of a function
 */
function calculateComplexity(code: string): number {
  // Count decision points: if, else, for, while, switch, case, catch, &&, ||, ?:
  const decisionPoints = [
    /\bif\s*\(/g,
    /\belse\s*\{/g,
    /\bfor\s*\(/g,
    /\bwhile\s*\(/g,
    /\bswitch\s*\(/g,
    /\bcase\s+/g,
    /\bcatch\s*\(/g,
    /&&/g,
    /\|\|/g,
    /\?/g,
  ];

  let complexity = 1; // Base complexity

  for (const pattern of decisionPoints) {
    const matches = code.match(pattern);
    if (matches) {
      complexity += matches.length;
    }
  }

  return complexity;
}

/**
 * Check if file has documentation
 */
function hasDocumentation(content: string): boolean {
  // Check for JSDoc comments or fileoverview
  return /\/\*\*[\s\S]*?\*\//.test(content) || 
         /@fileoverview/.test(content) ||
         /\/\/\/.*@/.test(content);
}

/**
 * Count test cases in a file
 */
function countTests(content: string): number {
  const itMatches = content.match(/\b(it|test)\s*\(/g);
  return itMatches ? itMatches.length : 0;
}

/**
 * Calculate duplication score (simple heuristic)
 */
function calculateDuplicationScore(content: string): number {
  const lines = content.split('\n').filter(line => line.trim().length > 0);
  const uniqueLines = new Set(lines.map(line => line.trim()));
  
  if (lines.length === 0) {
    return 0;
  }

  // Duplication score: percentage of duplicate lines
  const duplicationRatio = 1 - (uniqueLines.size / lines.length);
  return Math.round(duplicationRatio * 100);
}

/**
 * Analyze a test file
 */
function analyzeTestFile(filePath: string): TestQualityMetrics {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  // Calculate complexity for each test function
  const testFunctions = content.match(/(it|test|describe)\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\}/g) || [];
  let totalComplexity = 0;
  
  for (const func of testFunctions) {
    totalComplexity += calculateComplexity(func);
  }
  
  // Average complexity per test
  const testCount = countTests(content);
  const avgComplexity = testCount > 0 ? totalComplexity / testCount : totalComplexity;

  return {
    filePath: path.relative(workspaceRoot, filePath),
    complexity: Math.round(avgComplexity * 10) / 10,
    linesOfCode: lines.length,
    testCount,
    hasDocumentation: hasDocumentation(content),
    duplicationScore: calculateDuplicationScore(content),
  };
}

/**
 * Find all test files
 */
function findTestFiles(dir: string): string[] {
  const testFiles: string[] = [];
  
  if (!fs.existsSync(dir)) {
    return testFiles;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (['node_modules', 'dist', 'build', 'coverage', '.git'].includes(entry.name)) {
        continue;
      }
      testFiles.push(...findTestFiles(fullPath));
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.spec.ts') || 
          entry.name.endsWith('.spec.tsx') ||
          entry.name.endsWith('.test.ts') ||
          entry.name.endsWith('.test.tsx')) {
        testFiles.push(fullPath);
      }
    }
  }

  return testFiles;
}

/**
 * Generate quality report
 */
export function analyzeTestQuality(): QualityReport {
  const testDirs = [
    path.join(workspaceRoot, 'app', 'backend', 'tests'),
    path.join(workspaceRoot, 'app', 'frontend', 'tests'),
    path.join(workspaceRoot, 'app', 'shared', 'tests'),
    path.join(workspaceRoot, 'app', 'tests'),
  ];

  const allTestFiles: string[] = [];
  for (const dir of testDirs) {
    allTestFiles.push(...findTestFiles(dir));
  }

  const metrics = allTestFiles.map(file => analyzeTestFile(file));

  const totalFiles = metrics.length;
  const averageComplexity = metrics.reduce((sum, m) => sum + m.complexity, 0) / totalFiles || 0;
  const averageTestCount = metrics.reduce((sum, m) => sum + m.testCount, 0) / totalFiles || 0;
  const documentationCoverage = (metrics.filter(m => m.hasDocumentation).length / totalFiles) * 100 || 0;
  const averageDuplicationScore = metrics.reduce((sum, m) => sum + m.duplicationScore, 0) / totalFiles || 0;

  return {
    metrics,
    summary: {
      totalFiles,
      averageComplexity: Math.round(averageComplexity * 10) / 10,
      averageTestCount: Math.round(averageTestCount * 10) / 10,
      documentationCoverage: Math.round(documentationCoverage * 10) / 10,
      averageDuplicationScore: Math.round(averageDuplicationScore * 10) / 10,
    },
  };
}

/**
 * Generate markdown report
 */
export function generateQualityReport(): string {
  const report = analyzeTestQuality();
  
  let markdown = '# Test Quality Report\n\n';
  markdown += `Generated: ${new Date().toISOString()}\n\n`;
  
  markdown += '## Summary\n\n';
  markdown += `- **Total Test Files**: ${report.summary.totalFiles}\n`;
  markdown += `- **Average Complexity**: ${report.summary.averageComplexity}\n`;
  markdown += `- **Average Test Count**: ${report.summary.averageTestCount}\n`;
  markdown += `- **Documentation Coverage**: ${report.summary.documentationCoverage}%\n`;
  markdown += `- **Average Duplication Score**: ${report.summary.averageDuplicationScore}%\n\n`;

  // Files with high complexity
  const highComplexity = report.metrics
    .filter(m => m.complexity > 10)
    .sort((a, b) => b.complexity - a.complexity)
    .slice(0, 10);

  if (highComplexity.length > 0) {
    markdown += '## High Complexity Files (>10)\n\n';
    highComplexity.forEach(m => {
      markdown += `- **${m.filePath}**: Complexity ${m.complexity}, ${m.testCount} tests\n`;
    });
    markdown += '\n';
  }

  // Files with high duplication
  const highDuplication = report.metrics
    .filter(m => m.duplicationScore > 30)
    .sort((a, b) => b.duplicationScore - a.duplicationScore)
    .slice(0, 10);

  if (highDuplication.length > 0) {
    markdown += '## High Duplication Files (>30%)\n\n';
    highDuplication.forEach(m => {
      markdown += `- **${m.filePath}**: ${m.duplicationScore}% duplication\n`;
    });
    markdown += '\n';
  }

  // Files without documentation
  const noDocs = report.metrics.filter(m => !m.hasDocumentation);
  if (noDocs.length > 0) {
    markdown += `## Files Without Documentation (${noDocs.length})\n\n`;
    noDocs.slice(0, 20).forEach(m => {
      markdown += `- ${m.filePath}\n`;
    });
    if (noDocs.length > 20) {
      markdown += `\n... and ${noDocs.length - 20} more\n`;
    }
    markdown += '\n';
  }

  return markdown;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const report = generateQualityReport();
  console.log(report);
  
  // Write to file
  const reportPath = path.join(workspaceRoot, 'docs', 'TEST_QUALITY_REPORT.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport written to: ${reportPath}`);
}
