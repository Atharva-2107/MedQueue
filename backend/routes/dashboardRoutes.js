// routes/dashboardRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getPatientDashboard,
  getAdminDashboard,
  getStaffDashboard,
  getDriverDashboard,
  savePatientOnboarding,
} = require("../controllers/dashboardController");
const { verifyToken, requireRole } = require("../middleware/auth");

// All dashboard routes require auth
router.use(verifyToken);

// Role-based dashboard data
router.get("/patient",  requireRole("patient"),                           getPatientDashboard);
router.get("/admin",    requireRole("admin"),                             getAdminDashboard);
router.get("/staff",    requireRole("hospital_staff"),                    getStaffDashboard);
router.get("/driver",   requireRole("driver"),                            getDriverDashboard);

// Patient onboarding form submission
router.post("/patient/onboarding", requireRole("patient"),               savePatientOnboarding);

module.exports = router;