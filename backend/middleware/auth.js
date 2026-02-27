// middleware/auth.js
// ─────────────────────────────────────────────────────────────────
//  JWT auth middleware – verifies Supabase JWTs directly via
//  the Supabase admin client's getUser() so no JWT_SECRET needed.
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");

// ── Core token verifier ──────────────────────────────────────────
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // Verify with Supabase (handles signature + expiry automatically)
    const { data: { user: supaUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !supaUser) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // Fetch full user profile from DB (includes role, hospital_id, etc.)
    const { data: user, error: dbError } = await supabase
      .from("users")
      .select("id, full_name, email, role, hospital_id, is_active")
      .eq("id", supaUser.id)
      .single();

    if (dbError || !user) {
      return res.status(401).json({ success: false, message: "User profile not found" });
    }
    if (!user.is_active) {
      return res.status(403).json({ success: false, message: "Account deactivated" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ success: false, message: "Authentication failed" });
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

const requireAdmin = requireRole("admin");
const requireDriver = requireRole("driver");
const requireHospitalStaff = requireRole("admin", "hospital_staff");
const requireAny = requireRole("admin", "hospital_staff", "driver", "patient");

module.exports = { verifyToken, requireAdmin, requireDriver, requireHospitalStaff, requireRole, requireAny };