import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4310),
  DATABASE_URL: z
    .string({ error: 'DATABASE_URL is required (see .env.example)' })
    .refine((v) => v.startsWith('mysql://'), 'DATABASE_URL must be a mysql:// URL'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required (see .env.example)' })
    .min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5310'),
  UPLOAD_DIR: z.string().default('./uploads'),
  // Demo/testing switch. Normally a pro can only mark a booking COMPLETED or NO_SHOW once the
  // appointment has started. Set to "true" to allow it earlier so the full flow can be tried
  // without waiting for the appointment time. Keep "false" in production.
  // Workbook v3 makes Gara a discovery and contact platform: no bookings or payments.
  // The booking, deposit, commission and review code stays in the repo but its routes and
  // jobs are switched off unless this is "true" (the full booking version is tag booking-mvp).
  FEATURE_BOOKINGS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  ALLOW_EARLY_COMPLETE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  console.error('Copy server/.env.example to server/.env and fill in the values.');
  process.exit(1);
}

export const env = {
  ...parsed.data,
  clientOrigins: parsed.data.CLIENT_ORIGIN.split(',').map((o) => o.trim()),
};
