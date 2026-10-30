import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Worker threads keep per-file isolation (vmThreads breaks WebCrypto/CJS
    // interop, and sharing a jsdom across files leaks router listeners).
    pool: 'threads',
    testTimeout: 20000,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
    setupFiles: ['./tests/setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: { statements: 82, branches: 70, functions: 82, lines: 85 },
      // Worker entry points only run in a browser; their pure logic is tested
      // through the main-thread fallbacks, and E2E exercises the real worker.
      exclude: ['scripts/**', 'tests/**', 'dist/**', '*.config.js', 'src/**/*.worker.js', 'src/**/*.worker-core.js']
    }
  }
})
