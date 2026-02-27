// src/components/dashboard/DriverDashboard.jsx — Real-time SOS + live map navigation
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import { useGeolocation } from "../../hooks/useGeolocation";
import { useRealtime } from "../../hooks/useRealtime";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner,
  Card, DashboardHeader, InfoRow, StatusBadge, AlertBox,
} from "../shared/UIComponents";

const MapView = lazy(() => import("../maps/MapView"));

export default function DriverDashboard({ section }) {
  const { user } = useAuth();
  const { coords } = useGeolocation({ watch: true });

  const [ambulance, setAmbulance] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [pendingSOS, setPendingSOS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const [toast, setToast] = useState("");
  const shareTimer = useRef(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 5000); };

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: amb } = await supabase.from("ambulances").select("*").eq("driver_id", user.id).maybeSingle();
    setAmbulance(amb);

    const [d, sos] = await Promise.all([
      supabase.from("dispatches").select("*, hospitals(name,address)").eq("ambulance_id", amb?.id || "00000000-0000-0000-0000-000000000000").order("requested_at", { ascending: false }).limit(20),
      supabase.from("dispatches").select("*").is("ambulance_id", null).eq("status", "pending").order("requested_at", { ascending: false }).limit(20),
    ]);
    setDispatches(d.data || []);
    setPendingSOS(sos.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // ── Real-time: new SOS pings ──
  useRealtime("dispatches", { event: "INSERT" }, (payload) => {
    if (!payload.new?.ambulance_id) {
      setPendingSOS(prev => [payload.new, ...prev]);
      showToast("🆘 New emergency SOS received!");
    }
  });

  // ── Real-time: dispatch updated (e.g. another driver claimed it) ──
  useRealtime("dispatches", { event: "UPDATE" }, () => { load(); });

  // ── GPS broadcasting — push to ambulances table every 5s ──
  useEffect(() => {
    if (sharing && coords && ambulance) {
      shareTimer.current = setInterval(async () => {
        await supabase.from("ambulances").update({
          latitude: coords.lat, longitude: coords.lng,
          last_location_update: new Date().toISOString(),
        }).eq("id", ambulance.id);
      }, 5000);
    } else {
      clearInterval(shareTimer.current);
    }
    return () => clearInterval(shareTimer.current);
  }, [sharing, coords, ambulance]);

  const acceptSOS = async (dispatch) => {
    if (!ambulance) return;
    setAccepting(dispatch.id);
    const { error } = await supabase.from("dispatches").update({ ambulance_id: ambulance.id, status: "accepted" }).eq("id", dispatch.id).is("ambulance_id", null);
    if (!error) {
      await supabase.from("ambulances").update({ status: "dispatched" }).eq("id", ambulance.id);
      showToast("✅ Dispatch accepted! Navigate to patient.");
    } else { showToast("❌ " + error.message); }
    setAccepting(null);
    load();
  };

  if (loading) return <LoadingSpinner />;

  const activeDispatch = dispatches.find(d => ["accepted", "en_route", "arrived"].includes(d.status));
  const completedToday = dispatches.filter(d => d.status === "completed" && d.completed_at && new Date(d.completed_at).toDateString() === new Date().toDateString()).length;

  // Build route line for active dispatch: driver position → patient SOS location
  const routeLine = (activeDispatch?.pickup_lat && coords)
    ? [[coords.lat, coords.lng], [activeDispatch.pickup_lat, activeDispatch.pickup_lng]]
    : null;

  const scMap = { available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669", dot: "#10b981" }, dispatched: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" }, maintenance: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" }, offline: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", dot: "#94a3b8" } };
  const sc = scMap[ambulance?.status] || scMap.offline;

  /* ════ HOME ════ */
  if (!section || section === "home") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {toast && <AlertBox type={toast.startsWith("❌") ? "error" : "success"}>{toast}</AlertBox>}

      <div style={{ borderRadius: 16, padding: 24, border: "1px solid #fed7aa", background: "linear-gradient(135deg,#fff7ed 0%,#fff 60%)" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Driver Dashboard</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{ambulance ? ambulance.vehicle_number : "No Vehicle Assigned"}</h1>
        {ambulance && <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
          <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
            {ambulance.status?.toUpperCase()}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{ambulance.ambulance_type}</span>
        </div>}
      </div>

      {!ambulance && <AlertBox type="error">No ambulance linked to your account. Contact admin.</AlertBox>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <StatCard icon="✅" label="Done Today" value={completedToday} color="emerald" />
        <StatCard icon="📡" label="Active Job" value={activeDispatch ? "ACTIVE" : "FREE"} color={activeDispatch ? "amber" : "cyan"} />
        <StatCard icon="🆘" label="Pending SOS" value={pendingSOS.length} color={pendingSOS.length > 0 ? "red" : "emerald"} />
      </div>

      {/* Live Map */}
      <Suspense fallback={null}>
        <SectionTitle>🗺️ Live Map</SectionTitle>
        <MapView
          myPosition={coords}
          sosPings={pendingSOS}
          patientPos={activeDispatch?.pickup_lat ? { lat: activeDispatch.pickup_lat, lng: activeDispatch.pickup_lng } : null}
          routeLine={routeLine}
          zoom={13}
          height="300px"
        />
        {coords && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>📍 Your GPS: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>}
      </Suspense>

      {/* Pending SOS */}
      {pendingSOS.length > 0 && (
        <div>
          <SectionTitle>🆘 Emergency Requests ({pendingSOS.length})</SectionTitle>
          {pendingSOS.map(d => (
            <Card key={d.id} style={{ borderColor: "#fecaca", background: "#fef2f2", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 20 }}>🆘</span>
                    <p style={{ fontSize: 14, fontWeight: 900, color: "#dc2626", margin: 0 }}>EMERGENCY SOS</p>
                  </div>
                  <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>📍 {d.pickup_address || "GPS coordinates"}</p>
                  {d.pickup_lat && (
                    <a href={`https://maps.google.com/?q=${d.pickup_lat},${d.pickup_lng}`} target="_blank" rel="noreferrer"
                      style={{ fontSize: 11, color: "#3b82f6", textDecoration: "underline", display: "block", marginTop: 4 }}>
                      📌 Open in Google Maps ({parseFloat(d.pickup_lat).toFixed(4)}, {parseFloat(d.pickup_lng).toFixed(4)})
                    </a>
                  )}
                  {d.notes && <p style={{ fontSize: 11, color: "#b91c1c", fontWeight: 700, margin: "4px 0 0" }}>{d.notes}</p>}
                  <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>{new Date(d.requested_at).toLocaleTimeString("en-IN")}</p>
                </div>
                <button onClick={() => acceptSOS(d)} disabled={!!accepting || ambulance?.status !== "available"}
                  style={{ padding: "10px 20px", borderRadius: 12, border: "none", background: accepting === d.id ? "#94a3b8" : ambulance?.status !== "available" ? "#f1f5f9" : "linear-gradient(135deg,#dc2626,#ef4444)", color: ambulance?.status !== "available" ? "#94a3b8" : "#fff", fontWeight: 900, fontSize: 12, cursor: ambulance?.status === "available" ? "pointer" : "not-allowed", whiteSpace: "nowrap", boxShadow: ambulance?.status === "available" ? "0 4px 12px rgba(220,38,38,0.3)" : "none" }}>
                  {accepting === d.id ? "Claiming..." : ambulance?.status !== "available" ? "Unavailable" : "Accept 🚑"}
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Active dispatch */}
      {activeDispatch ? (
        <Card style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span style={{ fontSize: 24 }}>📡</span>
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>Active Dispatch</p>
              <StatusBadge status={activeDispatch.status} />
            </div>
          </div>
          <InfoRow label="Pickup" value={activeDispatch.pickup_address || "GPS"} icon="📍" />
          {activeDispatch.hospitals && <InfoRow label="Hospital" value={activeDispatch.hospitals.name} icon="🏥" />}
          {activeDispatch.pickup_lat && (
            <a href={`https://maps.google.com/?q=${activeDispatch.pickup_lat},${activeDispatch.pickup_lng}`} target="_blank" rel="noreferrer"
              style={{ fontSize: 12, color: "#3b82f6", textDecoration: "underline", display: "block", marginTop: 8, fontWeight: 700 }}>
              🗺️ Get Directions to Patient →
            </a>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            {activeDispatch.status === "accepted" && (
              <button onClick={async () => { await supabase.from("dispatches").update({ status: "en_route" }).eq("id", activeDispatch.id); load(); }}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#f97316", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                🚗 En Route
              </button>
            )}
            {activeDispatch.status === "en_route" && (
              <button onClick={async () => { await supabase.from("dispatches").update({ status: "arrived" }).eq("id", activeDispatch.id); load(); }}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#8b5cf6", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                🏁 Arrived
              </button>
            )}
            {activeDispatch.status === "arrived" && (
              <button onClick={async () => { await supabase.from("dispatches").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activeDispatch.id); await supabase.from("ambulances").update({ status: "available" }).eq("id", ambulance.id); load(); }}
                style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#10b981", color: "#fff", fontWeight: 800, cursor: "pointer", fontSize: 12 }}>
                ✅ Completed
              </button>
            )}
          </div>
        </Card>
      ) : (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🚦</span>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>On standby — waiting for dispatch</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>SOS requests appear above in real-time</p>
          </div>
        </Card>
      )}

      {/* GPS sharing card */}
      <Card style={sharing ? { borderColor: "#a7f3d0", background: "#ecfdf5" } : {}}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: sharing ? "#d1fae5" : "#f1f5f9" }}>📍</div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>GPS Location Sharing</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>{sharing ? "Broadcasting every 5s" : "Off — enable so admin & patients can track you"}</p>
              {sharing && coords && <p style={{ fontSize: 10, color: "#059669", fontWeight: 700, margin: "2px 0 0" }}>📍 {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</p>}
            </div>
          </div>
          <button onClick={() => setSharing(!sharing)} style={{ padding: "10px 20px", borderRadius: 12, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer", background: sharing ? "#fef2f2" : "#10b981", color: sharing ? "#dc2626" : "#fff", boxShadow: sharing ? "none" : "0 2px 8px rgba(16,185,129,0.3)" }}>
            {sharing ? "Stop" : "Start Sharing"}
          </button>
        </div>
      </Card>
    </div>
  );

  /* ════ MY AMBULANCE ════ */
  if (section === "ambulance") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🚑 My Ambulance" subtitle="Vehicle info & status" />
      {!ambulance ? <AlertBox type="error">No ambulance linked.</AlertBox> : (
        <>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {[["Vehicle No", ambulance.vehicle_number, "🚗"], ["Type", ambulance.ambulance_type, "🚑"], ["Fuel", ambulance.fuel_type, "⛽"], ["Year", ambulance.year_of_manufacture, "📅"], ["License", ambulance.license_number, "📋"], ["Status", ambulance.status, "✅"]].map(([l, v, i]) => <InfoRow key={l} label={l} value={v || "—"} icon={i} />)}
            </div>
          </Card>
          <Card>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Update Status</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 }}>
              {["available", "maintenance", "offline"].map(s => {
                const st = { available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" }, maintenance: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }, offline: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b" } }[s];
                const isActive = ambulance.status === s;
                return <button key={s} onClick={async () => { await supabase.from("ambulances").update({ status: s }).eq("id", ambulance.id); setAmbulance({ ...ambulance, status: s }); }} style={{ padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 800, textTransform: "capitalize", cursor: "pointer", border: `1px solid ${isActive ? st.border : "#e2e8f0"}`, background: isActive ? st.bg : "#fff", color: isActive ? st.text : "#94a3b8" }}>{s}</button>;
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );

  /* ════ DISPATCHES ════ */
  if (section === "dispatches") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📡 Dispatch History" subtitle="Past assignments" />
      {dispatches.length === 0 ? <EmptyState icon="📡" message="No dispatches yet" /> : dispatches.map(d => (
        <Card key={d.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div>
              <StatusBadge status={d.status} />
              <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0" }}>{d.pickup_address || "GPS"}</p>
              {d.hospitals && <InfoRow label="Hospital" value={d.hospitals.name} icon="🏥" />}
              {d.pickup_lat && <a href={`https://maps.google.com/?q=${d.pickup_lat},${d.pickup_lng}`} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#3b82f6", textDecoration: "underline" }}>View location</a>}
            </div>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(d.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
          </div>
        </Card>
      ))}
    </div>
  );

  return <EmptyState icon="🚑" message="Select a section from the sidebar" />;
}