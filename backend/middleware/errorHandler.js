// middleware/errorHandler.js
// ─────────────────────────────────────────────────────────────────
//  Global error handler — catches anything thrown from controllers.
//  Always returns a consistent JSON shape.
// ─────────────────────────────────────────────────────────────────

const errorHandler = (err, req, res, next) => {
  console.error(`[ERROR] ${req.method} ${req.originalUrl}:`, err);

  // Validation errors from express-validator
  if (err.type === "validation") {
    return res.status(422).json({ success: false, message: "Validation failed", errors: err.errors });
  }

  // Supabase / DB constraint errors
  if (err.code === "23505") {
    return res.status(409).json({ success: false, message: "Duplicate entry — record already exists" });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

// Convenience: create an error with a status code
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

module.exports = { errorHandler, createError };