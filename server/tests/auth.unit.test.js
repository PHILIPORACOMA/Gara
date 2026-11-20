import { describe, it, expect, vi } from 'vitest';
import { registerBody, loginBody } from '../src/validators/auth.validators.js';
import { requireRole } from '../src/middleware/auth.js';
import { validate } from '../src/middleware/validate.js';
import { ApiError } from '../src/utils/ApiError.js';

const validRegister = { name: 'Ana Reyes', email: ' Ana@Example.com ', password: 'secret123', role: 'CUSTOMER' };

describe('register validation', () => {
  it('trims and lowercases the email', () => {
    const parsed = registerBody.parse(validRegister);
    expect(parsed.email).toBe('ana@example.com');
  });

  it('rejects ADMIN: admin accounts come from the seed only', () => {
    const result = registerBody.safeParse({ ...validRegister, role: 'ADMIN' });
    expect(result.success).toBe(false);
  });

  it('gives field-level messages for a short password and bad email', () => {
    const result = registerBody.safeParse({ ...validRegister, email: 'nope', password: 'short' });
    expect(result.success).toBe(false);
    const messages = result.error.issues.map((i) => i.message);
    expect(messages).toContain('Enter a valid email address');
    expect(messages).toContain('Password must be at least 8 characters');
  });

  it('treats an empty phone as not provided', () => {
    expect(registerBody.parse({ ...validRegister, phone: '' }).phone).toBeUndefined();
  });
});

describe('login validation', () => {
  it('requires a password', () => {
    expect(loginBody.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('requireRole', () => {
  const run = (user, ...roles) => {
    const next = vi.fn();
    requireRole(...roles)({ user }, {}, next);
    return next.mock.calls[0][0];
  };

  it('passes a user with an allowed role', () => {
    expect(run({ role: 'ADMIN' }, 'ADMIN')).toBeUndefined();
  });

  it('answers 403 FORBIDDEN for the wrong role', () => {
    const err = run({ role: 'CUSTOMER' }, 'ADMIN');
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });

  it('answers 401 when there is no user', () => {
    expect(run(undefined, 'ADMIN').status).toBe(401);
  });
});

describe('validate middleware', () => {
  it('stores parsed values on req.valid and reports failures as VALIDATION_ERROR', () => {
    const next = vi.fn();
    const req = { body: validRegister };
    validate({ body: registerBody })(req, {}, next);
    expect(req.valid.body.email).toBe('ana@example.com');
    expect(next).toHaveBeenCalledWith();

    const bad = vi.fn();
    validate({ body: registerBody })({ body: {} }, {}, bad);
    const err = bad.mock.calls[0][0];
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.details.length).toBeGreaterThan(0);
  });
});
