// socket/socketManager.js
// ─────────────────────────────────────────────────────────────────
//  Socket.IO Manager — uses Supabase JWT for auth (no JWT_SECRET needed)
// ─────────────────────────────────────────────────────────────────
const supabase = require("../config/supabase");

const initSocket = (io) => {
  // ── Auth middleware — validate Supabase JWT ────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;

    if (!token) {
      socket.user = null;
      return next(); // Allow anonymous connections for public feeds
    }

    try {
      const { data: { user: supaUser }, error } = await supabase.auth.getUser(token);
      if (error || !supaUser) {
        socket.user = null;
        return next();
      }

      // Fetch role + hospital_id from DB
      const { data: dbUser } = await supabase
        .from("users")
        .select("id, role, hospital_id, full_name")
        .eq("id", supaUser.id)
        .single();

      socket.user = dbUser || null;
    } catch {
      socket.user = null;
    }
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.user;
    console.log(`[SOCKET] Connected: ${socket.id} | Role: ${user?.role || "public"}`);

    // ── Auto-join role-based rooms ─────────────────────────────────
    if (user) {
      if (user.role === "admin") {
        socket.join("admin");
      }
      if (user.role === "hospital_staff" && user.hospital_id) {
        socket.join(`hospital_${user.hospital_id}`);
        console.log(`[SOCKET] Staff ${user.id} joined hospital_${user.hospital_id}`);
      }
      if (user.role === "patient") {
        socket.join(`patient_${user.id}`);
      }
      if (user.role === "driver") {
        socket.on("driver:register", (ambulanceId) => {
          socket.join(`driver_${ambulanceId}`);
          console.log(`[SOCKET] Driver ${user.id} joined driver_${ambulanceId}`);
        });
      }
    }

    // ── Public room: subscribe to a hospital's bed feed ────────────
    socket.on("subscribe:hospital", (hospitalId) => {
      socket.join(`hospital_${hospitalId}`);
      console.log(`[SOCKET] ${socket.id} subscribed to hospital_${hospitalId}`);
    });

    // ── Track specific ambulance GPS ───────────────────────────────
    socket.on("track:ambulance", (ambulanceId) => {
      socket.join(`track_ambulance_${ambulanceId}`);
      console.log(`[SOCKET] ${socket.id} tracking ambulance_${ambulanceId}`);
    });

    // ── Driver sends GPS ping ──────────────────────────────────────
    socket.on("driver:location", async (data) => {
      if (!user || user.role !== "driver") return;
      const { ambulance_id, latitude, longitude } = data;

      // Broadcast to anyone tracking this ambulance (patients, admin, hospitals)
      io.to(`track_ambulance_${ambulance_id}`).emit("ambulance_location_update", {
        ambulance_id,
        latitude,
        longitude,
        timestamp: new Date().toISOString(),
      });
      // Also broadcast to admin room
      io.to("admin").emit("ambulance_location_update", { ambulance_id, latitude, longitude, timestamp: new Date().toISOString() });
    });

    socket.on("disconnect", () => {
      console.log(`[SOCKET] Disconnected: ${socket.id}`);
    });
  });
};

module.exports = { initSocket };