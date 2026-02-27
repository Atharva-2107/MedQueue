// routes/ambulanceRoutes.js
const express = require("express");
const router  = express.Router();
const {
  listAmbulances, getAmbulanceById, getNearbyAmbulances,
  addAmbulance, updateLocation, updateAmbulanceStatus,
  requestDispatch, listDispatches, getDispatchById, updateDispatchStatus,
} = require("../controllers/ambulanceController");
const { verifyToken, requireAdmin, requireDriver, requireHospitalStaff } = require("../middleware/auth");

// ── Public ───────────────────────────────────────────────────────
router.get("/nearby", getNearbyAmbulances); // no auth — emergency use

// ── Protected ────────────────────────────────────────────────────
router.use(verifyToken);

// Ambulances
router.get("/",           listAmbulances);
router.get("/:id",        getAmbulanceById);
router.post("/",          requireAdmin, addAmbulance);
router.put("/:id/location", updateLocation);           // driver updates GPS
router.put("/:id/status",   updateAmbulanceStatus);    // driver/admin

// Dispatches
router.post("/dispatch",             requestDispatch);  // patient/admin
router.get("/dispatches",            listDispatches);
router.get("/dispatches/:id",        getDispatchById);
router.put("/dispatches/:id/status", updateDispatchStatus); // driver/admin

module.exports = router;