// src/components/dashboard/StaffDashboard.jsx — Real-time + hospital linking + confirm/admit/discharge
import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import { useRealtime } from "../../hooks/useRealtime";
import StaffHospitalSelector from "../onboarding/StaffHospitalSelector";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner, Card,
  BedBar, DashboardHeader, InfoRow, StatusBadge, AlertBox,
} from "../shared/UIComponents";

const MapView = lazy(() => import("../maps/MapView"));

export default function StaffDashboard({ section }) {
  const { user } = useAuth();

  // PERSISTENCE FIX:
  // user?.hospital_id comes from DB via useAuth (authoritative across logins)
  // localHospId is only set within-session (first time they pick, before next login)
  // Combined: if DB has it, selector is NEVER shown. If they just picked, localHospId covers it.
  const [localHospId, setLocalHospId] = useState(null);
  const linkedHospitalId = user?.hospital_id || localHospId;
  const [hospital, setHospital] = useState(null);
  const [beds, setBeds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [newCount, setNewCount] = useState(0);
  const [acting, setActing] = useState(null);

  const showToast = (msg, duration = 4000) => {
    setToast(msg); setTimeout(() => setToast(""), duration);
  };

  // Called by StaffHospitalSelector once hospital is chosen
  const handleHospitalLinked = (hospId) => setLocalHospId(hospId);

  const load = useCallback(async () => {
    if (!user || !linkedHospitalId) return;
    setLoading(true);
    // Run ALL queries in parallel — no sequential dependency on hospital state
    const [hospRes, bedRes, bkRes, admRes] = await Promise.all([
      supabase.from("hospitals").select("*").eq("id", linkedHospitalId).maybeSingle(),
      supabase.from("beds").select("*").eq("hospital_id", linkedHospitalId).order("bed_number"),
      supabase.from("bookings")
        // We do NOT use !inner here, this is strictly a LEFT JOIN. 
        // If patient_profiles or beds is null/blocked by RLS, the booking itself STILL loads
        .select(`
          *,
          beds ( bed_number, bed_type, ward ),
          patient_profiles ( blood_group, allergies )
        `)
        .eq("hospital_id", linkedHospitalId)
        .in("status", ["pending", "confirmed"])
        .order("booked_at", { ascending: false }),
      supabase.from("bookings")
        .select(`
          *,
          beds ( bed_number, bed_type, ward )
        `)
        .eq("hospital_id", linkedHospitalId)
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false }),
    ]);
    setHospital(hospRes.data || null);
    setBeds(bedRes.data || []);
    setBookings(bkRes.data || []);
    setAdmitted(admRes.data || []);
    setLoading(false);
  }, [user, linkedHospitalId]);

  useEffect(() => { load(); }, [load]);

  // Server-side filter = Supabase only sends events for THIS hospital
  // No need to check hospital_id in JS callback anymore
  const rtFilter = linkedHospitalId ? `hospital_id=eq.${linkedHospitalId}` : undefined;
  useRealtime("bookings", { event: "INSERT", filter: rtFilter }, (payload) => {
    setNewCount(n => n + 1);
    showToast("🆕 New booking request received!");
    load();
  });
  useRealtime("bookings", { event: "UPDATE", filter: rtFilter }, () => load());
  useRealtime("beds", { filter: `hospital_id=eq.${linkedHospitalId || "none"}` }, () => load());

  // ── Conditional return: AFTER all hooks ──
  if (user && !linkedHospitalId) {
    return <StaffHospitalSelector userId={user.id} onLinked={handleHospitalLinked} />;
  }

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

  // Staff can manually toggle a bed's status
  const toggleBed = async (bed) => {
    const next = bed.status === "available" ? "occupied"
      : bed.status === "occupied" ? "maintenance"
        : "available";
    await supabase.from("beds").update({ status: next }).eq("id", bed.id);
    // Update hospital available_beds count
    const { data: hb } = await supabase.from("beds").select("status").eq("hospital_id", linkedHospitalId);
    if (hb) await supabase.from("hospitals").update({ available_beds: hb.filter(b => b.status === "available").length }).eq("id", linkedHospitalId);
    load();
  };

  if (loading) return <LoadingSpinner />;

  const availBeds = beds.filter(b => b.status === "available").length;
  const icuBeds = beds.filter(b => b.bed_type === "ICU" || b.ward === "ICU");
  const availIcu = icuBeds.filter(b => b.status === "available").length;
  const nicu = beds.filter(b => b.ward === "NICU" || b.bed_type === "NICU");

  // Group beds by ward for the ward view
  const WARD_ORDER = ["ICU", "NICU", "Emergency", "General", "Private", "Maternity", "OPD"];
  const wardGroups = beds.reduce((acc, b) => {
    const key = b.ward || b.bed_type || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(b);
    return acc;
  }, {});

  const WARD_META = {
    ICU: { icon: "❤️\u200d🔥", color: "#ef4444", bg: "#fef2f2", border: "#fecaca" },
    NICU: { icon: "👶", color: "#f97316", bg: "#fff7ed", border: "#fed7aa" },
    Emergency: { icon: "🚨", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
    General: { icon: "🛏️", color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe" },
    Private: { icon: "🏠", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
    Maternity: { icon: "🤱", color: "#db2777", bg: "#fdf2f8", border: "#fbcfe8" },
    OPD: { icon: "🩺", color: "#059669", bg: "#f0fdf4", border: "#a7f3d0" },
  };

  const BED_STATUS = {
    available: { dot: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", label: "Free" },
    occupied: { dot: "#ef4444", bg: "#fef2f2", border: "#fecaca", label: "Occupied" },
    reserved: { dot: "#f59e0b", bg: "#fffbeb", border: "#fde68a", label: "Reserved" },
    maintenance: { dot: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", label: "Maint." },
  };

  const ActionBtn = ({ label, color, onClick, disabled }) => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "8px 18px", borderRadius: 10, border: "none",
      background: disabled ? "#f1f5f9" : color, color: disabled ? "#94a3b8" : "#fff",
      fontSize: 13, fontWeight: 800, cursor: disabled ? "not-allowed" : "pointer",
      boxShadow: disabled ? "none" : `0 3px 10px ${color}60`,
      transition: "all 0.15s",
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

      {/* Ward Breakdown — uses wardGroups (array of beds per ward) */}
      {Object.keys(wardGroups).length > 0 && (
        <div>
          <SectionTitle>🛏️ Ward Overview</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 }}>
            {Object.entries(wardGroups).map(([ward, wBeds]) => {
              const total = wBeds.length;
              const avail = wBeds.filter(b => b.status === "available").length;
              const occupied = wBeds.filter(b => b.status === "occupied").length;
              const pct = total ? Math.round((occupied / total) * 100) : 0;
              const meta = WARD_META[ward] || { icon: "🛏️", color: "#2563eb", bg: "#f8fafc", border: "#e2e8f0" };
              return (
                <Card key={ward} style={{ borderColor: meta.border }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: meta.color, margin: "0 0 10px" }}>
                    {meta.icon} {ward}
                  </p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>{avail}</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>/ {total} free</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : meta.color, borderRadius: 3, transition: "width 0.6s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                    <span>{occupied} occupied</span>
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
  if (section === "bedmap") {
    const wardKeys = [...new Set([...WARD_ORDER, ...Object.keys(wardGroups)])].filter(w => wardGroups[w]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <DashboardHeader title="🛏️ Ward & Bed Management" subtitle={`${beds.length} beds — ${hospital?.name}`} />

        {/* Legend */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", padding: "10px 0" }}>
          {Object.entries(BED_STATUS).map(([s, st]) => (
            <span key={s} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: st.bg, color: st.dot, border: `1px solid ${st.border}` }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: st.dot, display: "inline-block" }} />
              {st.label}
            </span>
          ))}
          <span style={{ fontSize: 11, color: "#94a3b8", alignSelf: "center", marginLeft: 4 }}>Click any bed to toggle status</span>
        </div>

        {/* Ward sections */}
        {wardKeys.map(ward => {
          const wBeds = wardGroups[ward] || [];
          const meta = WARD_META[ward] || { icon: "🛏️", color: "#2563eb", bg: "#f8fafc", border: "#e2e8f0" };
          const wAvail = wBeds.filter(b => b.status === "available").length;
          const wOccup = wBeds.filter(b => b.status === "occupied").length;
          const pct = wBeds.length ? Math.round((wOccup / wBeds.length) * 100) : 0;
          return (
            <div key={ward} style={{ borderRadius: 20, border: `1.5px solid ${meta.border}`, overflow: "hidden" }}>
              {/* Ward header */}
              <div style={{ padding: "14px 20px", background: meta.bg, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 900, color: meta.color, margin: 0 }}>{ward} Ward</p>
                  <p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{wAvail} free · {wOccup} occupied of {wBeds.length}</p>
                </div>
                {/* Occupancy bar */}
                <div style={{ width: 120, display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : meta.color, borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: pct > 80 ? "#ef4444" : "#64748b", textAlign: "right" }}>{pct}% full</span>
                </div>
              </div>
              {/* Bed grid */}
              <div style={{ padding: 16, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(56px,1fr))", gap: 8, background: "#fff" }}>
                {wBeds.map(bed => {
                  const bs = BED_STATUS[bed.status] || BED_STATUS.maintenance;
                  return (
                    <button key={bed.id} title={`Bed ${bed.bed_number} — ${bs.label}\nClick to toggle`}
                      onClick={() => toggleBed(bed)}
                      style={{
                        aspectRatio: "1", borderRadius: 12, border: `2px solid ${bs.border}`,
                        background: bs.bg, cursor: "pointer",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        gap: 3, transition: "all 0.15s", padding: 0,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = `0 4px 12px ${bs.border}`; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
                    >
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: bs.dot }} />
                      <span style={{ fontSize: 10, fontWeight: 800, color: bs.dot, lineHeight: 1 }}>
                        {bed.bed_number.toString().replace(/^[A-Z]+/i, "").slice(-3) || bed.bed_number}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {beds.length === 0 && <EmptyState icon="🛏️" message="No beds configured for this hospital yet." />}
      </div>
    );
  }

  /* ════ BOOKINGS ════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 Booking Requests" subtitle={`${bookings.length} pending`} badge={newCount > 0 ? `${newCount} NEW` : undefined} badgeColor="amber" />
      {toast && <AlertBox type={toast.startsWith("❌") ? "error" : "success"}>{toast}</AlertBox>}

      {bookings.length === 0 ? (
        <EmptyState icon="✅" message="No pending bookings right now" />
      ) : bookings.map(b => (
        <Card key={b.id} style={{ border: b.status === "pending" ? "2px solid #bfdbfe" : "1px solid #e2e8f0", background: b.status === "pending" ? "#f8fbff" : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
                <StatusBadge status={b.status} />
                {b.status === "pending" && <span style={{ fontSize: 11, fontWeight: 900, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 8 }}>⏳ Awaiting Confirmation</span>}
              </div>
              <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: "0 0 4px" }}>
                🛏️ Bed {b.beds?.bed_number || "—"}
                {b.beds?.ward && <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginLeft: 8 }}>({b.beds.ward})</span>}
              </p>
              <p style={{ fontSize: 12, color: "#64748b", margin: "0 0 4px" }}>Type: {b.beds?.bed_type || "General"}</p>
              {b.notes && <p style={{ fontSize: 12, color: "#94a3b8", margin: "0 0 4px" }}>📋 {b.notes}</p>}
              {b.patient_lat && <p style={{ fontSize: 11, color: "#3b82f6", fontWeight: 700, margin: 0 }}>📍 Patient at {b.patient_lat.toFixed(4)}, {b.patient_lng.toFixed(4)}</p>}
              <p style={{ fontSize: 11, color: "#cbd5e1", margin: "4px 0 0" }}>{new Date(b.booked_at || Date.now()).toLocaleString("en-IN")}</p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              {b.status === "pending" && <>
                <ActionBtn label="✅ Confirm Booking" color="#2563eb" onClick={() => updateBooking(b, "confirmed")} disabled={acting === b.id} />
                <ActionBtn label="❌ Reject" color="#ef4444" onClick={() => updateBooking(b, "cancelled")} disabled={acting === b.id} />
              </>}
              {b.status === "confirmed" && <>
                <ActionBtn label="🏨 Admit Patient" color="#7c3aed" onClick={() => updateBooking(b, "admitted")} disabled={acting === b.id} />
                <ActionBtn label="❌ Cancel" color="#ef4444" onClick={() => updateBooking(b, "cancelled")} disabled={acting === b.id} />
              </>}
            </div>
          </div>
        </Card>
      ))}
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