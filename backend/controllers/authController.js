// controllers/authController.js
// ─────────────────────────────────────────────────────────────────
//  Handles registration and login.
//  Passwords are bcrypt-hashed before storing.
//  On login, returns a signed JWT + user details.
// ─────────────────────────────────────────────────────────────────
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── Helper: generate JWT ─────────────────────────────────────────
const signToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, hospital_id: user.hospital_id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

// ── POST /api/auth/register ──────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { full_name, email, phone, password, role = "patient", hospital_id } = req.body;

    // Check if email/phone already used
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .or(`email.eq.${email},phone.eq.${phone}`)
      .maybeSingle();

    if (existing) throw createError("Email or phone already registered", 409);

    // Hash password
    const password_hash = await bcrypt.hash(password, 12);

    // Insert user
    const { data: user, error } = await supabase
      .from("users")
      .insert({ full_name, email, phone, password_hash, role, hospital_id: hospital_id || null })
      .select("id, full_name, email, phone, role, hospital_id")
      .single();

    if (error) throw createError(error.message);

    // If patient, auto-create empty patient profile
    if (role === "patient") {
      await supabase.from("patient_profiles").insert({ user_id: user.id });
    }

    const token = signToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/auth/login ─────────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const { data: user, error } = await supabase
      .from("users")
      .select("id, full_name, email, phone, role, hospital_id, password_hash, is_active")
      .eq("email", email)
      .single();

    if (error || !user) throw createError("Invalid credentials", 401);
    if (!user.is_active) throw createError("Account deactivated. Contact admin.", 403);

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) throw createError("Invalid credentials", 401);

    const { password_hash, ...safeUser } = user;
    const token = signToken(safeUser);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: safeUser,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────────
const getMe = async (req, res, next) => {
  try {
    // req.user is set by verifyToken middleware
    return res.status(200).json({ success: true, user: req.user });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, getMe };