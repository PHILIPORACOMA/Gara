import { z } from 'zod';
import { AREAS, BOOKING_MODES, CATEGORIES } from '../config/constants.js';
import { isValidIsoDate } from '../utils/time.js';

const optional = (schema) => z.preprocess((v) => (v === '' || v === undefined ? undefined : v), schema.optional());
const isoDate = z.string().refine(isValidIsoDate, 'Enter a valid date (YYYY-MM-DD)');

export const idParam = z.object({ id: z.coerce.number().int().positive() });

export const searchQuery = z
  .object({
    category: optional(z.enum(CATEGORIES, { error: 'Unknown category' })),
    area: optional(z.enum(AREAS, { error: 'Unknown area' })),
    date: optional(isoDate),
    minPrice: optional(z.coerce.number({ error: 'Enter a valid price' }).min(0)),
    maxPrice: optional(z.coerce.number({ error: 'Enter a valid price' }).min(0)),
    // Query strings are text: "false" must not become true.
    homeOnly: optional(z.enum(['true', 'false']).transform((v) => v === 'true')),
    // "search" when the request comes from the Find a pro page (counted for metrics).
    source: optional(z.enum(['search'])),
  })
  .superRefine((q, ctx) => {
    if (q.minPrice != null && q.maxPrice != null && q.minPrice > q.maxPrice) {
      ctx.addIssue({ code: 'custom', path: ['maxPrice'], message: 'Maximum price must be at least the minimum price' });
    }
  });

export const slotsQuery = z.object({
  date: isoDate,
  mode: z.enum(BOOKING_MODES, { error: 'Choose home service or in-store' }),
  serviceIds: z
    .string({ error: 'Choose at least one service' })
    .transform((s) => s.split(',').map((x) => x.trim()).filter(Boolean))
    .pipe(
      z
        .array(z.coerce.number().int().positive())
        .min(1, 'Choose at least one service')
        .max(10, 'Too many services')
        .transform((ids) => [...new Set(ids)]),
    ),
});

export const reviewsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
