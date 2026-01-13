const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');
const sonarjs = require('eslint-plugin-sonarjs');

// Complexity rule is built into ESLint, no plugin needed

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
  {
    files: TS_FILES,
    plugins: {
      sonarjs
    },
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
        tsconfigRootDir: __dirname
      }
    },
    rules: {
      // User standard: never allow explicit `any`.
      '@typescript-eslint/no-explicit-any': 'error',

      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports', disallowTypeAnnotations: false }],
      '@typescript-eslint/ban-ts-comment': ['error', {
        'ts-expect-error': 'allow-with-description',
        'ts-ignore': false,
        'ts-nocheck': false,
        'ts-check': false
      }],

      'no-case-declarations': 'error',
      
      // Default complexity rules (will be overridden by file-type-specific rules)
      // Industry standard: 10 is recommended (McCabe), 15 acceptable, 20+ requires refactoring
      // Complexity rule is built into ESLint core
      'complexity': ['warn', 10],
      
      // Default max-lines rules (will be overridden by file-type-specific rules)
      // Industry standard: 300 lines (common practice), 500 max for complex code
      // max-lines rule is built into ESLint core
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }],
      
      // Default cognitive complexity rules (will be overridden by file-type-specific rules)
      // Human-focused metric: measures how difficult code is to understand for humans
      // Industry standard: 15 is recommended (SonarSource), more lenient than cyclomatic complexity
      // cognitive-complexity rule from eslint-plugin-sonarjs
      'sonarjs/cognitive-complexity': ['warn', 15]
    }
  },

  // File-type-specific complexity rules - Backend Services (moderate tolerance for complex business logic)
  {
    files: ['app/backend/src/services/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 20], // Industry max: 20 for complex business logic
      'max-lines': ['warn', { max: 500, skipBlankLines: false, skipComments: false }], // Industry max: 500 for complex services
      'sonarjs/cognitive-complexity': ['warn', 25] // Human-focused: 25 max for complex business logic
    }
  },

  // Backend IPC Handlers
  {
    files: ['app/backend/src/ipc/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }], // Industry standard: 400 for moderate files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Backend Repositories (should be simple)
  {
    files: ['app/backend/src/repositories/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 10], // Industry standard: 10 for simple code
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 12] // Human-focused: 12 for simple code
    }
  },

  // Backend Logic
  {
    files: ['app/backend/src/logic/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }], // Industry standard: 400 for moderate files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Backend Bootstrap
  {
    files: ['app/backend/src/bootstrap/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }], // Industry standard: 400 for moderate files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Backend Preload (should be simple)
  {
    files: ['app/backend/src/preload/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 10], // Industry standard: 10 for simple code
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 12] // Human-focused: 12 for simple code
    }
  },

  // Backend Validation (should be simple)
  {
    files: ['app/backend/src/validation/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 10], // Industry standard: 10 for simple code
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 12] // Human-focused: 12 for simple code
    }
  },

  // Frontend Components (should be simple)
  {
    files: ['app/frontend/src/components/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 10], // Industry standard: 10 for simple code
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 12] // Human-focused: 12 for simple code
    }
  },

  // Frontend Services (should be simple)
  {
    files: ['app/frontend/src/services/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 10], // Industry standard: 10 for simple code
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 12] // Human-focused: 12 for simple code
    }
  },

  // Frontend Hooks
  {
    files: ['app/frontend/src/hooks/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 300, skipBlankLines: false, skipComments: false }], // Industry standard: 300 for standard files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Frontend Contexts
  {
    files: ['app/frontend/src/contexts/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }], // Industry standard: 400 for moderate files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Frontend Utils (should be very simple)
  {
    files: ['app/frontend/src/utils/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 8], // Industry standard: 8 for very simple code
      'max-lines': ['warn', { max: 200, skipBlankLines: false, skipComments: false }], // Industry standard: 200 for simple utilities
      'sonarjs/cognitive-complexity': ['warn', 10] // Human-focused: 10 for very simple code
    }
  },

  // Shared Utils (should be very simple)
  {
    files: ['app/shared/utils/**/*.{ts,tsx}'],
    rules: {
      'complexity': ['warn', 8], // Industry standard: 8 for very simple code
      'max-lines': ['warn', { max: 200, skipBlankLines: false, skipComments: false }], // Industry standard: 200 for simple utilities
      'sonarjs/cognitive-complexity': ['warn', 10] // Human-focused: 10 for very simple code
    }
  },

  // Shared Core
  {
    files: ['app/shared/*.{ts,tsx}'],
    ignores: ['app/shared/utils/**'],
    rules: {
      'complexity': ['warn', 15], // Industry standard: 15 for moderate complexity
      'max-lines': ['warn', { max: 400, skipBlankLines: false, skipComments: false }], // Industry standard: 400 for moderate files
      'sonarjs/cognitive-complexity': ['warn', 18] // Human-focused: 18 for moderate complexity
    }
  },

  // Test Files (can be more complex, but still maintainable)
  {
    files: TEST_FILES,
    rules: {
      'complexity': ['warn', 20], // Industry standard: 20 max for complex test scenarios
      'max-lines': ['warn', { max: 500, skipBlankLines: false, skipComments: false }], // Industry standard: 500 max for comprehensive tests
      'sonarjs/cognitive-complexity': ['warn', 25] // Human-focused: 25 max for complex test scenarios
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
