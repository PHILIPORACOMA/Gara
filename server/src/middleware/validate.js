import { ApiError } from '../utils/ApiError.js';
import { zodDetails } from './errorHandler.js';

// validate({ body, query, params }) parses each part with its Zod schema.
// The parsed (trimmed, coerced, defaulted) values land on req.valid.{body,query,params};
// controllers read from there, never from the raw request.
// (Express 5 makes req.query read-only, so we do not overwrite the request.)
export const validate = (schemas) => (req, res, next) => {
  const valid = {};
  for (const key of ['params', 'query', 'body']) {
    const schema = schemas[key];
    if (!schema) continue;
    const input = key === 'body' ? (req.body ?? {}) : req[key];
    const result = schema.safeParse(input);
    if (!result.success) return next(ApiError.validation(zodDetails(result.error)));
    valid[key] = result.data;
  }
  req.valid = valid;
  next();
};
