import { ZodError } from 'zod';
import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

export function zodDetails(error) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(body)',
    message: issue.message,
  }));
}

const MULTER_MESSAGES = {
  LIMIT_FILE_SIZE: 'File is too large',
  LIMIT_FILE_COUNT: 'Too many files',
  LIMIT_UNEXPECTED_FILE: 'Unexpected file field',
};

// Central error handler: every failure leaves the API as
//   { error: { code, message, details? } }
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  let status = 500;
  let code = 'INTERNAL_ERROR';
  let message = 'Something went wrong. Please try again.';
  let details;

  if (err instanceof ApiError) {
    ({ status, code, message, details } = err);
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Validation failed';
    details = zodDetails(err);
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'INVALID_JSON';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (err?.name === 'MulterError') {
    status = 400;
    code = 'UPLOAD_ERROR';
    message = MULTER_MESSAGES[err.code] ?? err.message;
  } else if (err?.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      status = 409;
      code = 'DUPLICATE';
      message = 'A record with these values already exists';
    } else if (err.code === 'P2025') {
      status = 404;
      code = 'NOT_FOUND';
      message = 'Record not found';
    }
  }

  if (status >= 500) {
    // Never leak internals to clients; log the full error server-side.
    console.error(err);
    if (env.NODE_ENV === 'production') {
      message = 'Something went wrong. Please try again.';
      details = undefined;
    }
  }

  const body = { error: { code, message } };
  if (details !== undefined) body.error.details = details;
  res.status(status).json(body);
}
