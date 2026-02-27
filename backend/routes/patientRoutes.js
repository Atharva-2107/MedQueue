// routes/patientRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getMyProfile, updateMyProfile, getPatientById,
  listPatients, setPatientPriority, getMyBookings,
} = require("../controllers/patientController");
const { verifyToken, requireHospitalStaff } = require("../middleware/auth");

// All patient routes require login
router.use(verifyToken);

// Patient: own profile
router.get("/profile",          getMyProfile);
router.put("/profile",          updateMyProfile);
router.get("/profile/bookings", getMyBookings);

// Admin/Staff: manage patients
router.get("/",      requireHospitalStaff, listPatients);
router.get("/:id",   requireHospitalStaff, getPatientById);
router.put("/:id/priority", requireHospitalStaff, setPatientPriority);

module.exports = router;