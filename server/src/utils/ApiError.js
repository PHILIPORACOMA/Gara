// Every error the API returns has this shape:
//   { "error": { "code": "BOOKING_CONFLICT", "message": "...", "details": ... } }
// Throw an ApiError anywhere (controllers, services, middleware) and the central
// errorHandler turns it into that response.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message = 'Bad request', details) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static validation(details, message = 'Validation failed') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'You do not have access to this resource') {
    return new ApiError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message);
  }

  static conflict(message = 'Conflict', code = 'CONFLICT', details) {
    return new ApiError(409, code, message, details);
  }

  // The request is well-formed but not allowed in the current state
  // (e.g. a booking status transition that is not permitted).
  static unprocessable(message, code = 'UNPROCESSABLE', details) {
    return new ApiError(422, code, message, details);
  }
}
