import { defineConfig } from 'vitest/config';
import { workspaceAlias } from './scripts/aliases.mjs';

export default defineConfig({
  resolve: { alias: workspaceAlias },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'packages/*/test/**/*.test.ts', 'tools/*/test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['packages/*/src/**/*.ts', 'tools/*/src/**/*.ts'],
      exclude: ['**/index.ts', 'packages/app/**', 'packages/engine/src/render/babylon/**'],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
