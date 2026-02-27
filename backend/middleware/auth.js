// middleware/auth.js
// ─────────────────────────────────────────────────────────────────
//  JWT auth middleware.
//  Every protected route calls verifyToken first.
//  Role-specific guards: requireAdmin, requireDriver, etc.
// ─────────────────────────────────────────────────────────────────
const jwt = require("jsonwebtoken");
const supabase = require("../config/supabase");

// ── Core token verifier ──────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Confirm user still exists and is active
    const { data: user, error } = await supabase
      .from("users")
      .select("id, full_name, email, role, hospital_id, is_active")
      .eq("id", decoded.id)
      .single();

    if (error || !user) {
      return res.status(401).json({ success: false, message: "User not found" });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ success: false, message: "Token expired" });
    }
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

// ── Role guards ──────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. Required role: ${roles.join(" or ")}`,
    });
  }
  next();
};

const requireAdmin        = requireRole("admin");
const requireDriver       = requireRole("driver");
const requireHospitalStaff = requireRole("admin", "hospital_staff");
const requireAny          = requireRole("admin", "hospital_staff", "driver", "patient");

module.exports = { verifyToken, requireAdmin, requireDriver, requireHospitalStaff, requireRole };