// routes/monitoringRoutes.js
const express = require("express");
const router  = express.Router();
const {
  getDashboard, getHospitalStats, getHospitalBeds,
  getAnalytics, updateOpdQueue, getCitySummary,
} = require("../controllers/monitoringController");
const { verifyToken, requireHospitalStaff, requireAdmin } = require("../middleware/auth");

// ── Public ───────────────────────────────────────────────────────
router.get("/city-summary",        getCitySummary);
router.get("/hospitals/:id",       getHospitalStats);
router.get("/hospitals/:id/beds",  getHospitalBeds);

// ── Protected ────────────────────────────────────────────────────
router.use(verifyToken);

router.get("/dashboard",           requireAdmin,          getDashboard);
router.get("/analytics",           requireHospitalStaff,  getAnalytics);
router.post("/opd/update",         requireHospitalStaff,  updateOpdQueue);

module.exports = router;