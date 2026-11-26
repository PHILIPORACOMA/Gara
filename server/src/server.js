import fs from 'node:fs';
import path from 'node:path';
import app from './app.js';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { startScheduler } from './jobs/scheduler.js';

for (const dir of ['public', 'private']) {
  fs.mkdirSync(path.resolve(env.UPLOAD_DIR, dir), { recursive: true });
}

let scheduler;
const server = app.listen(env.PORT, () => {
  console.log(`Gara API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  // The jobs (unpaid-hold expiry, day-before reminders) only concern bookings.
  if (env.FEATURE_BOOKINGS) scheduler = startScheduler();
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down...`);
  scheduler?.stop();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
