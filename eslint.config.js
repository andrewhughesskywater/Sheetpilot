const js = require('@eslint/js');
const typescript = require('@typescript-eslint/eslint-plugin');
const react = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');

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

      'no-case-declarations': 'error'
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
