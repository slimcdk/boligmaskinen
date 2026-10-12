import { defineConfig } from 'vitest/config';

// Coverage is measured when asked for (npm test -- --coverage, as CI does); CI reads the json-summary
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
});
