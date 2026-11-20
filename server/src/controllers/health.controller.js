import { prisma } from '../lib/prisma.js';
import { TIMEZONE } from '../config/constants.js';

export function health(req, res) {
  res.json({ status: 'ok', service: 'gara-server', timezone: TIMEZONE, time: new Date().toISOString() });
}

// Also checks the database connection.
export async function healthDb(req, res) {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'connected' });
}
