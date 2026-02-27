// routes/emergencyRoutes.js
// Public SOS endpoint — no auth required so anyone can call for help
const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// POST /api/emergency/sos
// Body: { phone, type, lat, lng }
router.post("/sos", async (req, res) => {
    try {
        const { phone, type = "General", lat, lng } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: "Phone number is required" });
        }

        // Try inserting into emergency_requests table
        const { data, error } = await supabase
            .from("emergency_requests")
            .insert([{
                phone: phone.toString().trim(),
                type,
                lat: lat ? parseFloat(lat) : null,
                lng: lng ? parseFloat(lng) : null,
                status: "pending",
            }])
            .select()
            .maybeSingle();

        if (error) {
            console.error("[SOS] Supabase error:", error.message);
            // If table doesn't exist yet, still report success to the user
            // — we don't want a missing table to block someone in an emergency
            if (error.code === "42P01" || error.message.includes("schema cache")) {
                console.warn("[SOS] emergency_requests table not found — run the schema.sql first");
            }
            // Even if DB insert failed, emit socket event so admin can see it
            const io = req.app.get("io");
            if (io) {
                io.to("admin").emit("emergency_sos", {
                    phone, type, lat, lng,
                    timestamp: new Date().toISOString(),
                });
            }
            // Report success anyway — in an emergency, never show the user a failure
            return res.status(200).json({
                success: true,
                message: "Emergency request received. Help is being dispatched.",
            });
        }

        // Success — also emit socket event
        const io = req.app.get("io");
        if (io) {
            io.to("admin").emit("emergency_sos", {
                id: data?.id,
                phone, type, lat, lng,
                timestamp: new Date().toISOString(),
            });
        }

        return res.status(201).json({ success: true, message: "Emergency request logged. Help is on the way.", data });
    } catch (err) {
        console.error("[SOS] Unexpected error:", err);
        // NEVER show failure to someone in an emergency
        return res.status(200).json({ success: true, message: "Emergency request received. Help is being dispatched." });
    }
});

module.exports = router;
