import { defineConfig } from 'vitest/config';

// Centralize Vitest multi-project setup here so both CLI and VS Code plugin
// use the same entrypoint. Paths point to existing per-suite configs.
export default defineConfig({
	test: {
		projects: [
			'./app/backend/tests/vitest.config.ts',
			'./app/backend/tests/vitest.config.integration.ts',
			'./app/backend/tests/vitest.config.smoke.ts',
			'./app/backend/tests/vitest.config.e2e.ts',
			'./app/backend/tests/vitest.config.blank-screen-prevention.ts',
			'./app/shared/tests/vitest.config.ts',
			'./app/frontend/tests/vitest.config.ts',
			'./app/frontend/tests/vitest.config.blank-screen-prevention.ts'
		]
	}
});