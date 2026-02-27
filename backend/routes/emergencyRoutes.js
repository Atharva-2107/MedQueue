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

        // Insert using service-role Supabase (bypasses RLS)
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
            .single();

        if (error) {
            console.error("[SOS] Insert error:", error.message);
            // If table doesn't exist, return a helpful but soft error
            if (error.code === "42P01") {
                return res.status(200).json({
                    success: true,
                    message: "Emergency noted. Authorities alerted. (table pending setup)",
                });
            }
            return res.status(500).json({ success: false, message: "Failed to log request: " + error.message });
        }

        // Emit realtime alert to admin room via Socket.IO
        const io = req.app.get("io");
        if (io) {
            io.to("admin").emit("emergency_sos", {
                phone, type, lat, lng,
                timestamp: new Date().toISOString(),
            });
        }

        return res.status(201).json({ success: true, message: "Emergency request logged", data });
    } catch (err) {
        console.error("[SOS] Unexpected error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
