import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Test against workspace sources so tests don't need a build first.
    alias: {
      '@metro-tree-shaker/shake-report': path.resolve(import.meta.dirname, 'packages/shake-report/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'benchmarks/test/**/*.test.ts', 'fixtures/*.test.ts'],
  },
});
