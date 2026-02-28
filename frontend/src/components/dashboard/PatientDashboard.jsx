// src/components/dashboard/PatientDashboard.jsx
// Fixed: editMode useState moved to top of component (not in conditional — React hooks rule)
// Fixed: Overpass API timeout extended + fallback empty array on failure
// Fixed: bed estimation always shown for OSM hospitals
import React, { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useRealtime } from "../../hooks/useRealtime";
import { useNearbyHospitals, ensureHospitalInDB } from "../../hooks/useNearbyHospitals";
import PatientOnboarding from "../onboarding/PatientOnboarding";
import LocationPicker from "../shared/LocationPicker";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, DashboardHeader, InfoRow, AlertBox,
} from "../shared/UIComponents";

const MapView = lazy(() => import("../maps/MapView"));

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
  return h;
}
const BED_TYPES = ["General", "ICU", "Emergency", "Pediatric", "Maternity", "Ventilator"];
function generateVirtualBeds(name, count) {
  const h = hashStr(name);
  const out = [];
  const typePercents = [0.50, 0.15, 0.15, 0.10, 0.05, 0.05];
  let n = 1;
  BED_TYPES.forEach((type, ti) => {
    const cnt = Math.max(1, Math.round(count * typePercents[ti]));
    for (let i = 0; i < cnt; i++) {
      out.push({
        id: `virtual_${type}_${i}_${h}`,
        bed_number: `${type[0]}${n++}`,
        bed_type: type, ward: `${type} Ward`,
        floor: String(Math.ceil(n / 20)), virtual: true,
      });
    }
  });
  return out;
}

/* ──────────────────────────────────────────────────────────
   BookBedModal
────────────────────────────────────────────────────────── */
function BookBedModal({ hospital, userId, myCoords, onClose, onBooked }) {
  const [step, setStep] = useState("browse");
  const [beds, setBeds] = useState([]);
  const [selected, setSelected] = useState(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [hospId, setHospId] = useState(hospital.db_id || (hospital.is_in_db ? hospital.id : null));

  useEffect(() => {
    if (hospId) {
      supabase.from("beds").select("*").eq("hospital_id", hospId).eq("status", "available")
        .then(({ data }) => {
          setBeds(data && data.length > 0
            ? data
            : generateVirtualBeds(hospital.name, hospital.available_beds || 20));
        });
    } else {
      setBeds(generateVirtualBeds(hospital.name, hospital.available_beds || 20));
    }
  }, [hospId]);

  const book = async () => {
    if (!selected) return setErr("Please select a bed.");
    setStep("booking");
    try {
      let finalHospId = hospId;
      if (!finalHospId) {
        finalHospId = await ensureHospitalInDB(hospital);
        setHospId(finalHospId);
      }
      let bedId = null;
      if (!selected.virtual) {
        bedId = selected.id;
      } else {
        const { data: ex } = await supabase.from("beds").select("id")
          .eq("hospital_id", finalHospId).eq("bed_number", selected.bed_number).maybeSingle();
        if (ex) { bedId = ex.id; }
        else {
          const { data: nb, error: be } = await supabase.from("beds").insert({
            hospital_id: finalHospId, bed_number: selected.bed_number,
            bed_type: selected.bed_type, ward: selected.ward,
            floor: selected.floor, status: "available",
          }).select("id").single();
          if (be) throw new Error(be.message);
          bedId = nb.id;
        }
      }
      await supabase.from("beds").update({ status: "reserved" }).eq("id", bedId);
      const { error: bErr } = await supabase.from("bookings").insert({
        patient_id: userId, hospital_id: finalHospId, bed_id: bedId,
        status: "pending", notes: reason || null,
        patient_lat: myCoords?.lat || null, patient_lng: myCoords?.lng || null,
      });
      if (bErr) throw new Error(bErr.message);
      setStep("done");
      setTimeout(() => { onBooked(); onClose(); }, 1800);
    } catch (e) { setErr(e.message); setStep("error"); }
  };

  const typeColors = { General: "#3b82f6", ICU: "#ef4444", Emergency: "#f97316", Pediatric: "#8b5cf6", Maternity: "#ec4899", Ventilator: "#06b6d4" };
  const dist = hospital.distance_km < 1 ? `${Math.round(hospital.distance_km * 1000)}m` : `${hospital.distance_km.toFixed(1)}km`;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, background: "#fff", borderRadius: 20, boxShadow: "0 24px 64px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", maxHeight: "92vh" }}>
        {/* Header */}
        <div style={{ padding: "22px 24px 14px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0, marginRight: 12 }}>
              <h3 style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>🛏️ {hospital.name}</h3>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>📍 {hospital.address || "See map"} · 📏 {dist}</p>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>🛏️ ~{hospital.available_beds} free</span>
            {hospital.emergency && <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 800, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca" }}>🚨 ER</span>}
            {hospital.is_estimated && <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 11, fontWeight: 700, background: "#fffbeb", color: "#92400e", border: "1px solid #fde68a" }}>📊 Estimated</span>}
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: "16px 24px", overflowY: "auto", flex: 1 }}>
          {step === "booking" && <div style={{ textAlign: "center", padding: "32px 0" }}><div style={{ fontSize: 36 }}>⏳</div><p style={{ fontWeight: 800, marginTop: 12 }}>Registering &amp; booking…</p></div>}
          {step === "done" && <div style={{ textAlign: "center", padding: "32px 0" }}><div style={{ fontSize: 40 }}>✅</div><p style={{ fontWeight: 900, color: "#059669", fontSize: 16, marginTop: 12 }}>Bed Booked! Staff notified.</p></div>}
          {(step === "browse" || step === "error") && (
            <>
              {err && <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 14, border: "1px solid #fecaca" }}>{err}</div>}
              <p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Available Beds ({beds.length})</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16, maxHeight: 220, overflowY: "auto" }}>
                {beds.map(bed => {
                  const tc = typeColors[bed.bed_type] || "#64748b";
                  const sel = selected?.id === bed.id;
                  return (
                    <button key={bed.id} onClick={() => setSelected(bed)} style={{
                      padding: "10px 4px", borderRadius: 10, textAlign: "center", cursor: "pointer",
                      border: `2px solid ${sel ? tc : "#e2e8f0"}`,
                      background: sel ? `${tc}18` : "#f8fafc",
                      color: sel ? tc : "#64748b", fontSize: 10, fontWeight: 800, lineHeight: 1.4,
                    }}>
                      {bed.bed_number}<br /><span style={{ fontSize: 9 }}>{bed.bed_type.slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>
              {selected && (
                <div style={{ padding: "10px 16px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: 14 }}>
                  <p style={{ fontSize: 12, color: "#059669", fontWeight: 800, margin: 0 }}>✅ {selected.bed_number} — {selected.bed_type} · {selected.ward}</p>
                </div>
              )}
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for admission (optional)"
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
            </>
          )}
        </div>
        {(step === "browse" || step === "error") && (
          <div style={{ padding: "14px 24px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={book} disabled={!selected} style={{ flex: 2, padding: "13px", borderRadius: 12, border: "none", background: selected ? "#10b981" : "#e2e8f0", color: selected ? "#fff" : "#94a3b8", fontWeight: 900, cursor: selected ? "pointer" : "not-allowed" }}>
              {hospital.is_estimated ? "📝 Register & Book" : "Confirm Booking"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   SOSModal
────────────────────────────────────────────────────────── */
function SOSModal({ userId, myCoords, onClose }) {
  const [status, setStatus] = useState("locating");
  const [msg, setMsg] = useState("");
  const [nearestDriver, setNearestDriver] = useState(null);

  useEffect(() => {
    const send = async (lat, lng) => {
      setStatus("sending");
      try {
        // Use request_sos RPC — finds nearest driver via PostGIS and creates dispatch
        const { data: sosResult, error: sosErr } = await supabase
          .rpc("request_sos", {
            p_lat: lat, p_lng: lng,
            p_pickup_address: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            p_notes: "🆘 EMERGENCY SOS from MedQueue App"
          });

        if (sosErr) {
          // Fallback: direct insert if RPC not deployed yet
          await Promise.all([
            supabase.from("emergency_requests").insert({ type: "Emergency Ambulance", lat, lng, status: "pending" }),
            supabase.from("dispatches").insert({ patient_id: userId, ambulance_id: null, status: "pending", pickup_lat: lat, pickup_lng: lng, pickup_address: `GPS: ${lat.toFixed(5)}, ${lng.toFixed(5)}`, notes: "🆘 EMERGENCY SOS" }),
          ]);
        } else if (sosResult?.[0]) {
          const r = sosResult[0];
          setNearestDriver(r.nearest_driver_name
            ? { name: r.nearest_driver_name, dist: r.distance_km?.toFixed(1) }
            : null);
        }
        setStatus("sent"); setMsg(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      } catch {
        setStatus("error"); setMsg("Failed to send SOS. Try calling 112.");
      }
    };
    if (myCoords) { send(myCoords.lat, myCoords.lng); return; }
    navigator.geolocation.getCurrentPosition(
      p => send(p.coords.latitude, p.coords.longitude),
      () => { setStatus("error"); setMsg("Location denied. Enable GPS."); },
      { enableHighAccuracy: true, maximumAge: 0 }
    );
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(220,38,38,0.08)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 340, background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 24px 64px rgba(220,38,38,0.25)", textAlign: "center", border: "1px solid #fecaca" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🆘</div>
        <h3 style={{ fontWeight: 900, margin: "0 0 8px", color: status === "sent" ? "#059669" : "#dc2626" }}>
          {status === "locating" && "Getting Location…"}{status === "sending" && "Sending SOS…"}{status === "sent" && "✅ SOS Sent!"}{status === "error" && "Error"}
        </h3>
        <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>
          {status === "locating" && "Allow location when prompted."}{status === "sending" && "Broadcasting to drivers."}{status === "sent" && `Drivers notified · ${msg}`}{status === "error" && msg}
        </p>
        <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: status === "sent" ? "#10b981" : "#f1f5f9", color: status === "sent" ? "#fff" : "#64748b", fontWeight: 700, cursor: "pointer" }}>
          {status === "sent" ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   HospitalCard
────────────────────────────────────────────────────────── */
function HospitalCard({ h, onBook }) {
  const pct = h.total_beds > 0 ? Math.min(100, (h.available_beds / h.total_beds) * 100) : 0;
  const color = h.available_beds > 15 ? "#10b981" : h.available_beds > 5 ? "#f59e0b" : "#ef4444";
  const dist = h.distance_km < 1 ? `${Math.round(h.distance_km * 1000)}m` : `${h.distance_km.toFixed(1)}km`;
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ display: "flex" }}>
        <div style={{ width: 4, flexShrink: 0, background: color }} />
        <div style={{ flex: 1, padding: "14px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 3 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 190 }}>{h.name}</p>
                {h.emergency && <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", flexShrink: 0 }}>ER</span>}
                {h.is_estimated && <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: "#fffbeb", color: "#92400e", flexShrink: 0 }}>~est</span>}
              </div>
              {h.address && <p style={{ fontSize: 11, color: "#94a3b8", margin: "0 0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {h.address}</p>}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>📏 {dist}</span>
                {h.phone && <span style={{ fontSize: 11, color: "#94a3b8" }}>📞 {h.phone}</span>}
              </div>
              {/* Bed bar — always shown */}
              <div style={{ maxWidth: 240 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#94a3b8", marginBottom: 3 }}>
                  <span>{h.is_estimated ? "~" : ""}{h.available_beds} beds free{h.is_estimated ? " (est.)" : ""}</span>
                  <span style={{ fontWeight: 800, color }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3 }} />
                </div>
              </div>
            </div>
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
              <span style={{ padding: "4px 12px", borderRadius: 11, fontSize: 11, fontWeight: 800, background: h.available_beds > 0 ? "#ecfdf5" : "#fef2f2", color: h.available_beds > 0 ? "#059669" : "#dc2626", border: `1px solid ${h.available_beds > 0 ? "#a7f3d0" : "#fecaca"}` }}>
                {h.available_beds > 0 ? `${h.available_beds} free` : "Full"}
              </span>
              <button onClick={() => onBook(h)} disabled={h.available_beds === 0} style={{ padding: "8px 16px", borderRadius: 11, border: "none", fontSize: 12, fontWeight: 800, background: h.available_beds > 0 ? "#10b981" : "#e2e8f0", color: h.available_beds > 0 ? "#fff" : "#94a3b8", cursor: h.available_beds > 0 ? "pointer" : "not-allowed" }}>
                📋 Book
              </button>
              {h.phone && <a href={`tel:${h.phone}`} style={{ fontSize: 11, color: "#3b82f6", textDecoration: "none", fontWeight: 700 }}>📞 Call</a>}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ──────────────────────────────────────────────────────────
   Main PatientDashboard
   ALL useState / useEffect calls are at the TOP — no hooks in conditionals
────────────────────────────────────────────────────────── */
export default function PatientDashboard({ section }) {
  const { user } = useAuth();
  const { coords, loading: gpsLoading, setOverride } = useGeolocation({ watch: true });
  const { hospitals: nearbyHosp, loading: hospLoading } = useNearbyHospitals(coords);

  // ─ All state at top level (React hooks rule: never inside conditionals) ─
  const [profile, setProfile] = useState(null);
  const [ambulances, setAmbulances] = useState([]);
  const [activeDispatch, setActiveDispatch] = useState(null);
  const [activeAmbulance, setActiveAmbulance] = useState(null);
  const [routeLine, setRouteLine] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookModal, setBookModal] = useState(null);
  const [showSOS, setShowSOS] = useState(false);
  const [toast, setToast] = useState("");
  const [editProfile, setEditProfile] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 6000); };

  const load = async (isBackground = false) => {
    if (!user) return;
    if (!isBackground) setLoading(true);
    const [p, a, bk, dsp] = await Promise.all([
      supabase.from("patient_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("ambulances").select("*").eq("status", "available"),
      supabase.from("bookings").select("*, hospitals(name), beds(bed_number,bed_type,ward)")
        .eq("patient_id", user.id).order("booked_at", { ascending: false }).limit(20),
      supabase.from("dispatches").select("*, ambulances(*)").eq("patient_id", user.id).in("status", ["pending", "accepted", "en_route"]).maybeSingle(),
    ]);

    setProfile(p.data);
    setAmbulances(a.data || []);
    setBookings(bk.data || []);
    setActiveDispatch(dsp.data || null);
    setActiveAmbulance(dsp.data?.ambulances || null);
    if (!isBackground) setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  useRealtime("bookings", { filter: `patient_id=eq.${user?.id}`, event: "UPDATE" }, (payload) => {
    if (payload.old?.status !== payload.new?.status) {
      showToast(`📬 Booking: ${payload.new?.status?.toUpperCase()}`);
      load(true);
    }
  });

  useRealtime("dispatches", { filter: `patient_id=eq.${user?.id}` }, () => {
    showToast("🚑 Ambulance dispatch updated!");
    load(true);
  });

  useRealtime("ambulances", { filter: activeAmbulance ? `id=eq.${activeAmbulance.id}` : undefined, event: "UPDATE" }, (payload) => {
    setActiveAmbulance(payload.new);
  });

  useEffect(() => {
    if (!activeAmbulance?.latitude || !activeAmbulance?.longitude || !coords?.lat || !coords?.lng) {
      setRouteLine(null);
      return;
    }
    fetch(`https://router.project-osrm.org/route/v1/driving/${activeAmbulance.longitude},${activeAmbulance.latitude};${coords.lng},${coords.lat}?overview=full&geometries=geojson`)
      .then(res => res.json())
      .then(data => {
        if (data.routes?.[0]?.geometry?.coordinates) {
          // GeoJSON is [lng, lat], Leaflet is [lat, lng]
          setRouteLine(data.routes[0].geometry.coordinates.map(c => [c[1], c[0]]));
        }
      }).catch(err => console.error("OSRM route error:", err));
  }, [activeAmbulance?.latitude, activeAmbulance?.longitude, coords?.lat, coords?.lng]);

  const firstName = user?.full_name?.split(" ")[0] || "there";
  const totalFree = nearbyHosp.reduce((s, h) => s + (h.available_beds || 0), 0);

  if (loading) return <LoadingSpinner />;

  /* ════════════════ HOME ════════════════ */
  if (!section || section === "home") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
      {showSOS && <SOSModal userId={user.id} myCoords={coords} onClose={() => { setShowSOS(false); load(true); }} />}
      {bookModal && <BookBedModal hospital={bookModal} userId={user.id} myCoords={coords} onClose={() => setBookModal(null)} onBooked={() => { showToast("✅ Bed booked! Staff notified."); load(true); }} />}

      <DashboardHeader title={`Welcome back, ${firstName} 👋`} subtitle={new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })} badge={profile?.blood_group ? `🩸 ${profile.blood_group}` : undefined} badgeColor="red" />
      {toast && <AlertBox type="success">{toast}</AlertBox>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 14 }}>
        <StatCard icon="🏥" label="Hospitals Nearby" value={hospLoading ? "…" : nearbyHosp.length} color="blue" />
        <StatCard icon="🚑" label="Ambulances Ready" value={ambulances.length} color="emerald" />
        <StatCard icon="🛏️" label="Free Beds" value={hospLoading ? "…" : totalFree} color="violet" />
        <StatCard icon="📋" label="My Bookings" value={bookings.length} color="amber" />
      </div>

      {/* SOS banner */}
      <div style={{ borderRadius: 16, padding: "16px 20px", border: "1px solid #fecaca", background: "linear-gradient(135deg,#fef2f2,#fff)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🆘</div>
          <div><p style={{ fontSize: 14, fontWeight: 900, color: "#dc2626", margin: 0 }}>Emergency? Act Now.</p><p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>Sends live GPS to all nearby drivers</p></div>
        </div>
        <button onClick={() => setShowSOS(true)} style={{ padding: "11px 24px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontSize: 13, fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(220,38,38,0.35)" }}>🚨 SOS — Get Ambulance</button>
      </div>

      {/* Location Picker — set demo location or override GPS */}
      <LocationPicker coords={coords} onOverride={setOverride} />

      {/* Active Ambulance Banner */}
      {activeDispatch && activeAmbulance && (
        <Card style={{ borderColor: "#3b82f6", background: "#eff6ff", padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 900, color: "#1e3a8a", margin: "0 0 4px", textTransform: "uppercase", letterSpacing: 1 }}>🚑 Ambulance Assigned</p>
              <p style={{ fontSize: 13, color: "#2563eb", margin: "0 0 4px", fontWeight: 700 }}>Vehicle: {activeAmbulance.vehicle_number}</p>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Driver is heading to your location. Watch map for live updates.</p>
            </div>
            <div style={{ fontSize: 32, animation: "pulse 2s infinite" }}>🚨</div>
          </div>
        </Card>
      )}

      {/* Map */}
      <div>
        <SectionTitle>🗺️ Hospitals &amp; Ambulances Near You</SectionTitle>
        <div style={{ isolation: "isolate", borderRadius: 16, overflow: "hidden" }}>
          <Suspense fallback={<div style={{ height: 280, background: "#f8fafc", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8" }}>🗺️ Loading map…</div>}>
            <MapView
              myPosition={coords}
              hospitals={nearbyHosp}
              ambulances={activeAmbulance ? [activeAmbulance] : ambulances}
              routeLine={routeLine}
              height="280px"
              onHospitalClick={h => h.available_beds > 0 && setBookModal(h)}
            />
          </Suspense>
        </div>
      </div>

      {/* Hospital list */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>🏥 Hospitals Near You</p>
          <span style={{ fontSize: 11, color: "#94a3b8" }}>{hospLoading ? "Searching…" : `${nearbyHosp.length} within 10km`}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!hospLoading && nearbyHosp.length === 0 && <AlertBox type="warning">Could not find hospitals. Allow location & reload — or Overpass API may be temporarily slow.</AlertBox>}
          {nearbyHosp.slice(0, 10).map(h => <HospitalCard key={h.id || h.osm_id} h={h} onBook={setBookModal} />)}
        </div>
      </div>
    </div>
  );

  /* ════════════════ MY HEALTH ════════════════ */
  // editProfile state is at top — no hooks inside this branch
  if (section === "health") {
    if (!profile || editProfile) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {editProfile && profile && (
            <button onClick={() => setEditProfile(false)} style={{ alignSelf: "flex-start", marginBottom: 12, padding: "8px 16px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>← Back to Profile</button>
          )}
          <PatientOnboarding
            onComplete={() => { setEditProfile(false); load(true); }}
            onSkip={profile ? () => setEditProfile(false) : undefined}
          />
        </div>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <DashboardHeader title="🩺 My Health Profile" subtitle="Your medical info on file" />
          <button onClick={() => setEditProfile(true)} style={{ padding: "10px 20px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#fff", color: "#3b82f6", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>✏️ Edit Profile</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(155px,1fr))", gap: 14 }}>
          {[["Blood Group", profile.blood_group || "—", "🩸", "red"], ["Gender", profile.gender ? profile.gender[0].toUpperCase() + profile.gender.slice(1) : "—", "👤", "blue"], ["Date of Birth", profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString("en-IN") : "—", "📅", "violet"], ["City", profile.city || "—", "📍", "cyan"]].map(([k, v, i, c]) => <StatCard key={k} icon={i} label={k} value={v} color={c} />)}
        </div>
        {(!profile.gender || !profile.blood_group || !profile.emergency_contact_name) && (
          <AlertBox type="warning">Profile incomplete. <button onClick={() => setEditProfile(true)} style={{ background: "none", border: "none", color: "#d97706", fontWeight: 800, cursor: "pointer", textDecoration: "underline", padding: 0 }}>Fill missing fields →</button></AlertBox>
        )}
        {profile.allergies?.length > 0 && <Card><p style={{ fontSize: 12, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⚠️ Allergies</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{profile.allergies.map(a => <span key={a} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}>{a}</span>)}</div></Card>}
        {profile.chronic_diseases?.length > 0 && <Card><p style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏥 Chronic Conditions</p><div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{profile.chronic_diseases.map(d => <span key={d} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe" }}>{d}</span>)}</div></Card>}
        {profile.emergency_contact_name ? (
          <Card style={{ borderColor: "#fecaca" }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🆘 Emergency Contact</p>
            <InfoRow label="Name" value={profile.emergency_contact_name} icon="👤" />
            <InfoRow label="Phone" value={profile.emergency_contact_phone} icon="📞" />
            <InfoRow label="Relation" value={profile.emergency_contact_relation} icon="🤝" />
          </Card>
        ) : (
          <Card style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#92400e", margin: "0 0 8px" }}>🆘 No Emergency Contact</p>
            <p style={{ fontSize: 12, color: "#78716c", margin: "0 0 10px" }}>Critical for emergencies when you can't communicate.</p>
            <button onClick={() => setEditProfile(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>Add Now →</button>
          </Card>
        )}
        {(profile.aadhar_number || profile.insurance_id) && <Card><p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>📋 Documents</p>{profile.aadhar_number && <InfoRow label="Aadhar" value={`XXXX XXXX ${profile.aadhar_number.slice(-4)}`} icon="🪪" />}{profile.insurance_id && <InfoRow label="Insurance" value={profile.insurance_id} icon="🏷️" />}</Card>}
        {profile.medical_notes && <Card><p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📝 Medical Notes</p><p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>{profile.medical_notes}</p></Card>}
      </div>
    );
  }

  /* ════════════════ BOOK A BED ════════════════ */
  if (section === "book") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {bookModal && <BookBedModal hospital={bookModal} userId={user.id} myCoords={coords} onClose={() => setBookModal(null)} onBooked={() => { showToast("✅ Booked!"); load(true); }} />}
      <DashboardHeader title="🛏️ Book a Bed" subtitle={`${nearbyHosp.length} hospitals found`} />
      {toast && <AlertBox type="success">{toast}</AlertBox>}
      {hospLoading && <AlertBox type="info">Searching hospitals near you…</AlertBox>}
      {nearbyHosp.map(h => <HospitalCard key={h.id || h.osm_id} h={h} onBook={setBookModal} />)}
      {!hospLoading && nearbyHosp.length === 0 && <EmptyState icon="🏥" message="Enable location & reload — or Overpass API may be slow." />}
    </div>
  );

  /* ════════════════ AMBULANCE ════════════════ */
  if (section === "ambulance") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showSOS && <SOSModal userId={user.id} myCoords={coords} onClose={() => { setShowSOS(false); load(true); }} />}
      <DashboardHeader title="🚑 Ambulance Services" />
      <Card style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🆘</div>
          <div><p style={{ fontSize: 15, fontWeight: 900, color: "#dc2626", margin: 0 }}>Emergency Ambulance</p><p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>Sends live GPS to all available drivers</p></div>
        </div>
        <button onClick={() => setShowSOS(true)} style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#dc2626,#ef4444)", color: "#fff", fontSize: 14, fontWeight: 900, cursor: "pointer" }}>🚨 Request Emergency Ambulance</button>
      </Card>
      <div style={{ isolation: "isolate", borderRadius: 16, overflow: "hidden" }}>
        <Suspense fallback={null}><MapView myPosition={coords} ambulances={ambulances} hospitals={nearbyHosp} height="260px" /></Suspense>
      </div>
      <SectionTitle>🚑 Available Ambulances ({ambulances.length})</SectionTitle>
      {ambulances.length === 0 ? <EmptyState icon="🚑" message="No ambulances available right now" /> : ambulances.map(a => (
        <Card key={a.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🚑</div>
              <div><p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>{a.vehicle_number || "—"}</p><p style={{ fontSize: 11, color: "#64748b", margin: 0 }}>{a.ambulance_type || "BLS"}</p></div>
            </div>
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>Available</span>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ════════════════ HOSPITALS ════════════════ */
  if (section === "hospitals") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {bookModal && <BookBedModal hospital={bookModal} userId={user.id} myCoords={coords} onClose={() => setBookModal(null)} onBooked={() => { showToast("✅ Booked!"); load(true); }} />}
      <DashboardHeader title="🏥 All Hospitals" subtitle={`${nearbyHosp.length} within 10km`} />
      <div style={{ isolation: "isolate", borderRadius: 16, overflow: "hidden" }}>
        <Suspense fallback={null}><MapView myPosition={coords} hospitals={nearbyHosp} height="240px" /></Suspense>
      </div>
      {hospLoading && <AlertBox type="info">Finding hospitals near you…</AlertBox>}
      {nearbyHosp.map(h => <HospitalCard key={h.id || h.osm_id} h={h} onBook={setBookModal} />)}
    </div>
  );

  /* ════════════════ MY BOOKINGS ════════════════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 My Bookings" />
      {bookings.length === 0 ? <EmptyState icon="🛏️" message="No bookings yet." /> : bookings.map(b => (
        <Card key={b.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{b.hospitals?.name}</p>
                <StatusBadge status={b.status} />
              </div>
              <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>{b.beds?.bed_type || "—"} — Bed {b.beds?.bed_number || "—"}{b.beds?.ward ? `, ${b.beds.ward}` : ""}</p>
              {b.notes && <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>📋 {b.notes}</p>}
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>{new Date(b.booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
          </div>
        </Card>
      ))}
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}