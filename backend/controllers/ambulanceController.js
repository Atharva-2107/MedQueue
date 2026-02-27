// controllers/ambulanceController.js
// ─────────────────────────────────────────────────────────────────
//  MODULE 3 + 4: AMBULANCE TRACKING & NEARBY AMBULANCES
//
//  Endpoints:
//   GET  /api/ambulances                    → list all ambulances
//   GET  /api/ambulances/:id                → single ambulance detail
//   GET  /api/ambulances/nearby             → nearest available ambulances
//   POST /api/ambulances                    → admin: add ambulance
//   PUT  /api/ambulances/:id/location       → driver: update GPS location
//   PUT  /api/ambulances/:id/status         → driver/admin: update status
//   POST /api/ambulances/dispatch           → request ambulance dispatch
//   GET  /api/ambulances/dispatches         → list dispatches
//   GET  /api/ambulances/dispatches/:id     → dispatch detail
//   PUT  /api/ambulances/dispatches/:id/status → driver/admin: update dispatch
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");
const { getDistanceKm, calculateETA } = require("../utils/geoUtils");


// ── GET list all ambulances ──────────────────────────────────────
const listAmbulances = async (req, res, next) => {
  try {
    const { status, hospital_id, ambulance_type } = req.query;


    let query = supabase
      .from("ambulances")
      .select(`
        id, vehicle_number, driver_name, driver_phone,
        ambulance_type, status, latitude, longitude,
        last_location_update, equipment, is_active,
        hospitals(id, name, city)
      `)
      .eq("is_active", true)
      .order("vehicle_number");


    if (status)         query = query.eq("status", status);
    if (hospital_id)    query = query.eq("hospital_id", hospital_id);
    if (ambulance_type) query = query.eq("ambulance_type", ambulance_type);


    const { data: ambulances, error } = await query;
    if (error) throw createError(error.message);


    return res.status(200).json({ success: true, ambulances });
  } catch (err) {
    next(err);
  }
};


// ── GET single ambulance ─────────────────────────────────────────
const getAmbulanceById = async (req, res, next) => {
  try {
    const { data: ambulance, error } = await supabase
      .from("ambulances")
      .select(`*, hospitals(id, name, address, city)`)
      .eq("id", req.params.id)
      .single();


    if (error || !ambulance) throw createError("Ambulance not found", 404);


    return res.status(200).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};


// ── GET nearby available ambulances ─────────────────────────────
//  Uses Supabase PostGIS function to query within radius.
//  Query params: lat, lng, radius_km (default 10), limit (default 5)
const getNearbyAmbulances = async (req, res, next) => {
  try {
    const { lat, lng, radius_km = 10, limit = 5, ambulance_type } = req.query;


    if (!lat || !lng) throw createError("lat and lng query params are required");


    const latitude  = parseFloat(lat);
    const longitude = parseFloat(lng);
    const radiusM   = parseFloat(radius_km) * 1000; // convert to metres for PostGIS


    // PostGIS query via Supabase RPC (raw SQL function defined in schema)
    // ST_DWithin is faster than ST_Distance for availability checks
    let query = supabase
      .from("ambulances")
      .select(`
        id, vehicle_number, driver_name, driver_phone,
        ambulance_type, status, latitude, longitude,
        last_location_update, equipment,
        hospitals(name, city)
      `)
      .eq("status", "available")
      .eq("is_active", true)
      .not("latitude", "is", null)
      .not("longitude", "is", null);


    if (ambulance_type) query = query.eq("ambulance_type", ambulance_type);


    const { data: ambulances, error } = await query;
    if (error) throw createError(error.message);


    // Filter by distance and calculate ETA in JS
    // (PostGIS ST_DWithin RPC is the ideal approach — see schema for the
    //  find_nearby_ambulances function.  This JS fallback works without RPC.)
    const nearby = ambulances
      .map((amb) => {
        const distanceKm = getDistanceKm(latitude, longitude, amb.latitude, amb.longitude);
        const etaMinutes = calculateETA(distanceKm);
        return { ...amb, distance_km: parseFloat(distanceKm.toFixed(2)), eta_minutes: etaMinutes };
      })
      .filter((a) => a.distance_km <= parseFloat(radius_km))
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, parseInt(limit));


    return res.status(200).json({
      success: true,
      count: nearby.length,
      user_location: { latitude, longitude },
      ambulances: nearby,
    });
  } catch (err) {
    next(err);
  }
};


// ── POST add ambulance (admin) ───────────────────────────────────
const addAmbulance = async (req, res, next) => {
  try {
    const {
      hospital_id, vehicle_number, driver_id, driver_name,
      driver_phone, ambulance_type, equipment,
    } = req.body;


    if (!vehicle_number) throw createError("vehicle_number is required");


    const { data: ambulance, error } = await supabase
      .from("ambulances")
      .insert({
        hospital_id, vehicle_number, driver_id, driver_name,
        driver_phone, ambulance_type, equipment,
      })
      .select()
      .single();


    if (error) throw createError(error.message);


    return res.status(201).json({ success: true, message: "Ambulance added", ambulance });
  } catch (err) {
    next(err);
  }
};


// ── PUT update GPS location (driver only) ────────────────────────
//  Called frequently by the driver's app (every 5-10 seconds)
//  Also emits socket event so the frontend map updates in real-time
const updateLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;


    if (latitude === undefined || longitude === undefined) {
      throw createError("latitude and longitude are required");
    }


    // Drivers can only update their own ambulance
    if (req.user.role === "driver") {
      const { data: amb } = await supabase
        .from("ambulances")
        .select("driver_id")
        .eq("id", id)
        .single();


      if (!amb || amb.driver_id !== req.user.id) {
        throw createError("You can only update your own ambulance location", 403);
      }
    }


    const { data: ambulance, error } = await supabase
      .from("ambulances")
      .update({ latitude, longitude }) // trigger auto-updates PostGIS point
      .eq("id", id)
      .select("id, vehicle_number, latitude, longitude, status, last_location_update")
      .single();


    if (error) throw createError(error.message);


    // Broadcast real-time location to all subscribed clients
    const io = req.app.get("io");
    if (io) {
      io.emit("ambulance_location_update", {
        ambulance_id: id,
        latitude,
        longitude,
        timestamp: ambulance.last_location_update,
        status: ambulance.status,
      });
    }


    return res.status(200).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};


// ── PUT update ambulance status ──────────────────────────────────
const updateAmbulanceStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;


    const valid = ["available", "dispatched", "returning", "maintenance", "offline"];
    if (!valid.includes(status)) throw createError(`status must be one of: ${valid.join(", ")}`);


    const { data: ambulance, error } = await supabase
      .from("ambulances")
      .update({ status })
      .eq("id", id)
      .select()
      .single();


    if (error) throw createError(error.message);


    const io = req.app.get("io");
    if (io) {
      io.emit("ambulance_status_update", { ambulance_id: id, status });
    }


    return res.status(200).json({ success: true, ambulance });
  } catch (err) {
    next(err);
  }
};


// ── POST request ambulance dispatch ─────────────────────────────
const requestDispatch = async (req, res, next) => {
  try {
    const {
      ambulance_id,       // optional: request specific ambulance
      pickup_address,
      pickup_latitude,
      pickup_longitude,
      hospital_id,        // destination hospital
      priority = "normal",
      notes,
    } = req.body;


    if (!pickup_address || pickup_latitude === undefined || pickup_longitude === undefined) {
      throw createError("pickup_address, pickup_latitude, pickup_longitude are required");
    }


    // Get patient profile id
    const { data: profile } = await supabase
      .from("patient_profiles")
      .select("id")
      .eq("user_id", req.user.id)
      .maybeSingle();


    // Find nearest available ambulance if none specified
    let selectedAmbulanceId = ambulance_id;
    if (!selectedAmbulanceId) {
      const { data: allAmbs } = await supabase
        .from("ambulances")
        .select("id, latitude, longitude")
        .eq("status", "available")
        .eq("is_active", true)
        .not("latitude", "is", null);


      if (!allAmbs || allAmbs.length === 0) {
        throw createError("No ambulances available right now", 503);
      }


      // Pick the closest one
      const sorted = allAmbs
        .map((a) => ({
          ...a,
          distance: getDistanceKm(pickup_latitude, pickup_longitude, a.latitude, a.longitude),
        }))
        .sort((a, b) => a.distance - b.distance);


      selectedAmbulanceId = sorted[0].id;
    }


    // Get ambulance details for ETA calc
    const { data: selectedAmb } = await supabase
      .from("ambulances")
      .select("id, latitude, longitude, status")
      .eq("id", selectedAmbulanceId)
      .single();


    if (!selectedAmb || selectedAmb.status !== "available") {
      throw createError("Selected ambulance is not available", 409);
    }


    const distKm = getDistanceKm(pickup_latitude, pickup_longitude, selectedAmb.latitude, selectedAmb.longitude);
    const eta    = calculateETA(distKm);


    // Create dispatch record
    const { data: dispatch, error } = await supabase
      .from("ambulance_dispatches")
      .insert({
        ambulance_id: selectedAmbulanceId,
        patient_id: profile?.id || null,
        hospital_id: hospital_id || null,
        requested_by: req.user.id,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        status: "requested",
        priority,
        estimated_eta: eta,
        notes,
      })
      .select(`
        *,
        ambulances(id, vehicle_number, driver_name, driver_phone, latitude, longitude, ambulance_type),
        hospitals(id, name, address)
      `)
      .single();


    if (error) throw createError(error.message);


    // Real-time notification to driver
    const io = req.app.get("io");
    if (io) {
      io.to(`driver_${selectedAmbulanceId}`).emit("new_dispatch", {
        dispatch_id: dispatch.id,
        pickup_address,
        pickup_latitude,
        pickup_longitude,
        priority,
        eta,
        patient_notes: notes,
      });
    }


    return res.status(201).json({
      success: true,
      message: "Ambulance dispatched",
      dispatch,
    });
  } catch (err) {
    next(err);
  }
};


// ── GET list dispatches ──────────────────────────────────────────
const listDispatches = async (req, res, next) => {
  try {
    const { status, priority, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;


    let query = supabase
      .from("ambulance_dispatches")
      .select(`
        id, status, priority, pickup_address, estimated_eta,
        created_at, actual_arrival, completed_at,
        ambulances(vehicle_number, driver_name, driver_phone, ambulance_type),
        hospitals(name, city),
        patient_profiles(users(full_name, phone))
      `, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);


    // Drivers only see their own dispatches
    if (req.user.role === "driver") {
      const { data: driverAmb } = await supabase
        .from("ambulances")
        .select("id")
        .eq("driver_id", req.user.id)
        .single();
      if (driverAmb) query = query.eq("ambulance_id", driverAmb.id);
    }


    if (status)   query = query.eq("status", status);
    if (priority) query = query.eq("priority", priority);


    const { data: dispatches, count, error } = await query;
    if (error) throw createError(error.message);


    return res.status(200).json({ success: true, total: count, dispatches });
  } catch (err) {
    next(err);
  }
};


// ── GET single dispatch ──────────────────────────────────────────
const getDispatchById = async (req, res, next) => {
  try {
    const { data: dispatch, error } = await supabase
      .from("ambulance_dispatches")
      .select(`
        *,
        ambulances(*),
        hospitals(id, name, address, latitude, longitude),
        patient_profiles(*, users(full_name, phone, email))
      `)
      .eq("id", req.params.id)
      .single();


    if (error || !dispatch) throw createError("Dispatch not found", 404);


    return res.status(200).json({ success: true, dispatch });
  } catch (err) {
    next(err);
  }
};


// ── PUT update dispatch status (driver/admin) ────────────────────
const updateDispatchStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;


    const valid = ["requested", "accepted", "en_route", "arrived", "completed", "cancelled"];
    if (!valid.includes(status)) throw createError(`status must be one of: ${valid.join(", ")}`);


    const updates = { status };
    if (status === "arrived")   updates.actual_arrival = new Date().toISOString();
    if (status === "completed") updates.completed_at   = new Date().toISOString();
    if (notes) updates.notes = notes;


    const { data: dispatch, error } = await supabase
      .from("ambulance_dispatches")
      .update(updates)
      .eq("id", id)
      .select(`*, ambulances(id, vehicle_number)`)
      .single();


    if (error) throw createError(error.message);


    // Notify patient / admin of status change
    const io = req.app.get("io");
    if (io) {
      io.emit("dispatch_status_update", {
        dispatch_id: id,
        status,
        ambulance_id: dispatch.ambulance_id,
      });
    }


    return res.status(200).json({ success: true, dispatch });
  } catch (err) {
    next(err);
  }
};


module.exports = {
  listAmbulances,
  getAmbulanceById,
  getNearbyAmbulances,
  addAmbulance,
  updateLocation,
  updateAmbulanceStatus,
  requestDispatch,
  listDispatches,
  getDispatchById,
  updateDispatchStatus,
};
