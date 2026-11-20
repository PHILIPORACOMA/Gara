import { z } from 'zod';

const email = z
  .string({ error: 'Email is required' })
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address'));

// bcrypt only uses the first 72 bytes, so cap the length instead of silently truncating.
const password = z
  .string({ error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters');

const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s-]{6,19}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal('').transform(() => undefined));

export const registerBody = z.object({
  name: z.string({ error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(80),
  email,
  password,
  phone,
  // Admin accounts come from the seed only.
  role: z.enum(['CUSTOMER', 'PROFESSIONAL'], { error: 'Choose customer or professional' }),
});

export const loginBody = z.object({
  email,
  password: z.string({ error: 'Password is required' }).min(1, 'Password is required'),
});
