// routes/bedRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getBedAvailability, listBeds, bookBed, listBookings,
  getBookingById, updateBookingStatus, addBed, updateBed,
} = require("../controllers/bedController");
const { verifyToken, requireAdmin, requireHospitalStaff } = require("../middleware/auth");

// ── Public ───────────────────────────────────────────────────────
router.get("/availability", getBedAvailability); // no auth — public dashboard

// ── Protected ────────────────────────────────────────────────────
router.use(verifyToken);

// Beds
router.get("/",        listBeds);
router.post("/",       requireAdmin, addBed);
router.put("/:id",     requireHospitalStaff, updateBed);

// Bookings
router.post("/book",              bookBed);            // patient books
router.get("/bookings",           requireHospitalStaff, listBookings);
router.get("/bookings/:id",       requireHospitalStaff, getBookingById);
router.put("/bookings/:id/status",requireHospitalStaff, updateBookingStatus);

module.exports = router;