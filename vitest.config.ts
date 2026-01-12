import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    include: [],
    globals: true,
    environment: 'node',
    projects: [
      {
        name: 'backend-unit',
        root: path.resolve(__dirname, '.'),
        test: {
          environment: 'node',
          root: path.resolve(__dirname, '.'),
          include: [
            'app/backend/tests/**/*.spec.ts'
          ],
          exclude: [
            'app/backend/tests/integration/**/*.spec.ts',
            'app/backend/tests/e2e/**/*.spec.ts',
            'app/backend/tests/smoke/**/*.spec.ts'
          ],
          passWithNoTests: false,
          globals: true,
          setupFiles: [path.resolve(__dirname, 'app/backend/tests/setup.ts')],
          testTimeout: 5000,
          pool: 'threads',
          poolOptions: {
            threads: {
              maxThreads: 4,
              minThreads: 1,
              useAtomics: true
            }
          },
          maxConcurrency: 4,
          fileParallelism: true,
          reporters: ['default']
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'app/backend/src'),
          }
        }
      },
      {
        name: 'backend-integration',
        root: path.resolve(__dirname, '.'),
        test: {
          environment: 'node',
          root: path.resolve(__dirname, '.'),
          include: [
            'app/backend/tests/auto-updater.spec.ts',
            'app/backend/tests/database.spec.ts',
            'app/backend/tests/deprecated-constants.spec.ts',
            'app/backend/tests/import-policy.spec.ts',
            'app/backend/tests/ipc-handlers-comprehensive.spec.ts',
            'app/backend/tests/ipc-main.spec.ts',
            'app/backend/tests/ipc-workflow-integration.spec.ts',
            'app/backend/tests/main-application-logic.spec.ts',
            'app/backend/tests/quarter-config.spec.ts',
            'app/backend/tests/quarter-routing-integration.spec.ts',
            'app/backend/tests/timesheet_submission_integration.spec.ts',
            'app/backend/tests/services/**/*.spec.ts',
            'app/backend/tests/integration/**/*.spec.ts'
          ],
          passWithNoTests: false,
          globals: true,
          setupFiles: [path.resolve(__dirname, 'app/backend/tests/setup.ts')],
          testTimeout: 120000,
          pool: 'threads',
          poolOptions: {
            threads: {
              maxThreads: 4,
              minThreads: 1
            }
          },
          reporters: ['default']
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'app/backend/src'),
          }
        }
      },
      {
        name: 'frontend',
        root: path.resolve(__dirname, 'app/frontend'),
        test: {
          environment: 'jsdom',
          setupFiles: [path.resolve(__dirname, 'app/frontend/tests/setup.ts')],
          globals: true,
          include: [
            'tests/**/*.spec.{ts,tsx}',
            'tests/**/*.test.{ts,tsx}'
          ],
          exclude: [
            'node_modules',
            'dist',
            'build'
          ],
          deps: {
            optimizer: {
              web: {
                include: [
                  '@emotion/react',
                  '@emotion/styled',
                  '@mui/material',
                  '@mui/styled-engine'
                ]
              }
            }
          },
          reporters: ['default']
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'app/frontend/src'),
            '@tests': path.resolve(__dirname, 'app/frontend/tests')
          }
        }
      },
      {
        name: 'shared',
        root: path.resolve(__dirname, 'app/shared'),
        test: {
          environment: 'node',
          globals: true,
          include: [
            'tests/**/*.spec.ts'
          ],
          exclude: [
            'node_modules'
          ],
          reporters: ['default']
        },
        resolve: {
          alias: {
            '@': path.resolve(__dirname, 'app/shared')
          }
        }
      }
    ]
  }
});
