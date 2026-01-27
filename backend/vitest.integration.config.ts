import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.int.test.ts'],
    testTimeout: 30000, // 30 seconds for API calls
    hookTimeout: 30000,
  },
});
