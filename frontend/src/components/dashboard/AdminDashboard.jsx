// src/components/dashboard/AdminDashboard.jsx — Hospital Admin: linked via GPS, sees all data
import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import { useRealtime } from "../../hooks/useRealtime";
import StaffHospitalSelector from "../onboarding/StaffHospitalSelector";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, ProgressRing, DashboardHeader, StatusBadge, InfoRow,
} from "../shared/UIComponents";

export default function AdminDashboard({ section }) {
  const { user } = useAuth();

  // PERSISTENCE FIX: user?.hospital_id (from DB) is authoritative across logins
  // localHospId is only used within-session right after first selection
  const [localHospId, setLocalHospId] = useState(null);
  const linkedHospitalId = user?.hospital_id || localHospId;
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 5000); };

  // ── early return placed AFTER hooks (React rules) — see below

  useEffect(() => {
    if (!linkedHospitalId) return; // wait until hospital selected
    const load = async () => {
      setLoading(true);
      const [h, a, b, d, u] = await Promise.all([
        supabase.from("hospitals").select("*").eq("is_active", true).order("name"),
        supabase.from("ambulances").select("*").order("vehicle_number"),
        supabase.from("bookings").select("*, hospitals(name), beds(bed_number, bed_type, ward)").order("booked_at", { ascending: false }).limit(100),
        supabase.from("dispatches").select("*, ambulances(vehicle_number), hospitals(name)").order("requested_at", { ascending: false }).limit(20),
        supabase.from("users").select("id, full_name, role, is_active").order("created_at", { ascending: false }),
      ]);

      // Deduplicate hospitals by name+address (remove static seed data duplicates)
      const seen = new Set();
      const dedupedHospitals = (h.data || []).filter(hosp => {
        const key = `${hosp.name?.toLowerCase().trim()}|${(hosp.address || "").toLowerCase().trim()}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });
      // Sort: linked hospital first, then alphabetically
      dedupedHospitals.sort((a, b) => {
        if (a.id === linkedHospitalId) return -1;
        if (b.id === linkedHospitalId) return 1;
        return (a.name || "").localeCompare(b.name || "");
      });

      setHospitals(dedupedHospitals);
      setAmbulances(a.data || []);
      setBookings(b.data || []);
      setDispatches(d.data || []);
      setUsers(u.data || []);
      setLoading(false);
    };
    load();
  }, [linkedHospitalId]);

  // Real-time: new bookings + dispatches
  useRealtime("bookings", { event: "INSERT" }, () => showToast("🆕 New booking!"));
  useRealtime("dispatches", { event: "INSERT" }, () => showToast("🆘 New SOS dispatch!"));

  // ── Now safe to do conditional return — all hooks already called above ──
  if (user && !linkedHospitalId) {
    return <StaffHospitalSelector userId={user.id} onLinked={(id) => setLocalHospId(id)} />;
  }

  if (loading) return <LoadingSpinner />;

  const totalBeds = hospitals.reduce((s, h) => s + (h.total_beds || 0), 0);
  const availBeds = hospitals.reduce((s, h) => s + (h.available_beds || 0), 0);
  const ambAvail = ambulances.filter(a => a.status === "available").length;
  const ambDispatched = ambulances.filter(a => a.status === "dispatched").length;
  const totalPatients = users.filter(u => u.role === "patient").length;
  const pendingBk = bookings.filter(b => b.status === "pending").length;
  const admittedBk = bookings.filter(b => b.status === "admitted").length;
  const activeDisp = dispatches.filter(d => ["pending", "accepted", "en_route", "arrived"].includes(d.status)).length;

  /* ════════ HOME ════════ */
  if (section === "home" || !section) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="System Overview" subtitle="MedQueue — City-Wide Admin Dashboard" badge="ADMIN" badgeColor="violet" />

      {/* Capacity rings */}
      <Card>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>City-Wide Capacity</p>
        <div style={{ display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 20 }}>
          <ProgressRing label="Bed Occupancy" value={totalBeds - availBeds} max={totalBeds} icon="🛏️" color="emerald" />
          <ProgressRing label="Fleet Active" value={ambDispatched} max={ambulances.length} icon="🚑" color="amber" />
        </div>
      </Card>

      {/* Key stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon="🛏️" label="Available Beds" value={availBeds} sub={`of ${totalBeds} total`} color="emerald" />
        <StatCard icon="🚑" label="Ambulances Free" value={ambAvail} sub={`${ambDispatched} dispatched`} color="amber" />
        <StatCard icon="👥" label="Total Patients" value={totalPatients} color="violet" />
        <StatCard icon="🏥" label="Hospitals" value={hospitals.length} color="blue" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <StatCard icon="⏳" label="Pending Bookings" value={pendingBk} color="amber" />
        <StatCard icon="🏨" label="Admitted Patients" value={admittedBk} color="violet" />
        <StatCard icon="📡" label="Active Dispatches" value={activeDisp} color="blue" />
        <StatCard icon="👤" label="Total Users" value={users.length} color="cyan" />
      </div>

      {/* Two-column recent lists */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card>
          <SectionTitle>📋 Recent Bookings</SectionTitle>
          {bookings.length === 0
            ? <EmptyState icon="📋" message="No bookings yet" />
            : bookings.slice(0, 8).map(b => (
              <div key={b.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0 }}>{b.hospitals?.name || "—"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{b.beds?.bed_type || "Bed"} {b.beds?.bed_number ? `— ${b.beds.bed_number}` : ""}</p>
                </div>
                <StatusBadge status={b.status} />
              </div>
            ))
          }
        </Card>
        <Card>
          <SectionTitle>🚑 Recent Dispatches</SectionTitle>
          {dispatches.length === 0
            ? <EmptyState icon="🚑" message="No dispatches" />
            : dispatches.slice(0, 8).map(d => (
              <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", margin: 0 }}>{d.ambulances?.vehicle_number || "—"}</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{d.hospitals?.name || d.pickup_address || "—"}</p>
                </div>
                <StatusBadge status={d.status} />
              </div>
            ))
          }
        </Card>
      </div>
    </div>
  );

  /* ════════ HOSPITALS ════════ */
  if (section === "hospitals") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🏥 All Hospitals" subtitle={`${hospitals.length} registered facilities`} />
      {hospitals.map(h => (
        <Card key={h.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}, {h.city}</p>
              <BedBar label="General Beds" available={h.available_beds} total={h.total_beds} />
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, margin: 0 }}>Available</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>{h.available_beds || 0}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>of {h.total_beds || 0}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ════════ AMBULANCES ════════ */
  if (section === "ambulances") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🚑 Fleet Overview" subtitle="All registered ambulances" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon="✅" label="Available" value={ambAvail} color="emerald" />
        <StatCard icon="🔴" label="Dispatched" value={ambDispatched} color="red" />
        <StatCard icon="🔧" label="Maintenance" value={ambulances.filter(a => a.status === "maintenance").length} color="amber" />
        <StatCard icon="📊" label="Total Fleet" value={ambulances.length} color="blue" />
      </div>
      {ambulances.length === 0
        ? <EmptyState icon="🚑" message="No ambulances registered" />
        : ambulances.map(a => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{a.vehicle_number || "No number"}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0" }}>{a.ambulance_type}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════════ PATIENTS ════════ */
  if (section === "patients") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="👥 All Patients" subtitle={`${totalPatients} registered patients`} />
      {users.filter(u => u.role === "patient").length === 0
        ? <EmptyState icon="👤" message="No patients registered" />
        : users.filter(u => u.role === "patient").map(u => (
          <Card key={u.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", background: "#f5f3ff",
                  border: "1px solid #ddd6fe", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 900, color: "#7c3aed",
                }}>
                  {u.full_name?.[0]?.toUpperCase() || "?"}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", margin: 0 }}>{u.full_name}</p>
                  <StatusBadge status={u.is_active ? "available" : "offline"} />
                </div>
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════════ DISPATCHES ════════ */
  if (section === "dispatches") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📡 All Dispatches" subtitle="System-wide dispatch history" />
      {dispatches.length === 0
        ? <EmptyState icon="📡" message="No dispatches" />
        : dispatches.map(d => (
          <Card key={d.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>{d.ambulances?.vehicle_number || "—"}</p>
                  <StatusBadge status={d.status} />
                </div>
                <InfoRow label="Pickup" value={d.pickup_address || "GPS"} icon="📍" />
                {d.hospitals && <InfoRow label="Hospital" value={d.hospitals.name} icon="🏥" />}
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8" }}>
                {new Date(d.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════════ BOOKINGS ════════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 All Bookings" subtitle={`${bookings.length} recent bookings system-wide`} />
      {bookings.length === 0 ? (
        <EmptyState icon="✅" message="No bookings right now" />
      ) : bookings.map(b => (
        <Card key={b.id} style={{ border: b.status === "pending" ? "2px solid #bfdbfe" : "1px solid #e2e8f0", background: b.status === "pending" ? "#f8fbff" : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <StatusBadge status={b.status} />
              </div>
              <InfoRow label="Hospital" value={b.hospitals?.name || "—"} icon="🏥" />
              <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: "4px 0 4px" }}>
                🛏️ Bed {b.beds?.bed_number || "—"}
                {b.beds?.ward && <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginLeft: 8 }}>({b.beds.ward})</span>}
              </p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>Type: {b.beds?.bed_type || "General"}</p>
              <p style={{ fontSize: 11, color: "#cbd5e1", margin: "4px 0 0" }}>Booked: {new Date(b.booked_at || Date.now()).toLocaleString("en-IN")}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ════════ ANALYTICS ════════ */
  if (section === "analytics") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📈 Analytics" subtitle="System performance overview" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="👥" label="Total Users" value={users.length} color="violet" />
        <StatCard icon="👤" label="Patients" value={totalPatients} color="blue" />
        <StatCard icon="🚑" label="Drivers" value={users.filter(u => u.role === "driver").length} color="orange" />
        <StatCard icon="🏥" label="Staff" value={users.filter(u => u.role === "hospital_staff").length} color="cyan" />
        <StatCard icon="🔑" label="Admins" value={users.filter(u => u.role === "admin").length} color="red" />
        <StatCard icon="📋" label="Total Bookings" value={bookings.length} color="amber" />
      </div>
    </div>
  );

  return <EmptyState icon="⚙️" message="Select a section from the sidebar" />;
}