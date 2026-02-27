// routes/onboardingRoutes.js
const express = require("express");
const router = express.Router();
const { saveDriverOnboarding, saveStaffOnboarding } = require("../controllers/onboardingController");
const { verifyToken, requireRole } = require("../middleware/auth");

router.use(verifyToken);

router.post("/driver", requireRole("driver"), saveDriverOnboarding);
router.post("/staff", requireRole("hospital_staff"), saveStaffOnboarding);

module.exports = router;
