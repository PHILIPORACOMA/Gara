import { z } from 'zod';
import { AREAS, BOOKING_MODES, OCCASIONS } from '../config/constants.js';
import { CUSTOMER_TABS, PRO_TABS } from '../services/bookingStatus.js';

export { idParam } from './discovery.validators.js';

const emptyToUndefined = (v) => (v === '' || v === null ? undefined : v);

const quoteFields = {
  professionalId: z.coerce.number({ error: 'Choose a professional' }).int().positive(),
  serviceIds: z
    .array(z.coerce.number().int().positive(), { error: 'Choose at least one service' })
    .min(1, 'Choose at least one service')
    .max(10, 'Too many services')
    .transform((ids) => [...new Set(ids)]),
  mode: z.enum(BOOKING_MODES, { error: 'Choose home service or in-store' }),
};

export const quoteBody = z.object(quoteFields);

export const createBookingBody = z
  .object({
    ...quoteFields,
    startAt: z.iso.datetime({ error: 'Choose a time slot' }),
    address: z.preprocess(emptyToUndefined, z.string().trim().max(300).optional()),
    area: z.preprocess(emptyToUndefined, z.enum(AREAS, { error: 'Choose your area' }).optional()),
    occasion: z.preprocess(emptyToUndefined, z.enum(OCCASIONS).optional()),
    notes: z.preprocess(emptyToUndefined, z.string().trim().max(500, 'Notes must be at most 500 characters').optional()),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'HOME') {
      if (!v.address || v.address.length < 8) {
        ctx.addIssue({ code: 'custom', path: ['address'], message: 'Enter your full address (house/unit, street, barangay)' });
      }
      if (!v.area) ctx.addIssue({ code: 'custom', path: ['area'], message: 'Choose your area' });
    }
  });

// Sent as multipart/form-data next to the screenshot, so everything arrives as text.
export const depositBody = z.object({
  gcashRef: z
    .string({ error: 'Enter the GCash reference number' })
    .trim()
    .transform((s) => s.replace(/\s+/g, '').toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9-]{6,40}$/, 'Enter the reference number exactly as shown in GCash (6-40 letters or digits)')),
});

export const customerListQuery = z.object({ tab: z.enum([...Object.keys(CUSTOMER_TABS), 'all']).default('all') });
export const proListQuery = z.object({ tab: z.enum([...Object.keys(PRO_TABS), 'all']).default('requests') });

export const reviewBody = z.object({
  rating: z.coerce
    .number({ error: 'Choose a star rating' })
    .int('Choose a whole number of stars')
    .min(1, 'Choose a rating from 1 to 5')
    .max(5, 'Choose a rating from 1 to 5'),
  comment: z.preprocess(emptyToUndefined, z.string().trim().max(1000, 'Comment must be at most 1000 characters').optional()),
});

export const declineBody = z.object({
  reason: z.preprocess(emptyToUndefined, z.string().trim().max(200, 'Reason must be at most 200 characters').optional()),
});

export const depositRejectBody = z.object({
  note: z.string({ error: 'Tell the customer what was wrong' }).trim().min(5, 'Give a reason of at least 5 characters').max(200),
});

export const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export const calendarQuery = z.object({
  month: z.string({ error: 'Month is required' }).regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use the format YYYY-MM'),
});

export const adminBookingsQuery = z.object({
  status: z.preprocess(emptyToUndefined, z.enum(['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'DECLINED', 'NO_SHOW']).optional()),
  professionalId: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  from: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional()),
  to: z.preprocess(emptyToUndefined, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional()),
  refund: z.preprocess(emptyToUndefined, z.enum(['needed', 'resolved']).optional()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
