import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['junit', { outputFile: 'test-results/e2e-results.xml' }]
  ],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure'
  }
})
