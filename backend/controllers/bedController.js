// controllers/bedController.js
// ─────────────────────────────────────────────────────────────────
//  MODULE 2: BED BOOKING
//
//  Endpoints:
//   GET  /api/beds                   → list beds (filterable)
//   POST /api/beds/book              → patient books a bed
//   GET  /api/beds/bookings          → staff: all bookings
//   GET  /api/beds/bookings/:id      → booking detail
//   PUT  /api/beds/bookings/:id/status → staff: update booking status
//   GET  /api/beds/availability      → public: hospital bed counts
//   POST /api/beds                   → admin: add a bed
//   PUT  /api/beds/:id               → admin: update bed info
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── GET bed availability summary (public) ───────────────────────
const getBedAvailability = async (req, res, next) => {
  try {
    const { city, bed_type } = req.query;

    let query = supabase
      .from("hospitals")
      .select("id, name, city, address, latitude, longitude, total_beds, available_beds, total_icu, available_icu, total_nicu, available_nicu, opd_queue_count")
      .eq("is_active", true);

    if (city) query = query.ilike("city", `%${city}%`);

    const { data: hospitals, error } = await query;
    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, hospitals });
  } catch (err) {
    next(err);
  }
};

// ── GET beds list (filterable by hospital, type, status) ─────────
const listBeds = async (req, res, next) => {
  try {
    const { hospital_id, bed_type, status, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("beds")
      .select("*, hospitals(name, city)", { count: "exact" })
      .order("bed_number")
      .range(offset, offset + limit - 1);

    if (hospital_id) query = query.eq("hospital_id", hospital_id);
    if (bed_type)    query = query.eq("bed_type", bed_type);
    if (status)      query = query.eq("status", status);

    const { data: beds, count, error } = await query;
    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, total: count, beds });
  } catch (err) {
    next(err);
  }
};

// ── POST book a bed ──────────────────────────────────────────────
//  1. Verify patient has a profile
//  2. Find an available bed of requested type in the hospital
//     (or use a specific bed_id if provided)
//  3. Insert booking (trigger auto-marks bed as reserved)
//  4. Emit socket event for real-time update
const bookBed = async (req, res, next) => {
  try {
    const {
      hospital_id,
      bed_id,          // optional: specific bed requested
      bed_type = "general",
      booking_type = "routine",
      reason_for_admission,
      attending_doctor,
      notes,
    } = req.body;

    if (!hospital_id) throw createError("hospital_id is required");

    // Get patient profile
    const { data: profile, error: profileError } = await supabase
      .from("patient_profiles")
      .select("id, priority_level")
      .eq("user_id", req.user.id)
      .single();

    if (profileError || !profile) throw createError("Complete your patient profile first", 400);

    // Check for existing active booking (prevent double booking)
    const { data: activeBooking } = await supabase
      .from("bed_bookings")
      .select("id")
      .eq("patient_id", profile.id)
      .in("status", ["pending", "confirmed", "admitted"])
      .maybeSingle();

    if (activeBooking) {
      throw createError("You already have an active booking. Discharge first.", 409);
    }

    // Find an available bed
    let targetBedId = bed_id;
    if (!targetBedId) {
      const { data: availableBed, error: bedError } = await supabase
        .from("beds")
        .select("id")
        .eq("hospital_id", hospital_id)
        .eq("bed_type", bed_type)
        .eq("status", "available")
        .limit(1)
        .single();

      if (bedError || !availableBed) {
        throw createError(`No available ${bed_type} beds at this hospital`, 404);
      }
      targetBedId = availableBed.id;
    } else {
      // Verify specific bed is available
      const { data: bed } = await supabase
        .from("beds")
        .select("status")
        .eq("id", targetBedId)
        .single();

      if (!bed || bed.status !== "available") {
        throw createError("Requested bed is not available", 409);
      }
    }

    // Insert booking
    const { data: booking, error: bookingError } = await supabase
      .from("bed_bookings")
      .insert({
        patient_id: profile.id,
        hospital_id,
        bed_id: targetBedId,
        booking_type:
          profile.priority_level === "emergency" ? "emergency" : booking_type,
        status: "pending",
        reason_for_admission,
        attending_doctor,
        notes,
      })
      .select(`
        *,
        hospitals(name, address, city),
        beds(bed_number, bed_type, floor, ward)
      `)
      .single();

    if (bookingError) throw createError(bookingError.message);

    // Emit socket event so frontend updates instantly
    const io = req.app.get("io");
    if (io) {
      io.to(`hospital_${hospital_id}`).emit("bed_update", {
        event: "bed_booked",
        hospital_id,
        bed_id: targetBedId,
        booking_id: booking.id,
      });
    }

    return res.status(201).json({ success: true, message: "Bed booked successfully", booking });
  } catch (err) {
    next(err);
  }
};

// ── GET all bookings (staff/admin) ───────────────────────────────
const listBookings = async (req, res, next) => {
  try {
    const { hospital_id, status, booking_type, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("bed_bookings")
      .select(`
        id, booking_type, status, admitted_at, discharged_at, created_at,
        reason_for_admission, attending_doctor,
        patient_profiles (id, priority_level, users(full_name, phone)),
        hospitals (id, name, city),
        beds (bed_number, bed_type, floor, ward)
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Staff can only see their hospital's bookings
    if (req.user.role === "hospital_staff") {
      query = query.eq("hospital_id", req.user.hospital_id);
    } else if (hospital_id) {
      query = query.eq("hospital_id", hospital_id);
    }

    if (status)       query = query.eq("status", status);
    if (booking_type) query = query.eq("booking_type", booking_type);

    const { data: bookings, count, error } = await query;
    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, total: count, bookings });
  } catch (err) {
    next(err);
  }
};

// ── GET single booking detail ────────────────────────────────────
const getBookingById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: booking, error } = await supabase
      .from("bed_bookings")
      .select(`
        *,
        patient_profiles (*, users(full_name, email, phone)),
        hospitals (id, name, address, city, phone),
        beds (*)
      `)
      .eq("id", id)
      .single();

    if (error || !booking) throw createError("Booking not found", 404);

    return res.status(200).json({ success: true, booking });
  } catch (err) {
    next(err);
  }
};

// ── PUT update booking status (staff/admin) ──────────────────────
//  Valid transitions: pending→confirmed→admitted→discharged | any→cancelled
const updateBookingStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, admitted_at, discharged_at, notes, attending_doctor } = req.body;

    const validStatuses = ["pending", "confirmed", "admitted", "discharged", "cancelled"];
    if (!validStatuses.includes(status)) {
      throw createError(`status must be one of: ${validStatuses.join(", ")}`);
    }

    const updates = { status };
    if (status === "admitted")   updates.admitted_at = admitted_at || new Date().toISOString();
    if (status === "discharged") updates.discharged_at = discharged_at || new Date().toISOString();
    if (notes)            updates.notes = notes;
    if (attending_doctor) updates.attending_doctor = attending_doctor;

    const { data: booking, error } = await supabase
      .from("bed_bookings")
      .update(updates)
      .eq("id", id)
      .select(`
        *,
        hospitals(id, name),
        beds(bed_number, bed_type)
      `)
      .single();

    if (error) throw createError(error.message);

    // Emit real-time update
    const io = req.app.get("io");
    if (io) {
      io.to(`hospital_${booking.hospital_id}`).emit("bed_update", {
        event: "booking_status_changed",
        booking_id: id,
        new_status: status,
        hospital_id: booking.hospital_id,
      });
    }

    return res.status(200).json({ success: true, message: "Booking updated", booking });
  } catch (err) {
    next(err);
  }
};

// ── POST add a bed (admin) ───────────────────────────────────────
const addBed = async (req, res, next) => {
  try {
    const { hospital_id, bed_number, bed_type, floor, ward, features } = req.body;

    if (!hospital_id || !bed_number || !bed_type) {
      throw createError("hospital_id, bed_number, and bed_type are required");
    }

    const { data: bed, error } = await supabase
      .from("beds")
      .insert({ hospital_id, bed_number, bed_type, floor, ward, features })
      .select()
      .single();

    if (error) throw createError(error.message);

    // Update total beds count on hospital
    await supabase.rpc("update_hospital_total_beds", { hosp_id: hospital_id });

    return res.status(201).json({ success: true, message: "Bed added", bed });
  } catch (err) {
    next(err);
  }
};

// ── PUT update bed info/status (admin/staff) ─────────────────────
const updateBed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, floor, ward, features, bed_number } = req.body;

    const updates = {};
    if (status)     updates.status = status;
    if (floor)      updates.floor = floor;
    if (ward)       updates.ward = ward;
    if (features)   updates.features = features;
    if (bed_number) updates.bed_number = bed_number;

    const { data: bed, error } = await supabase
      .from("beds")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw createError(error.message);

    return res.status(200).json({ success: true, message: "Bed updated", bed });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBedAvailability,
  listBeds,
  bookBed,
  listBookings,
  getBookingById,
  updateBookingStatus,
  addBed,
  updateBed,
};