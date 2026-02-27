// server.js
// ─────────────────────────────────────────────────────────────────
//  Hospital Bed & Ambulance Availability Tracker
//  Team: Runtime Terrors | Pune Hack | HC005
//
//  Architecture:
//   Express REST API  →  Supabase (Postgres + Realtime)
//   Socket.IO         →  Live GPS / Bed updates to React frontend
// ─────────────────────────────────────────────────────────────────
require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./routes/authRoutes");
const patientRoutes = require("./routes/patientRoutes");
const bedRoutes = require("./routes/bedRoutes");
const ambulanceRoutes = require("./routes/ambulanceRoutes");
const monitoringRoutes = require("./routes/monitoringRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const onboardingRoutes = require("./routes/onboardingRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const { errorHandler } = require("./middleware/errorHandler");
const { initSocket } = require("./socket/socketManager");
const { snapshotBedState } = require("./controllers/monitoringController");

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
});
initSocket(io);
app.set("io", io); // make io accessible in controllers via req.app.get("io")

// ── Core Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.CLIENT_URL || "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:5173",
  ],
  credentials: true,
}));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Rate Limiting ─────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                   // max 200 requests per IP per window
  standardHeaders: true,
  message: { success: false, message: "Too many requests. Try again later." },
});
app.use("/api/", limiter);

// ── Routes ────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/beds", bedRoutes);
app.use("/api/ambulances", ambulanceRoutes);
app.use("/api/monitoring", monitoringRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/onboarding", onboardingRoutes);
app.use("/api/emergency", emergencyRoutes); // public — no auth needed

// ── Health check ─────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    project: "Hospital Bed & Ambulance Tracker – Runtime Terrors",
    timestamp: new Date().toISOString(),
  });
});

// ── 404 handler ──────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// ── Global error handler ─────────────────────────────────────────
app.use(errorHandler);

// ── Bed monitoring snapshot every hour ───────────────────────────
//  Logs bed state to bed_monitoring_logs for analytics/demand planning
setInterval(snapshotBedState, 60 * 60 * 1000); // every 1 hour
// Also run once on startup
snapshotBedState().catch(console.error);

// ── Start server ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`\n🏥  Hospital Tracker API running on port ${PORT}`);
  console.log(`🔌  Socket.IO ready for real-time connections`);
  console.log(`📊  Environment: ${process.env.NODE_ENV || "development"}\n`);
});