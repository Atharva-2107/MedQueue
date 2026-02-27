// controllers/dashboardController.js
// ─────────────────────────────────────────────────────────────────
//  Role-based dashboard data controller
//  Each function returns the exact data shape each role needs
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── PATIENT DASHBOARD ────────────────────────────────────────────
const getPatientDashboard = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Get patient profile
    const { data: profile, error: profileError } = await supabase
      .from("patient_profiles")
      .select(`*, users(full_name, email, phone)`)
      .eq("user_id", userId)
      .maybeSingle();

    if (profileError) throw createError(profileError.message);

    let bookings = [];
    let dispatches = [];
    let nearbyHospitals = [];

    if (profile) {
      // Active + recent bookings
      const { data: b } = await supabase
        .from("bed_bookings")
        .select(`
          id, booking_type, status, admitted_at, discharged_at,
          reason_for_admission, attending_doctor, created_at,
          hospitals(id, name, address, city, phone),
          beds(bed_number, bed_type, floor, ward)
        `)
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(5);
      bookings = b || [];

      // Ambulance dispatches
      const { data: d } = await supabase
        .from("ambulance_dispatches")
        .select(`
          id, status, priority, pickup_address, estimated_eta,
          created_at, actual_arrival,
          ambulances(vehicle_number, driver_name, driver_phone, ambulance_type, latitude, longitude)
        `)
        .eq("patient_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(3);
      dispatches = d || [];
    }

    // City-wide bed availability (public data)
    const { data: hospitals } = await supabase
      .from("hospitals")
      .select("id, name, city, address, latitude, longitude, available_beds, total_beds, available_icu, available_nicu, opd_queue_count")
      .eq("is_active", true)
      .order("available_beds", { ascending: false })
      .limit(5);
    nearbyHospitals = hospitals || [];

    // Available ambulances count
    const { count: availableAmbs } = await supabase
      .from("ambulances")
      .select("id", { count: "exact", head: true })
      .eq("status", "available")
      .eq("is_active", true);

    return res.status(200).json({
      success: true,
      role: "patient",
      profile_complete: !!profile?.blood_group,
      data: {
        profile,
        active_booking: bookings.find((b) => ["pending", "confirmed", "admitted"].includes(b.status)) || null,
        recent_bookings: bookings,
        recent_dispatches: dispatches,
        nearby_hospitals: nearbyHospitals,
        available_ambulances: availableAmbs || 0,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── ADMIN DASHBOARD ──────────────────────────────────────────────
const getAdminDashboard = async (req, res, next) => {
  try {
    // System-wide stats
    const [
      { data: hospitals },
      { data: ambStats },
      { count: totalPatients },
      { count: pendingBookings },
      { count: activeDispatches },
      { data: recentBookings },
      { data: recentDispatches },
      { data: bedLogs },
    ] = await Promise.all([
      supabase.from("hospitals")
        .select("id, name, city, total_beds, available_beds, total_icu, available_icu, total_nicu, available_nicu, opd_queue_count, updated_at")
        .eq("is_active", true),

      supabase.from("ambulances")
        .select("id, status, ambulance_type")
        .eq("is_active", true),

      supabase.from("patient_profiles")
        .select("id", { count: "exact", head: true }),

      supabase.from("bed_bookings")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "confirmed"]),

      supabase.from("ambulance_dispatches")
        .select("id", { count: "exact", head: true })
        .in("status", ["requested", "accepted", "en_route"]),

      supabase.from("bed_bookings")
        .select(`id, status, booking_type, created_at, hospitals(name), beds(bed_type), patient_profiles(users(full_name))`)
        .order("created_at", { ascending: false })
        .limit(8),

      supabase.from("ambulance_dispatches")
        .select(`id, status, priority, created_at, pickup_address, ambulances(vehicle_number), patient_profiles(users(full_name))`)
        .order("created_at", { ascending: false })
        .limit(6),

      supabase.from("bed_monitoring_logs")
        .select("hospital_id, available_beds, total_beds, recorded_at, hospitals(name)")
        .order("recorded_at", { ascending: false })
        .limit(24),
    ]);

    const ambSummary = {
      total: ambStats?.length || 0,
      available: ambStats?.filter((a) => a.status === "available").length || 0,
      dispatched: ambStats?.filter((a) => a.status === "dispatched").length || 0,
      maintenance: ambStats?.filter((a) => a.status === "maintenance").length || 0,
    };

    const systemTotals = (hospitals || []).reduce(
      (acc, h) => ({
        total_beds: acc.total_beds + h.total_beds,
        available_beds: acc.available_beds + h.available_beds,
        total_icu: acc.total_icu + h.total_icu,
        available_icu: acc.available_icu + h.available_icu,
        opd_total: acc.opd_total + h.opd_queue_count,
      }),
      { total_beds: 0, available_beds: 0, total_icu: 0, available_icu: 0, opd_total: 0 }
    );

    return res.status(200).json({
      success: true,
      role: "admin",
      data: {
        system_totals: systemTotals,
        ambulance_summary: ambSummary,
        total_patients: totalPatients || 0,
        pending_bookings: pendingBookings || 0,
        active_dispatches: activeDispatches || 0,
        hospitals: hospitals || [],
        recent_bookings: recentBookings || [],
        recent_dispatches: recentDispatches || [],
        bed_logs: bedLogs || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── HOSPITAL STAFF DASHBOARD ─────────────────────────────────────
const getStaffDashboard = async (req, res, next) => {
  try {
    const hospitalId = req.user.hospital_id;
    if (!hospitalId) throw createError("No hospital assigned to your account", 400);

    const [
      { data: hospital },
      { data: beds },
      { data: pendingBookings },
      { data: admittedPatients },
      { data: recentActivity },
    ] = await Promise.all([
      supabase.from("hospitals")
        .select("*")
        .eq("id", hospitalId)
        .single(),

      supabase.from("beds")
        .select("id, bed_number, bed_type, status, floor, ward")
        .eq("hospital_id", hospitalId)
        .order("bed_number"),

      supabase.from("bed_bookings")
        .select(`
          id, booking_type, status, created_at, reason_for_admission,
          beds(bed_number, bed_type),
          patient_profiles(priority_level, users(full_name, phone))
        `)
        .eq("hospital_id", hospitalId)
        .eq("status", "pending")
        .order("created_at"),

      supabase.from("bed_bookings")
        .select(`
          id, status, admitted_at, attending_doctor,
          beds(bed_number, bed_type, ward),
          patient_profiles(priority_level, blood_group, users(full_name, phone))
        `)
        .eq("hospital_id", hospitalId)
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false }),

      supabase.from("bed_bookings")
        .select(`
          id, status, booking_type, created_at, updated_at,
          beds(bed_number, bed_type),
          patient_profiles(users(full_name))
        `)
        .eq("hospital_id", hospitalId)
        .order("updated_at", { ascending: false })
        .limit(10),
    ]);

    // Bed breakdown
    const bedBreakdown = {};
    (beds || []).forEach(({ bed_type, status }) => {
      if (!bedBreakdown[bed_type]) bedBreakdown[bed_type] = { total: 0, available: 0, occupied: 0, reserved: 0 };
      bedBreakdown[bed_type].total++;
      bedBreakdown[bed_type][status] = (bedBreakdown[bed_type][status] || 0) + 1;
    });

    return res.status(200).json({
      success: true,
      role: "staff",
      data: {
        hospital,
        bed_breakdown: bedBreakdown,
        all_beds: beds || [],
        pending_bookings: pendingBookings || [],
        admitted_patients: admittedPatients || [],
        recent_activity: recentActivity || [],
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── AMBULANCE DRIVER DASHBOARD ───────────────────────────────────
const getDriverDashboard = async (req, res, next) => {
  try {
    // Find this driver's ambulance
    const { data: ambulance, error: ambError } = await supabase
      .from("ambulances")
      .select(`*, hospitals(name, address, city, phone)`)
      .eq("driver_id", req.user.id)
      .maybeSingle();

    if (ambError) throw createError(ambError.message);

    let currentDispatch = null;
    let completedToday = 0;
    let dispatchHistory = [];

    if (ambulance) {
      // Active dispatch
      const { data: active } = await supabase
        .from("ambulance_dispatches")
        .select(`
          *, 
          patient_profiles(blood_group, allergies, priority_level, emergency_contact_name, emergency_contact_phone, users(full_name, phone)),
          hospitals(name, address, latitude, longitude)
        `)
        .eq("ambulance_id", ambulance.id)
        .in("status", ["requested", "accepted", "en_route", "arrived"])
        .maybeSingle();
      currentDispatch = active;

      // Completed today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("ambulance_dispatches")
        .select("id", { count: "exact", head: true })
        .eq("ambulance_id", ambulance.id)
        .eq("status", "completed")
        .gte("completed_at", todayStart.toISOString());
      completedToday = count || 0;

      // History
      const { data: history } = await supabase
        .from("ambulance_dispatches")
        .select(`id, status, priority, pickup_address, created_at, completed_at, patient_profiles(users(full_name))`)
        .eq("ambulance_id", ambulance.id)
        .order("created_at", { ascending: false })
        .limit(10);
      dispatchHistory = history || [];
    }

    return res.status(200).json({
      success: true,
      role: "driver",
      data: {
        ambulance,
        current_dispatch: currentDispatch,
        completed_today: completedToday,
        dispatch_history: dispatchHistory,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ── PATIENT ONBOARDING: save complete profile ────────────────────
const savePatientOnboarding = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      date_of_birth, gender, blood_group,
      allergies, chronic_diseases,
      emergency_contact_name, emergency_contact_phone,
      aadhar_number, insurance_id,
      address, city, medical_notes,
    } = req.body;

    // Check if profile already exists
    const { data: existing } = await supabase
      .from("patient_profiles")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    const payload = {
      date_of_birth, gender, blood_group,
      allergies: Array.isArray(allergies) ? allergies : allergies?.split(",").map(s => s.trim()).filter(Boolean),
      chronic_diseases: Array.isArray(chronic_diseases) ? chronic_diseases : chronic_diseases?.split(",").map(s => s.trim()).filter(Boolean),
      emergency_contact_name, emergency_contact_phone,
      aadhar_number, insurance_id,
      address, city, medical_notes,
      updated_at: new Date().toISOString(),
    };

    let profile;
    if (existing) {
      const { data, error } = await supabase
        .from("patient_profiles")
        .update(payload)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw createError(error.message);
      profile = data;
    } else {
      const { data, error } = await supabase
        .from("patient_profiles")
        .insert({ user_id: userId, ...payload })
        .select()
        .single();
      if (error) throw createError(error.message);
      profile = data;
    }

    return res.status(200).json({
      success: true,
      message: "Profile saved successfully",
      profile,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getPatientDashboard,
  getAdminDashboard,
  getStaffDashboard,
  getDriverDashboard,
  savePatientOnboarding,
};