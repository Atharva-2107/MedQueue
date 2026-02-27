// controllers/onboardingController.js
// Driver and Staff onboarding — saves profile data to relevant tables
const supabase = require("../config/supabase");
const { createError } = require("../middleware/errorHandler");

// ── POST /api/drivers/onboarding ─────────────────────────────────
const saveDriverOnboarding = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { vehicle_number, ambulance_type, fuel_type, year_of_manufacture,
            license_number, license_expiry, aadhaar_number, emergency_phone,
            current_lat, current_lng } = req.body;

        if (!vehicle_number || !ambulance_type) {
            throw createError("vehicle_number and ambulance_type are required", 400);
        }

        // Check for existing ambulance record for this driver
        const { data: existing } = await supabase
            .from("ambulances")
            .select("id")
            .eq("driver_id", userId)
            .maybeSingle();

        const payload = {
            driver_id: userId,
            vehicle_number,
            ambulance_type,
            fuel_type,
            year_of_manufacture: year_of_manufacture ? parseInt(year_of_manufacture) : null,
            license_number,
            license_expiry,
            driver_aadhaar: aadhaar_number,
            driver_emergency_phone: emergency_phone,
            latitude: current_lat,
            longitude: current_lng,
            status: "available",
            is_active: true,
        };

        let ambulance;
        if (existing) {
            const { data, error } = await supabase
                .from("ambulances")
                .update(payload)
                .eq("driver_id", userId)
                .select()
                .single();
            if (error) throw createError(error.message);
            ambulance = data;
        } else {
            const { data, error } = await supabase
                .from("ambulances")
                .insert(payload)
                .select()
                .single();
            if (error) throw createError(error.message);
            ambulance = data;
        }

        return res.status(200).json({ success: true, message: "Driver profile saved", ambulance });
    } catch (err) {
        next(err);
    }
};

// ── POST /api/staff/onboarding ────────────────────────────────────
const saveStaffOnboarding = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { hospital_id, department, job_role, shift, employee_id, emergency_phone } = req.body;

        if (!hospital_id) throw createError("hospital_id is required", 400);

        // Update user's hospital_id and profile fields
        const { error: userError } = await supabase
            .from("users")
            .update({ hospital_id })
            .eq("id", userId);

        if (userError) throw createError(userError.message);

        // Upsert staff profile
        const { data: existing } = await supabase
            .from("staff_profiles")
            .select("id")
            .eq("user_id", userId)
            .maybeSingle();

        const payload = {
            user_id: userId,
            hospital_id,
            department,
            job_role,
            shift,
            employee_id,
            emergency_phone,
            is_profile_complete: true,
        };

        if (existing) {
            await supabase.from("staff_profiles").update(payload).eq("user_id", userId);
        } else {
            await supabase.from("staff_profiles").insert(payload);
        }

        return res.status(200).json({ success: true, message: "Staff profile saved" });
    } catch (err) {
        next(err);
    }
};

module.exports = { saveDriverOnboarding, saveStaffOnboarding };
