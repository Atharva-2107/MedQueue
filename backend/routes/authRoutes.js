// routes/authRoutes.js
const express = require("express");
const router  = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { verifyToken } = require("../middleware/auth");
const { body, validationResult } = require("express-validator");

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({ success: false, errors: errors.array() });
  }
  next();
};

// POST /api/auth/register
router.post(
  "/register",
  [
    body("full_name").trim().notEmpty().withMessage("Full name is required"),
    body("email").isEmail().normalizeEmail().withMessage("Valid email required"),
    body("phone").trim().notEmpty().withMessage("Phone is required"),
    body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 chars"),
    body("role").optional().isIn(["patient", "admin", "driver", "hospital_staff"]),
  ],
  validate,
  register
);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").notEmpty(),
  ],
  validate,
  login
);

// GET /api/auth/me
router.get("/me", verifyToken, getMe);

module.exports = router;