const { ZodError } = require('zod');

/**
 * Central error handler — must be registered LAST in Express.
 */
const errorHandler = (err, req, res, next) => {
  // Zod validation errors → 422
  if (err instanceof ZodError) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  // PostgreSQL unique violation → 409
  if (err.code === '23505') {
    const detail = err.detail || '';
    const field = detail.match(/\(([^)]+)\)/)?.[1] || 'field';
    return res.status(409).json({
      success: false,
      message: `A record with this ${field} already exists`,
    });
  }

  // PostgreSQL FK violation → 400
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist',
    });
  }

  // PostgreSQL check constraint → 400
  if (err.code === '23514') {
    return res.status(400).json({
      success: false,
      message: 'Data violates a constraint: ' + (err.constraint || ''),
    });
  }

  // Custom app errors
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
  }

  // Fallback — log details in dev, hide in prod
  console.error('[ERROR]', err);
  return res.status(500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred'
      : err.message,
  });
};

/**
 * Helper to create typed app errors.
 */
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, createError };
