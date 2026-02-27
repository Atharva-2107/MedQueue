// src/components/dashboard/StaffDashboard.jsx — Real-time + confirm/admit/discharge actions
import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import { useRealtime } from "../../hooks/useRealtime";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner, Card,
  BedBar, DashboardHeader, InfoRow, StatusBadge, AlertBox,
} from "../shared/UIComponents";

const MapView = lazy(() => import("../maps/MapView"));

export default function StaffDashboard({ section }) {
  const { user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [beds, setBeds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [acting, setActing] = useState(null); // booking id being updated

  const showToast = (msg, duration = 4000) => {
    setToast(msg); setTimeout(() => setToast(""), duration);
  };

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let hosp = null;
    if (user.hospital_id) {
      const { data } = await supabase.from("hospitals").select("*").eq("id", user.hospital_id).maybeSingle();
      hosp = data;
    }
    if (!hosp) {
      const { data } = await supabase.from("hospitals").select("*").limit(1).maybeSingle();
      hosp = data;
    }
    setHospital(hosp);

    if (hosp) {
      const [b, bk, a] = await Promise.all([
        supabase.from("beds").select("*").eq("hospital_id", hosp.id).order("bed_number"),
        supabase.from("bookings").select("*, beds(bed_number,bed_type,ward)").eq("hospital_id", hosp.id).in("status", ["pending", "confirmed"]).order("booked_at", { ascending: false }),
        supabase.from("bookings").select("*, beds(bed_number,bed_type,ward)").eq("hospital_id", hosp.id).eq("status", "admitted").order("admitted_at", { ascending: false }),
      ]);
      setBeds(b.data || []);
      setBookings(bk.data || []);
      setAdmitted(a.data || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // ── Real-time: new booking from patient ──
  useRealtime("bookings", { event: "INSERT" }, (payload) => {
    if (payload.new?.hospital_id === hospital?.id) {
      setNewCount(n => n + 1);
      showToast("🆕 New booking request received!");
      load();
    }
  });

  // ── Real-time: booking updated ──
  useRealtime("bookings", { event: "UPDATE" }, (payload) => {
    if (payload.new?.hospital_id === hospital?.id) load();
  });

  // ── Real-time: bed status changed ──
  useRealtime("beds", {}, () => load());

  // Actions
  const updateBooking = async (booking, newStatus) => {
    setActing(booking.id);
    const updates = { status: newStatus };
    if (newStatus === "admitted") updates.admitted_at = new Date().toISOString();
    if (newStatus === "discharged") updates.discharged_at = new Date().toISOString();

    const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id);
    if (error) { showToast("❌ Action failed: " + error.message); setActing(null); return; }

    // Update bed status too
    if (booking.bed_id) {
      if (newStatus === "admitted") await supabase.from("beds").update({ status: "occupied" }).eq("id", booking.bed_id);
      if (newStatus === "discharged") await supabase.from("beds").update({ status: "available" }).eq("id", booking.bed_id);
      if (newStatus === "confirmed") await supabase.from("beds").update({ status: "reserved" }).eq("id", booking.bed_id);
      if (newStatus === "cancelled") await supabase.from("beds").update({ status: "available" }).eq("id", booking.bed_id);

      // Update hospital available_beds count
      const { data: hb } = await supabase.from("beds").select("status").eq("hospital_id", hospital.id);
      if (hb) {
        const avail = hb.filter(b => b.status === "available").length;
        await supabase.from("hospitals").update({ available_beds: avail }).eq("id", hospital.id);
      }
    }

    showToast(`✅ Booking marked as ${newStatus}`);
    setActing(null);
    load();
    if (newCount > 0) setNewCount(n => Math.max(0, n - 1));
  };

  if (loading) return <LoadingSpinner />;

  const availBeds = beds.filter(b => b.status === "available").length;
  const icuBeds = beds.filter(b => b.bed_type === "ICU");
  const availIcu = icuBeds.filter(b => b.status === "available").length;

  const bedTypeGroups = beds.reduce((acc, b) => {
    if (!acc[b.bed_type]) acc[b.bed_type] = { total: 0, available: 0, occupied: 0 };
    acc[b.bed_type].total++;
    if (b.status === "available") acc[b.bed_type].available++;
    if (b.status === "occupied") acc[b.bed_type].occupied++;
    return acc;
  }, {});

  const statusStyle = {
    available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" },
    occupied: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    reserved: { bg: "#fffbeb", border: "#fde68a", text: "#d97706" },
    maintenance: { bg: "#f1f5f9", border: "#e2e8f0", text: "#64748b" },
  };

  const ActionBtn = ({ label, color, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "6px 14px", borderRadius: 10, border: "none",
      background: disabled ? "#f1f5f9" : color, color: disabled ? "#94a3b8" : "#fff",
      fontSize: 11, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : `0 2px 8px ${color}50`,
    }}>{label}</button>
  );

  /* ════ HOME ════ */
  if (!section || section === "home") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {toast && <AlertBox type={toast.startsWith("❌") ? "error" : "success"}>{toast}</AlertBox>}

      <div style={{ borderRadius: 16, padding: 24, border: "1px solid #bfdbfe", background: "linear-gradient(135deg,#eff6ff 0%,#fff 60%)" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Staff Dashboard</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{hospital?.name || "No Hospital Linked"}</h1>
        {hospital && <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>📍 {hospital.address}, {hospital.city}</p>}
      </div>

      {!hospital && <AlertBox type="warning">No hospital linked. Ask admin to assign you.</AlertBox>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 }}>
        <StatCard icon="🛏️" label="Available Beds" value={availBeds} sub={`of ${beds.length}`} color="emerald" />
        <StatCard icon="❤️‍🔥" label="ICU Available" value={availIcu} sub={`of ${icuBeds.length}`} color="red" />
        <StatCard icon="⏳" label="Pending Requests" value={bookings.filter(b => b.status === "pending").length} color="amber" />
        <StatCard icon="🏨" label="Admitted Now" value={admitted.length} color="violet" />
      </div>

      {newCount > 0 && (
        <AlertBox type="warning">🆕 {newCount} new booking{newCount > 1 ? "s" : ""} waiting for confirmation!</AlertBox>
      )}

      {/* Bed breakdown */}
      {Object.keys(bedTypeGroups).length > 0 && (
        <div>
          <SectionTitle>🛏️ Bed Breakdown</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
            {Object.entries(bedTypeGroups).map(([type, g]) => {
              const pct = g.total ? Math.round((g.occupied / g.total) * 100) : 0;
              return (
                <Card key={type}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", margin: "0 0 12px", textTransform: "capitalize" }}>{type}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{g.available}</span>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>/ {g.total} free</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981", borderRadius: 3, transition: "width 0.6s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                    <span>{g.occupied} occupied</span>
                    <span style={{ fontWeight: 800, color: pct > 80 ? "#ef4444" : "#059669" }}>{pct}%</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Hospital on map */}
      {hospital?.latitude && (
        <>
          <SectionTitle>🗺️ Hospital Map</SectionTitle>
          <Suspense fallback={null}>
            <MapView
              center={{ lat: hospital.latitude, lng: hospital.longitude }}
              zoom={15}
              hospitals={[hospital]}
              height="260px"
            />
          </Suspense>
        </>
      )}
    </div>
  );

  /* ════ BED MAP ════ */
  if (section === "bedmap") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🛏️ Bed Management" subtitle={`${beds.length} beds — ${hospital?.name}`} />
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Object.entries(statusStyle).map(([s, st]) => (
          <span key={s} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: st.bg, color: st.text, border: `1px solid ${st.border}`, textTransform: "capitalize" }}>● {s}</span>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(60px,1fr))", gap: 10 }}>
        {beds.map(bed => {
          const st = statusStyle[bed.status] || statusStyle.maintenance;
          return (
            <div key={bed.id} title={`${bed.bed_number} — ${bed.status}${bed.ward ? ` · ${bed.ward}` : ""}`}
              style={{ aspectRatio: "1", borderRadius: 12, border: `2px solid ${st.border}`, background: st.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: st.text, cursor: "pointer", transition: "transform 0.15s" }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            >
              <span style={{ fontSize: 14 }}>{bed.status === "available" ? "🟢" : bed.status === "occupied" ? "🔴" : bed.status === "reserved" ? "🟡" : "⚙️"}</span>
              <span>{bed.bed_number.replace(/[^\d]/g, "").slice(-3) || bed.bed_number.slice(-2)}</span>
            </div>
          );
        })}
      </div>
      {beds.length === 0 && <EmptyState icon="🛏️" message="No beds configured." />}
    </div>
  );

  /* ════ BOOKINGS ════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 Booking Requests" subtitle={`${bookings.length} pending`} badge={newCount > 0 ? `${newCount} new` : undefined} badgeColor="amber" />
      {toast && <AlertBox type={toast.startsWith("❌") ? "error" : "success"}>{toast}</AlertBox>}
      {bookings.length === 0
        ? <EmptyState icon="✅" message="No pending bookings" />
        : bookings.map(b => (
          <Card key={b.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  <StatusBadge status={b.status} />
                  {b.patient_lat && <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700 }}>📍 Patient: {b.patient_lat.toFixed(3)}, {b.patient_lng.toFixed(3)}</span>}
                </div>
                <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                  Bed {b.beds?.bed_number} ({b.beds?.bed_type}) — {b.beds?.ward || "N/A"}
                </p>
                {b.notes && <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>📋 {b.notes}</p>}
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>{new Date(b.booked_at).toLocaleString("en-IN")}</p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {b.status === "pending" && <>
                  <ActionBtn label="✅ Confirm" color="#3b82f6" onClick={() => updateBooking(b, "confirmed")} disabled={acting === b.id} />
                  <ActionBtn label="❌ Cancel" color="#ef4444" onClick={() => updateBooking(b, "cancelled")} disabled={acting === b.id} />
                </>}
                {b.status === "confirmed" && <>
                  <ActionBtn label="🏨 Admit" color="#8b5cf6" onClick={() => updateBooking(b, "admitted")} disabled={acting === b.id} />
                  <ActionBtn label="❌ Cancel" color="#ef4444" onClick={() => updateBooking(b, "cancelled")} disabled={acting === b.id} />
                </>}
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════ ADMITTED ════ */
  if (section === "admitted") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🏨 Admitted Patients" subtitle={`${admitted.length} currently admitted`} />
      {toast && <AlertBox type={toast.startsWith("❌") ? "error" : "success"}>{toast}</AlertBox>}
      {admitted.length === 0
        ? <EmptyState icon="🏨" message="No patients currently admitted" />
        : admitted.map(b => (
          <Card key={b.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
              <div>
                <StatusBadge status="admitted" />
                <InfoRow label="Bed" value={`${b.beds?.bed_number} — ${b.beds?.ward || "N/A"}`} icon="🛏️" />
                {b.attending_doctor && <InfoRow label="Doctor" value={b.attending_doctor} icon="👨‍⚕️" />}
                {b.admitted_at && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Admitted: {new Date(b.admitted_at).toLocaleString("en-IN")}</p>}
              </div>
              <ActionBtn label="🚪 Discharge" color="#10b981" onClick={() => updateBooking(b, "discharged")} disabled={acting === b.id} />
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════ OPD ════ */
  if (section === "opd") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🧑‍⚕️ OPD Queue" subtitle="Outpatient department" />
      <Card style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <p style={{ fontSize: 48, fontWeight: 900, color: "#0f172a", margin: 0 }}>{hospital?.opd_queue_count || 0}</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>patients waiting</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button onClick={async () => { await supabase.from("hospitals").update({ opd_queue_count: (hospital?.opd_queue_count || 0) + 1 }).eq("id", hospital.id); setHospital(h => ({ ...h, opd_queue_count: (h?.opd_queue_count || 0) + 1 })); }} style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer" }}>+1</button>
            <button onClick={async () => { const n = Math.max(0, (hospital?.opd_queue_count || 0) - 1); await supabase.from("hospitals").update({ opd_queue_count: n }).eq("id", hospital.id); setHospital(h => ({ ...h, opd_queue_count: n })); }} style={{ padding: "10px 16px", borderRadius: 12, border: "none", background: "#ef4444", color: "#fff", fontWeight: 800, cursor: "pointer" }}>-1</button>
            <button onClick={async () => { await supabase.from("hospitals").update({ opd_queue_count: 0 }).eq("id", hospital.id); setHospital(h => ({ ...h, opd_queue_count: 0 })); }} style={{ padding: "10px 16px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 800, cursor: "pointer" }}>Reset</button>
          </div>
        </div>
      </Card>
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}