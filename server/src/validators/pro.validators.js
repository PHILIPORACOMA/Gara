import { z } from 'zod';
import { AREAS, CATEGORIES, SERVICE_MODES } from '../config/constants.js';
import { isValidIsoDate, nowManila } from '../utils/time.js';

export const idParam = z.object({ id: z.coerce.number().int().positive() });

const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);
const unique = (arr) => [...new Set(arr)];

// Messenger or Facebook link: "m.me/marareyes", "https://www.facebook.com/marareyes.hair", ...
const MESSENGER_LINK = /^(https?:\/\/)?(www\.|m\.)?(m\.me|messenger\.com|facebook\.com|fb\.com)\/\S+$/i;
export const toHttpsUrl = (v) => (/^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : `https://${v}`);

// Philippine mobile number in any common spelling ("0917 123 4567", "+63 917-123-4567"),
// stored as +639171234567 so it works in tel: and sms: links.
const PH_MOBILE = /^(\+?63|0)9\d{9}$/;
export const toE164Ph = (v) => `+63${v.replace(/^(\+?63|0)/, '')}`;

export const messengerUrlField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .trim()
    .max(200)
    .regex(MESSENGER_LINK, 'Paste your Messenger link (m.me/yourpage) or your Facebook page link')
    .transform(toHttpsUrl)
    .optional(),
);

export const contactPhoneField = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(z.string().regex(PH_MOBILE, 'Enter a Philippine mobile number, like 0917 123 4567'))
    .transform(toE164Ph)
    .optional(),
);

export const profileBody = z
  .object({
    displayName: z.string({ error: 'Display name is required' }).trim().min(2, 'Display name must be at least 2 characters').max(60),
    bio: z.preprocess(emptyToUndefined, z.string().trim().max(1000, 'Bio must be at most 1000 characters').optional()),
    categories: z
      .array(z.enum(CATEGORIES), { error: 'Choose at least one category' })
      .min(1, 'Choose at least one category')
      .transform(unique),
    areas: z
      .array(z.enum(AREAS), { error: 'Choose at least one area' })
      .min(1, 'Choose at least one area')
      .transform(unique),
    serviceMode: z.enum(SERVICE_MODES, { error: 'Choose home service, in-store or both' }),
    storeAddress: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
    travelFee: z.coerce
      .number({ error: 'Enter a valid amount' })
      .min(0, 'Travel fee cannot be negative')
      .max(5000, 'Travel fee must be at most 5,000')
      .default(0),
    messengerUrl: messengerUrlField,
    contactPhone: contactPhoneField,
  })
  .superRefine((v, ctx) => {
    if ((v.serviceMode === 'STORE' || v.serviceMode === 'BOTH') && !v.storeAddress) {
      ctx.addIssue({ code: 'custom', path: ['storeAddress'], message: 'Enter your in-store address' });
    }
  });

export const serviceBody = z.object({
  name: z.string({ error: 'Service name is required' }).trim().min(2, 'Name must be at least 2 characters').max(80),
  category: z.enum(CATEGORIES, { error: 'Choose a category' }),
  price: z.coerce
    .number({ error: 'Enter a valid price' })
    .min(1, 'Price must be at least 1')
    .max(100000, 'Price must be at most 100,000'),
  durationMin: z.coerce
    .number({ error: 'Enter a valid duration' })
    .int('Duration must be a whole number of minutes')
    .min(15, 'Duration must be at least 15 minutes')
    .max(720, 'Duration must be at most 12 hours')
    .refine((v) => v % 5 === 0, 'Duration must be a multiple of 5 minutes'),
  description: z.preprocess(emptyToUndefined, z.string().trim().max(500, 'Description must be at most 500 characters').optional()),
});

const minutes = (label) =>
  z.coerce
    .number({ error: `${label} is required` })
    .int()
    .min(0)
    .max(1440)
    .refine((v) => v % 15 === 0, 'Times must be on a 15-minute step');

// Returns human-readable problems: bad ranges and overlapping windows on the same day.
// Exported separately so it can be unit tested.
export function findAvailabilityProblems(rules) {
  const problems = [];
  const byDay = new Map();
  for (const r of rules) {
    if (r.endMin <= r.startMin) problems.push({ dayOfWeek: r.dayOfWeek, message: 'End time must be after start time' });
    if (!byDay.has(r.dayOfWeek)) byDay.set(r.dayOfWeek, []);
    byDay.get(r.dayOfWeek).push(r);
  }
  for (const [dayOfWeek, list] of byDay) {
    const sorted = [...list].sort((a, b) => a.startMin - b.startMin);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i].startMin < sorted[i - 1].endMin) {
        problems.push({ dayOfWeek, message: 'Time windows on the same day cannot overlap' });
        break;
      }
    }
  }
  return problems;
}

export const availabilityBody = z
  .object({
    rules: z
      .array(
        z.object({
          dayOfWeek: z.coerce.number().int().min(1, 'Invalid day').max(7, 'Invalid day'),
          startMin: minutes('Start time'),
          endMin: minutes('End time'),
        }),
      )
      .max(70, 'Too many time windows'),
  })
  .superRefine((v, ctx) => {
    for (const problem of findAvailabilityProblems(v.rules)) {
      ctx.addIssue({ code: 'custom', path: ['rules'], message: problem.message });
    }
  });

export const blockedDateBody = z.object({
  date: z
    .string({ error: 'Date is required' })
    .refine(isValidIsoDate, 'Enter a valid date (YYYY-MM-DD)')
    .refine((d) => d >= nowManila().toISODate(), 'Choose today or a future date'),
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
});

export const rejectBody = z.object({
  reason: z.string({ error: 'Give a reason' }).trim().min(5, 'Reason must be at least 5 characters').max(300),
});
