// controllers/patientController.js
// ─────────────────────────────────────────────────────────────────
//  MODULE 1: PATIENT PROFILE
//
//  Endpoints:
//   GET    /api/patients/profile          → get own profile
//   PUT    /api/patients/profile          → update own profile
//   GET    /api/patients/:id              → admin: get any patient
//   GET    /api/patients                  → admin/staff: list all patients
//   PUT    /api/patients/:id/priority     → admin/staff: set priority level
//   GET    /api/patients/profile/bookings → patient: their booking history
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── GET own profile ──────────────────────────────────────────────
const getMyProfile = async (req, res, next) => {
  try {
    const { data: profile, error } = await supabase
      .from("patient_profiles")
      .select(`
        *,
        users (id, full_name, email, phone, created_at)
      `)
      .eq("user_id", req.user.id)
      .single();

    if (error || !profile) throw createError("Patient profile not found", 404);

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
};

// ── UPDATE own profile ───────────────────────────────────────────
const updateMyProfile = async (req, res, next) => {
  try {
    const allowedFields = [
      "date_of_birth",
      "gender",
      "blood_group",
      "allergies",
      "chronic_diseases",
      "emergency_contact_name",
      "emergency_contact_phone",
      "aadhar_number",
      "insurance_id",
      "address",
      "city",
      "medical_notes",
    ];

    // Filter only allowed fields from body
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      throw createError("No valid fields to update");
    }

    const { data: profile, error } = await supabase
      .from("patient_profiles")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, message: "Profile updated", profile });
  } catch (err) {
    next(err);
  }
};

// ── GET any patient by ID (admin/staff only) ─────────────────────
const getPatientById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: profile, error } = await supabase
      .from("patient_profiles")
      .select(`
        *,
        users (id, full_name, email, phone, created_at)
      `)
      .eq("id", id)
      .single();

    if (error || !profile) throw createError("Patient not found", 404);

    return res.status(200).json({ success: true, profile });
  } catch (err) {
    next(err);
  }
};

// ── LIST all patients (admin/staff) ─────────────────────────────
const listPatients = async (req, res, next) => {
  try {
    const { priority_level, blood_group, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("patient_profiles")
      .select(`
        id, priority_level, blood_group, gender,
        users (id, full_name, email, phone)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (priority_level) query = query.eq("priority_level", priority_level);
    if (blood_group)    query = query.eq("blood_group", blood_group);

    const { data: patients, count, error } = await query;
    if (error) throw createError(error.message);

    return res.status(200).json({
      success: true,
      total: count,
      page: Number(page),
      limit: Number(limit),
      patients,
    });
  } catch (err) {
    next(err);
  }
};

// ── SET priority level (admin/staff only) ────────────────────────
const setPatientPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { priority_level } = req.body;

    const valid = ["emergency", "urgent", "routine"];
    if (!valid.includes(priority_level)) {
      throw createError(`priority_level must be one of: ${valid.join(", ")}`);
    }

    const { data, error } = await supabase
      .from("patient_profiles")
      .update({ priority_level, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, message: "Priority updated", profile: data });
  } catch (err) {
    next(err);
  }
};

// ── GET own booking history ──────────────────────────────────────
const getMyBookings = async (req, res, next) => {
  try {
    // First get patient_profile id for this user
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("id")
      .eq("user_id", req.user.id)
      .single();

    if (!profile) throw createError("Patient profile not found", 404);

    const { data: bookings, error } = await supabase
      .from("bed_bookings")
      .select(`
        id, booking_type, status, admitted_at, discharged_at,
        reason_for_admission, attending_doctor, notes, created_at,
        hospitals (id, name, address, city),
        beds (id, bed_number, bed_type, floor, ward)
      `)
      .eq("patient_id", profile.id)
      .order("created_at", { ascending: false });

    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, bookings });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMyProfile,
  updateMyProfile,
  getPatientById,
  listPatients,
  setPatientPriority,
  getMyBookings,
};