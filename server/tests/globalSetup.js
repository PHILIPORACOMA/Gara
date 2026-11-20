import 'dotenv/config';
import { execSync } from 'node:child_process';

// Prepares the separate test database before any integration test runs:
// creates it if missing and applies all migrations. If MySQL is not reachable, the
// integration tests are skipped (unit tests still run) with a clear message.
export default function setup({ provide }) {
  const testUrl = process.env.DATABASE_URL_TEST;
  const mainUrl = process.env.DATABASE_URL;

  if (!testUrl) {
    console.warn('\n[tests] DATABASE_URL_TEST is not set: integration tests will be skipped.\n');
    provide('testDbReady', false);
    return;
  }
  // The integration tests DELETE every row. Never let them near the real database.
  if (testUrl === mainUrl) throw new Error('DATABASE_URL_TEST must be a different database from DATABASE_URL.');
  const dbName = new URL(testUrl).pathname.slice(1);
  if (!/^[A-Za-z0-9_]*test[A-Za-z0-9_]*$/i.test(dbName)) {
    throw new Error(`The test database name must contain "test" (got "${dbName}"). Refusing to run integration tests.`);
  }

  try {
    // Create the test database if needed, using the main connection (same server).
    if (mainUrl) {
      execSync('npx prisma db execute --stdin --schema prisma/schema.prisma', {
        input: `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
        env: process.env,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    }
    execSync('npx prisma migrate deploy', {
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    provide('testDbReady', true);
  } catch (err) {
    console.warn(`\n[tests] Could not prepare the test database "${dbName}": integration tests will be skipped.\n${String(err.stderr ?? err.message).split('\n').slice(0, 4).join('\n')}\n`);
    provide('testDbReady', false);
  }
}
