import 'dotenv/config';
import { defineConfig } from 'vitest/config';

// Unit tests never touch the database. Integration tests (double-booking, commission, reviews)
// use DATABASE_URL_TEST, a separate database that the tests are allowed to wipe.
// tests/globalSetup.js creates and migrates it first.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    globalSetup: ['tests/globalSetup.js'],
    // Integration tests share one database, so test files run one after another.
    fileParallelism: false,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.DATABASE_URL_TEST ?? 'mysql://root:root@localhost:3306/gara_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret',
      ALLOW_EARLY_COMPLETE: 'false',
    },
  },
});
