// socket/socketManager.js
// ─────────────────────────────────────────────────────────────────
//  Socket.IO Manager
//
//  Rooms:
//   hospital_{id}    → staff see bed/OPD updates for their hospital
//   driver_{ambId}   → driver gets dispatch assignments
//   admin            → admin gets everything
//   patient_{userId} → patient gets their booking/dispatch status
//
//  Events emitted from controllers:
//   bed_update               → bed status changed
//   booking_status_changed   → booking confirmed/discharged
//   ambulance_location_update→ GPS ping from driver
//   ambulance_status_update  → ambulance available/dispatched
//   new_dispatch             → driver receives a new job
//   dispatch_status_update   → patient/admin tracks dispatch progress
//   opd_update               → OPD queue count changed
// ─────────────────────────────────────────────────────────────────
const jwt = require("jsonwebtoken");

const initSocket = (io) => {
  // ── Auth middleware for socket connections ─────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      // Allow anonymous connections for public read-only rooms
      socket.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      // Don't block — just mark as unauthenticated
      socket.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`[SOCKET] Connected: ${socket.id} | User: ${user?.id || "anonymous"}`);

    // ── Client joins relevant rooms ──────────────────────────────
    if (user) {
      if (user.role === "admin") {
        socket.join("admin");
      }

      if (user.role === "hospital_staff" && user.hospital_id) {
        socket.join(`hospital_${user.hospital_id}`);
      }

      if (user.role === "driver") {
        // Driver joins room named after their ambulance — set by client
        socket.on("driver:register", (ambulanceId) => {
          socket.join(`driver_${ambulanceId}`);
          console.log(`[SOCKET] Driver ${user.id} joined driver_${ambulanceId}`);
        });
      }

      if (user.role === "patient") {
        socket.join(`patient_${user.id}`);
      }
    }

    // ── Client can subscribe to a specific hospital feed (public) ─
    socket.on("subscribe:hospital", (hospitalId) => {
      socket.join(`hospital_${hospitalId}`);
      console.log(`[SOCKET] ${socket.id} subscribed to hospital_${hospitalId}`);
    });

    // ── Client can track specific ambulance ──────────────────────
    socket.on("track:ambulance", (ambulanceId) => {
      socket.join(`track_ambulance_${ambulanceId}`);
    });

    // ── Driver sends location pings via socket (alternative to HTTP) ─
    socket.on("driver:location", async (data) => {
      // data = { ambulance_id, latitude, longitude }
      if (!user || user.role !== "driver") return;

      // Broadcast location to anyone tracking this ambulance
      io.to(`track_ambulance_${data.ambulance_id}`).emit("ambulance_location_update", {
        ambulance_id: data.ambulance_id,
        latitude: data.latitude,
        longitude: data.longitude,
        timestamp: new Date().toISOString(),
      });
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initSocket };