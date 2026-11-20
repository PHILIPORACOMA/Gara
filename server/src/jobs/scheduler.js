import cron from 'node-cron';
import { TIMEZONE } from '../config/constants.js';
import { runMaintenance } from '../services/maintenance.service.js';

async function tick() {
  try {
    const result = await runMaintenance();
    if (result.expired || result.created) console.log('[jobs] maintenance:', result);
  } catch (err) {
    // A failed run must never crash the API; the next run tries again.
    console.error('[jobs] maintenance failed:', err);
  }
}

// Every 5 minutes: expire unpaid holds and create day-before reminders. Runs once at startup too.
export function startScheduler() {
  const task = cron.schedule('*/5 * * * *', tick, { timezone: TIMEZONE });
  tick();
  return task;
}
