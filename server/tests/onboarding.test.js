import { describe, it, expect } from 'vitest';
import { buildChecklist } from '../src/services/onboarding.js';
import { availabilityBody, findAvailabilityProblems, profileBody, serviceBody } from '../src/validators/pro.validators.js';

const complete = {
  profile: { displayName: 'Mara Salon', serviceMode: 'HOME', storeAddress: null },
  categoryCount: 1,
  areaCount: 2,
  activeServiceCount: 1,
  availabilityCount: 5,
  portfolioCount: 3,
  hasIdImage: true,
};

describe('onboarding checklist', () => {
  it('is complete when every step is done', () => {
    const result = buildChecklist(complete);
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('lists exactly what is missing', () => {
    const result = buildChecklist({ ...complete, activeServiceCount: 0, hasIdImage: false });
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['services', 'id']);
  });

  it('requires a store address when the pro works in-store', () => {
    const store = { ...complete.profile, serviceMode: 'BOTH' };
    expect(buildChecklist({ ...complete, profile: store }).missing).toEqual(['profile']);
    expect(buildChecklist({ ...complete, profile: { ...store, storeAddress: '12 Colon St' } }).complete).toBe(true);
  });
});

describe('availability validation', () => {
  it('flags overlapping windows on the same day only', () => {
    const rules = [
      { dayOfWeek: 1, startMin: 540, endMin: 720 },
      { dayOfWeek: 1, startMin: 690, endMin: 900 },
      { dayOfWeek: 2, startMin: 540, endMin: 720 },
    ];
    const problems = findAvailabilityProblems(rules);
    expect(problems).toHaveLength(1);
    expect(problems[0].dayOfWeek).toBe(1);
  });

  it('allows back-to-back windows and split days', () => {
    const rules = [
      { dayOfWeek: 3, startMin: 540, endMin: 720 },
      { dayOfWeek: 3, startMin: 720, endMin: 1080 },
    ];
    expect(findAvailabilityProblems(rules)).toEqual([]);
  });

  it('rejects end before start and off-grid times through the schema', () => {
    expect(availabilityBody.safeParse({ rules: [{ dayOfWeek: 1, startMin: 600, endMin: 540 }] }).success).toBe(false);
    expect(availabilityBody.safeParse({ rules: [{ dayOfWeek: 1, startMin: 545, endMin: 600 }] }).success).toBe(false);
    expect(availabilityBody.safeParse({ rules: [{ dayOfWeek: 1, startMin: 540, endMin: 1080 }] }).success).toBe(true);
  });
});

describe('profile and service validation', () => {
  const base = { displayName: 'Mara', categories: ['HAIR'], areas: ['Cebu City'], serviceMode: 'HOME', travelFee: '150' };

  it('coerces the travel fee and removes duplicate categories', () => {
    const parsed = profileBody.parse({ ...base, categories: ['HAIR', 'HAIR', 'NAILS'] });
    expect(parsed.travelFee).toBe(150);
    expect(parsed.categories).toEqual(['HAIR', 'NAILS']);
  });

  it('requires a store address for in-store service', () => {
    const result = profileBody.safeParse({ ...base, serviceMode: 'STORE' });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].path).toEqual(['storeAddress']);
  });

  it('rejects an area outside the Cebu list', () => {
    expect(profileBody.safeParse({ ...base, areas: ['Manila'] }).success).toBe(false);
  });

  it('validates service price and duration', () => {
    const ok = { name: 'Gel manicure', category: 'NAILS', price: '650', durationMin: '60' };
    expect(serviceBody.parse(ok)).toMatchObject({ price: 650, durationMin: 60 });
    expect(serviceBody.safeParse({ ...ok, durationMin: 7 }).success).toBe(false);
    expect(serviceBody.safeParse({ ...ok, price: 0 }).success).toBe(false);
  });
});
