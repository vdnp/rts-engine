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
      exclude: [
        '**/index.ts',
        'packages/app/**',
        // Gercek bir tarayici olmadan calistirilamaz; mantik saf modullerde
        // (input/pan.ts, camera.ts) tutuldugu icin bu dosyalar yalnizca DOM
        // olaylarini baglar. Babylon uygulamasi NullEngine ile test edilir,
        // bu yuzden disarida DEGİLDİR.
        'packages/engine/src/input/device.ts',
        'packages/engine/src/overlay.ts',
      ],
      thresholds: { lines: 70, functions: 70, branches: 70, statements: 70 },
    },
  },
});
