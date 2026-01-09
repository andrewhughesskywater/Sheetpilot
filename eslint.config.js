const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');
const sonarjs = require('eslint-plugin-sonarjs');
const prettierConfig = require('eslint-config-prettier');
const importPlugin = require('eslint-plugin-import');
const simpleImportSort = require('eslint-plugin-simple-import-sort');
const unusedImports = require('eslint-plugin-unused-imports');

const TS_FILES = ['**/*.{ts,tsx,cts,mts}'];
const TEST_FILES = [
  '**/*.spec.{ts,tsx}',
  '**/*.test.{ts,tsx}',
  '**/__tests__/**/*.{ts,tsx}'
];

// NOTE: @typescript-eslint provides flat configs, but the first entry sets the TS parser without a `files` filter.
// We scope the preset entries to TS files so JS/CJS/MJS scripts keep using ESLint's JS parser.
const typescriptRecommendedPreset = typescript.configs['flat/recommended'].map((cfg) => ({
  ...cfg,
  files: cfg.files ?? TS_FILES
}));

module.exports = [
  {
    ignores: [
      'build/**',
      'dist/**',
      '**/*.{js,cjs,mjs}',
      '**/*.js.map',
      '**/*.d.ts',
      'node_modules/**',
      'release/**',
      '**/tests/**',
      '**/__tests__/**',
      '**/*.spec.*',
      '**/*.test.*',
      '*.log',
      '*.sqlite',
      '*.db'
    ]
  },

  // JavaScript (scripts, tooling, build files)
  js.configs.recommended,
  {
    files: ['**/*.{js,cjs,mjs}'],
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }]
    }
  },

  // TypeScript (robust + strict, but scoped to production code by ignores and lint scripts)
  ...typescriptRecommendedPreset,
  prettierConfig, // Disable formatting rules that conflict with Prettier
  {
    files: TS_FILES,
    plugins: {
      sonarjs,
      import: importPlugin,
      'simple-import-sort': simpleImportSort,
      'unused-imports': unusedImports,
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname
      }
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json', './app/backend/tsconfig.json', './app/frontend/tsconfig.json']
        },
        node: true
      }
    },
    rules: {
      // ===== IMPORT MANAGEMENT (HARD GATES) =====
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['error', {
        vars: 'all',
        varsIgnorePattern: '^_',
        args: 'after-used',
        argsIgnorePattern: '^_'
      }],
      'import/no-duplicates': 'error',
      'import/no-cycle': 'error',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'error',
      'import/first': 'error',
      'import/newline-after-import': 'error',

      // ===== TYPE SAFETY (HARD GATES) =====
      // User standard: never allow explicit `any`.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off', // Use unused-imports plugin instead
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', disallowTypeAnnotations: false }],
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': false,
        'ts-nocheck': false,
        'ts-check': false
      }],
      '@typescript-eslint/explicit-function-return-type': ['error', {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
        allowHigherOrderFunctions: true,
        allowDirectConstAssertionInArrowFunctions: true
      }],
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/no-inferrable-types': 'off', // Allow explicit types for clarity

      'no-case-declarations': 'error',

      // ===== COMPLEXITY & COGNITIVE LIMITS (HARD GATES) =====
      'complexity': ['error', { max: 12 }],
      'max-depth': ['error', 4],
      'max-params': ['error', 4],
      'max-lines': ['error', { max: 500, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 120, skipBlankLines: true, skipComments: true }],
      'max-nested-callbacks': ['error', 3],
      'max-statements': ['error', 30, { ignoreTopLevelFunctions: false }],
      'sonarjs/cognitive-complexity': ['error', 20],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 5 }],
      'sonarjs/no-collapsible-if': 'error',
      'sonarjs/no-nested-switch': 'error',

      // ===== CODE QUALITY (HARD GATES) =====
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'prefer-arrow-callback': 'error',
      'no-throw-literal': 'error',
      'no-return-await': 'error',
      'require-await': 'off', // Use @typescript-eslint version in type-aware section
      'no-implicit-coercion': 'error',
      'no-sequences': 'error',
    },
  },

  // Relaxed complexity for React UI components (presentational code)
  {
    files: [
      'app/frontend/src/components/**/*.{ts,tsx}',
      'app/frontend/src/contexts/**/*.{ts,tsx}'
    ],
    rules: {
      'max-lines-per-function': ['error', { max: 250, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 40],
      'complexity': ['error', { max: 20 }],
      'sonarjs/cognitive-complexity': ['error', 25],
      'no-console': 'off', // Allow console in UI for debugging
      '@typescript-eslint/explicit-function-return-type': 'off', // React components don't need explicit return types
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  },

  // Stricter rules for business logic and services
  {
    files: [
      'app/backend/src/services/**/*.{ts,tsx}',
      'app/backend/src/logic/**/*.{ts,tsx}',
      'app/backend/src/repositories/**/*.{ts,tsx}',
      'app/shared/**/*.{ts,tsx}'
    ],
    ignores: ['app/backend/src/services/bot/**'],
    rules: {
      'complexity': ['error', { max: 10 }],
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 25],
      'sonarjs/cognitive-complexity': ['error', 15],
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }]
    }
  },

  // Moderate rules for IPC handlers and middleware
  {
    files: [
      'app/backend/src/ipc/**/*.{ts,tsx}',
      'app/backend/src/middleware/**/*.{ts,tsx}'
    ],
    rules: {
      'complexity': ['error', { max: 12 }],
      'max-params': ['error', { max: 5 }], // IPC handlers often need event + multiple params
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 30]
    }
  },

  // Relaxed rules for bootstrap and configuration
  {
    files: [
      'app/backend/src/bootstrap/**/*.{ts,tsx}',
      'app/backend/src/config/**/*.{ts,tsx}',
      '**/*config*.{ts,tsx}'
    ],
    rules: {
      'complexity': ['error', { max: 15 }],
      'max-params': ['error', { max: 5 }],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 35],
      '@typescript-eslint/no-explicit-any': 'warn', // Config files sometimes need flexibility
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off'
    }
  },



  // Relaxed rules for React hooks (often complex state management)
  {
    files: ['app/frontend/src/**/*use*.{ts,tsx}'],
    rules: {
      'complexity': ['error', { max: 18 }],
      'max-lines-per-function': ['error', { max: 150, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 35],
      '@typescript-eslint/explicit-function-return-type': 'off'
    }
  },

  // Type-aware rules: backend/shared (match `npm run type-check:root`)
  {
    files: ['app/backend/src/**/*.{ts,tsx}', 'app/shared/**/*.{ts,tsx}'],
    ignores: ['app/backend/src/services/bot/**'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.typecheck.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

      // Common false-positives / noisy rules in this codebase (keep off for now)
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/require-await': 'off',

      // Keep template strings safe, but allow common primitives.
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true
      }]
    }
  },

  // Type-aware rules: frontend (match `npm run type-check:frontend`)
  {
    files: ['app/frontend/src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./app/frontend/tsconfig.app.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

      // Common false-positives / noisy rules in this codebase (keep off for now)
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/require-await': 'off',

      // Keep template strings safe, but allow common primitives.
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true
      }]
    }
  },

  // Type-aware rules: bot service (match bot tsconfig)
  {
    files: ['app/backend/src/services/bot/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: ['./app/backend/src/services/bot/tsconfig.json'],
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/restrict-template-expressions': ['error', {
        allowNumber: true,
        allowBoolean: true,
        allowNullish: true
      }]
    }
  },

  // Backend / main process globals (Node + Electron)
  {
    files: [
      'app/backend/src/**/*.{ts,tsx}',
      'app/shared/**/*.{ts,tsx}',
      'app/backend/tests/**/*.{ts,tsx}',
      'app/shared/tests/**/*.{ts,tsx}',
      'app/tests/**/*.{ts,tsx}'
    ],
    languageOptions: {
      globals: {
        process: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        console: 'readonly',
        global: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        NodeJS: 'readonly',
        Electron: 'readonly'
      }
    }
  },

  // Frontend globals + React rules
  {
    files: ['app/frontend/src/**/*.{ts,tsx}', 'app/frontend/tests/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        navigator: 'readonly',
        console: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        localStorage: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        requestIdleCallback: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        CustomEvent: 'readonly',
        Event: 'readonly',
        Blob: 'readonly',
        URL: 'readonly',
        Notification: 'readonly',
        PermissionStatus: 'readonly',
        MutationObserver: 'readonly',
        MediaQueryList: 'readonly'
      }
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,

      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-refresh/only-export-components': ['error', { allowConstantExport: true }]
    },
    settings: {
      react: { version: 'detect' }
    }
  },

  // Test globals (Vitest)
  {
    files: TEST_FILES,
    languageOptions: {
      globals: {
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        vi: 'readonly',
        vitest: 'readonly'
      }
    }
  }
];
