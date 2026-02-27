// controllers/monitoringController.js
// ─────────────────────────────────────────────────────────────────
//  MODULE 5: BED MONITORING (Admin & Hospital Dashboard)
//
//  Endpoints:
//   GET /api/monitoring/dashboard            → full system overview
//   GET /api/monitoring/hospitals/:id        → single hospital live stats
//   GET /api/monitoring/hospitals/:id/beds   → all beds + status for hospital
//   GET /api/monitoring/analytics            → historical logs & trends
//   POST /api/monitoring/opd/update          → staff: update OPD queue count
//   GET /api/monitoring/city-summary         → city-wide aggregated stats
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── GET full system dashboard ────────────────────────────────────
//  Returns aggregated stats for every hospital — used by admin dashboard
const getDashboard = async (req, res, next) => {
  try {
    // All hospitals with live bed counts
    const { data: hospitals, error: hospError } = await supabase
      .from("hospitals")
      .select(`
        id, name, city, address, latitude, longitude,
        total_beds, available_beds, total_icu, available_icu,
        total_nicu, available_nicu, opd_queue_count, updated_at
      `)
      .eq("is_active", true)
      .order("name");

    if (hospError) throw createError(hospError.message);

    // Ambulance summary
    const { data: ambStats } = await supabase
      .from("ambulances")
      .select("status")
      .eq("is_active", true);

    const ambulanceSummary = {
      total:       ambStats?.length || 0,
      available:   ambStats?.filter((a) => a.status === "available").length || 0,
      dispatched:  ambStats?.filter((a) => a.status === "dispatched").length || 0,
      maintenance: ambStats?.filter((a) => a.status === "maintenance").length || 0,
    };

    // Active dispatches
    const { count: activeDispatches } = await supabase
      .from("ambulance_dispatches")
      .select("id", { count: "exact", head: true })
      .in("status", ["requested", "accepted", "en_route"]);

    // Pending + active bookings
    const { count: pendingBookings } = await supabase
      .from("bed_bookings")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "confirmed"]);

    // System-wide aggregation
    const systemTotals = hospitals.reduce(
      (acc, h) => {
        acc.total_beds      += h.total_beds;
        acc.available_beds  += h.available_beds;
        acc.total_icu       += h.total_icu;
        acc.available_icu   += h.available_icu;
        acc.total_nicu      += h.total_nicu;
        acc.available_nicu  += h.available_nicu;
        acc.opd_queue_total += h.opd_queue_count;
        return acc;
      },
      { total_beds: 0, available_beds: 0, total_icu: 0, available_icu: 0, total_nicu: 0, available_nicu: 0, opd_queue_total: 0 }
    );

    return res.status(200).json({
      success: true,
      last_updated: new Date().toISOString(),
      system_totals: systemTotals,
      ambulance_summary: ambulanceSummary,
      active_dispatches: activeDispatches || 0,
      pending_bookings:  pendingBookings  || 0,
      hospitals,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET single hospital live stats ───────────────────────────────
const getHospitalStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const { data: hospital, error } = await supabase
      .from("hospitals")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !hospital) throw createError("Hospital not found", 404);

    // Bed breakdown by type and status
    const { data: bedBreakdown } = await supabase
      .from("beds")
      .select("bed_type, status")
      .eq("hospital_id", id);

    const breakdown = {};
    (bedBreakdown || []).forEach(({ bed_type, status }) => {
      if (!breakdown[bed_type]) breakdown[bed_type] = { total: 0, available: 0, occupied: 0, reserved: 0, maintenance: 0 };
      breakdown[bed_type].total++;
      breakdown[bed_type][status] = (breakdown[bed_type][status] || 0) + 1;
    });

    // Recent bookings (last 10)
    const { data: recentBookings } = await supabase
      .from("bed_bookings")
      .select(`
        id, status, booking_type, created_at, admitted_at,
        beds(bed_number, bed_type),
        patient_profiles(users(full_name))
      `)
      .eq("hospital_id", id)
      .order("created_at", { ascending: false })
      .limit(10);

    // Ambulances parked at this hospital
    const { data: ambulances } = await supabase
      .from("ambulances")
      .select("id, vehicle_number, status, ambulance_type, driver_name")
      .eq("hospital_id", id)
      .eq("is_active", true);

    return res.status(200).json({
      success: true,
      hospital,
      bed_breakdown: breakdown,
      recent_bookings: recentBookings,
      ambulances,
    });
  } catch (err) {
    next(err);
  }
};

// ── GET all beds for a hospital (visual map) ─────────────────────
const getHospitalBeds = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bed_type, status, ward } = req.query;

    let query = supabase
      .from("beds")
      .select(`
        id, bed_number, bed_type, status, floor, ward, features, updated_at
      `)
      .eq("hospital_id", id)
      .order("bed_number");

    if (bed_type) query = query.eq("bed_type", bed_type);
    if (status)   query = query.eq("status", status);
    if (ward)     query = query.ilike("ward", `%${ward}%`);

    const { data: beds, error } = await query;
    if (error) throw createError(error.message);

    // Group by ward for easy frontend rendering
    const grouped = {};
    (beds || []).forEach((bed) => {
      const key = bed.ward || "Unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(bed);
    });

    return res.status(200).json({ success: true, total: beds.length, grouped_by_ward: grouped, beds });
  } catch (err) {
    next(err);
  }
};

// ── GET historical analytics / trends ───────────────────────────
//  Shows occupancy over time from bed_monitoring_logs
const getAnalytics = async (req, res, next) => {
  try {
    const { hospital_id, from, to, interval = "1 hour" } = req.query;

    // Default: last 24 hours
    const fromDate = from || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const toDate   = to   || new Date().toISOString();

    let query = supabase
      .from("bed_monitoring_logs")
      .select(`
        hospital_id, total_beds, available_beds, occupied_beds,
        total_icu, available_icu, total_nicu, available_nicu,
        opd_queue_count, recorded_at,
        hospitals(name, city)
      `)
      .gte("recorded_at", fromDate)
      .lte("recorded_at", toDate)
      .order("recorded_at");

    if (hospital_id) query = query.eq("hospital_id", hospital_id);

    const { data: logs, error } = await query;
    if (error) throw createError(error.message);

    // Compute occupancy % for each log
    const enriched = (logs || []).map((log) => ({
      ...log,
      occupancy_pct: log.total_beds
        ? (((log.total_beds - log.available_beds) / log.total_beds) * 100).toFixed(1)
        : 0,
      icu_occupancy_pct: log.total_icu
        ? (((log.total_icu - log.available_icu) / log.total_icu) * 100).toFixed(1)
        : 0,
    }));

    return res.status(200).json({ success: true, from: fromDate, to: toDate, logs: enriched });
  } catch (err) {
    next(err);
  }
};

// ── POST update OPD queue (hospital staff) ───────────────────────
const updateOpdQueue = async (req, res, next) => {
  try {
    const { hospital_id, opd_queue_count } = req.body;

    if (!hospital_id || opd_queue_count === undefined) {
      throw createError("hospital_id and opd_queue_count are required");
    }

    // Staff can only update their own hospital
    if (req.user.role === "hospital_staff" && req.user.hospital_id !== hospital_id) {
      throw createError("You can only update your own hospital's OPD queue", 403);
    }

    const { data: hospital, error } = await supabase
      .from("hospitals")
      .update({ opd_queue_count, updated_at: new Date().toISOString() })
      .eq("id", hospital_id)
      .select("id, name, opd_queue_count")
      .single();

    if (error) throw createError(error.message);

    // Real-time update
    const io = req.app.get("io");
    if (io) {
      io.to(`hospital_${hospital_id}`).emit("opd_update", {
        hospital_id,
        opd_queue_count,
      });
    }

    return res.status(200).json({ success: true, hospital });
  } catch (err) {
    next(err);
  }
};

// ── GET city-wide summary ────────────────────────────────────────
const getCitySummary = async (req, res, next) => {
  try {
    const { city = "Pune" } = req.query;

    const { data: hospitals, error } = await supabase
      .from("hospitals")
      .select(`
        id, name, address, latitude, longitude,
        total_beds, available_beds, total_icu, available_icu,
        total_nicu, available_nicu, opd_queue_count
      `)
      .ilike("city", `%${city}%`)
      .eq("is_active", true);

    if (error) throw createError(error.message);

    const totals = hospitals.reduce(
      (acc, h) => {
        acc.hospitals++;
        acc.total_beds     += h.total_beds;
        acc.available_beds += h.available_beds;
        acc.total_icu      += h.total_icu;
        acc.available_icu  += h.available_icu;
        acc.total_nicu     += h.total_nicu;
        acc.available_nicu += h.available_nicu;
        return acc;
      },
      { hospitals: 0, total_beds: 0, available_beds: 0, total_icu: 0, available_icu: 0, total_nicu: 0, available_nicu: 0 }
    );

    // Ambulances in city
    const { data: ambs } = await supabase
      .from("ambulances")
      .select("id, status, hospitals!inner(city)")
      .ilike("hospitals.city", `%${city}%`)
      .eq("is_active", true);

    const ambTotals = {
      total:      ambs?.length || 0,
      available:  ambs?.filter((a) => a.status === "available").length || 0,
      dispatched: ambs?.filter((a) => a.status === "dispatched").length || 0,
    };

    return res.status(200).json({
      success: true,
      city,
      summary: { ...totals, ...ambTotals },
      hospitals,
    });
  } catch (err) {
    next(err);
  }
};

// ── Snapshot cron helper ─────────────────────────────────────────
//  Called by a cron job / scheduled function to log bed state every hour
const snapshotBedState = async () => {
  const { data: hospitals } = await supabase
    .from("hospitals")
    .select("id, total_beds, available_beds, total_icu, available_icu, total_nicu, available_nicu, opd_queue_count")
    .eq("is_active", true);

  if (!hospitals) return;

  const logs = hospitals.map((h) => ({
    hospital_id:     h.id,
    total_beds:      h.total_beds,
    available_beds:  h.available_beds,
    occupied_beds:   h.total_beds - h.available_beds,
    total_icu:       h.total_icu,
    available_icu:   h.available_icu,
    total_nicu:      h.total_nicu,
    available_nicu:  h.available_nicu,
    opd_queue_count: h.opd_queue_count,
  }));

  await supabase.from("bed_monitoring_logs").insert(logs);
  console.log(`[SNAPSHOT] Logged bed state for ${logs.length} hospitals at`, new Date().toISOString());
};

module.exports = {
  getDashboard,
  getHospitalStats,
  getHospitalBeds,
  getAnalytics,
  updateOpdQueue,
  getCitySummary,
  snapshotBedState,
};