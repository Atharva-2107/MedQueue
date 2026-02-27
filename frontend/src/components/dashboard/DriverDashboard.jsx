// src/components/dashboard/DriverDashboard.jsx — Light mode with SOS claim feature
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner,
  Card, DashboardHeader, InfoRow, StatusBadge, AlertBox,
} from "../shared/UIComponents";

export default function DriverDashboard({ section }) {
  const { user } = useAuth();
  const [ambulance, setAmbulance] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [pendingSOS, setPendingSOS] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locationShare, setLocationShare] = useState(false);
  const [accepting, setAccepting] = useState(null);
  const watchRef = useRef(null);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data: amb } = await supabase
      .from("ambulances").select("*").eq("driver_id", user.id).maybeSingle();
    setAmbulance(amb);

    const { data: d } = await supabase
      .from("dispatches")
      .select("*, hospitals(name, address)")
      .eq("ambulance_id", amb?.id)
      .order("requested_at", { ascending: false })
      .limit(20);
    setDispatches(d || []);

    // Pending SOS requests without an ambulance assigned yet
    const { data: sos } = await supabase
      .from("dispatches")
      .select("*")
      .is("ambulance_id", null)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(20);
    setPendingSOS(sos || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Real-time subscription for new SOS pings
  useEffect(() => {
    const channel = supabase
      .channel("sos_pings")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "dispatches",
        filter: "ambulance_id=is.null",
      }, () => { load(); })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [user]);

  const toggleGPS = () => {
    if (locationShare) {
      if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current);
      setLocationShare(false);
    } else {
      if (!ambulance) return;
      watchRef.current = navigator.geolocation.watchPosition(
        async (pos) => {
          await supabase.from("ambulances").update({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            last_location_update: new Date().toISOString(),
          }).eq("id", ambulance.id);
        },
        null, { enableHighAccuracy: true, maximumAge: 5000 }
      );
      setLocationShare(true);
    }
  };

  const acceptSOS = async (dispatch) => {
    if (!ambulance) return;
    setAccepting(dispatch.id);
    const { error } = await supabase.from("dispatches").update({
      ambulance_id: ambulance.id,
      status: "accepted",
    }).eq("id", dispatch.id).is("ambulance_id", null); // safe race guard
    if (!error) {
      await supabase.from("ambulances").update({ status: "dispatched" }).eq("id", ambulance.id);
    }
    setAccepting(null);
    load();
  };

  useEffect(() => () => { if (watchRef.current) navigator.geolocation.clearWatch(watchRef.current); }, []);

  if (loading) return <LoadingSpinner />;

  const activeDispatch = dispatches.find(d => ["accepted", "en_route", "arrived"].includes(d.status));
  const completedToday = dispatches.filter(d =>
    d.status === "completed" && d.completed_at && new Date(d.completed_at).toDateString() === new Date().toDateString()
  ).length;

  const sc = {
    available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669", dot: "#10b981" },
    dispatched: { bg: "#fff7ed", border: "#fed7aa", text: "#c2410c", dot: "#f97316" },
    maintenance: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" },
    offline: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", dot: "#94a3b8" },
  }[ambulance?.status] || { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b", dot: "#94a3b8" };

  /* ════════ HOME ════════ */
  if (section === "home" || !section) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Vehicle Banner */}
      <div style={{ borderRadius: 16, padding: 24, border: "1px solid #fed7aa", background: "linear-gradient(135deg, #fff7ed 0%, #ffffff 60%)" }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#f97316", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Driver Dashboard</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{ambulance ? ambulance.vehicle_number : "No Vehicle Assigned"}</h1>
        {ambulance && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span style={{ padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 800, background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: sc.dot }} />
              {ambulance.status?.toUpperCase()}
            </span>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>{ambulance.ambulance_type}</span>
          </div>
        )}
      </div>

      {!ambulance ? (
        <AlertBox type="error">No ambulance assigned to your account. Contact your admin.</AlertBox>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            <StatCard icon="✅" label="Completed Today" value={completedToday} color="emerald" />
            <StatCard icon="📡" label="Active Job" value={activeDispatch ? "ACTIVE" : "FREE"} color={activeDispatch ? "amber" : "cyan"} />
            <StatCard icon="🆘" label="Pending SOS" value={pendingSOS.length} color={pendingSOS.length > 0 ? "red" : "emerald"} />
          </div>

          {/* ── PENDING SOS REQUESTS ── */}
          {pendingSOS.length > 0 && (
            <div>
              <SectionTitle>🆘 Pending Emergency Requests</SectionTitle>
              {pendingSOS.map(d => (
                <Card key={d.id} style={{ borderColor: "#fecaca", background: "#fef2f2", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 20 }}>🆘</span>
                        <p style={{ fontSize: 14, fontWeight: 900, color: "#dc2626", margin: 0 }}>EMERGENCY SOS</p>
                      </div>
                      <p style={{ fontSize: 12, color: "#475569", margin: "4px 0 0" }}>📍 {d.pickup_address || "GPS Location"}</p>
                      {d.pickup_lat && d.pickup_lng && (
                        <a
                          href={`https://maps.google.com/?q=${d.pickup_lat},${d.pickup_lng}`}
                          target="_blank" rel="noreferrer"
                          style={{ fontSize: 11, color: "#3b82f6", textDecoration: "underline", display: "block", marginTop: 4 }}
                        >
                          📍 View on Maps ({parseFloat(d.pickup_lat).toFixed(4)}, {parseFloat(d.pickup_lng).toFixed(4)})
                        </a>
                      )}
                      {d.notes && <p style={{ fontSize: 11, color: "#b91c1c", margin: "4px 0 0", fontWeight: 700 }}>{d.notes}</p>}
                      <p style={{ fontSize: 10, color: "#94a3b8", margin: "4px 0 0" }}>
                        {new Date(d.requested_at).toLocaleTimeString("en-IN")}
                      </p>
                    </div>
                    <button
                      onClick={() => acceptSOS(d)}
                      disabled={!!accepting || ambulance.status !== "available"}
                      style={{
                        padding: "10px 20px", borderRadius: 12, border: "none",
                        background: accepting === d.id ? "#94a3b8" : ambulance.status !== "available" ? "#f1f5f9" : "linear-gradient(135deg, #dc2626, #ef4444)",
                        color: ambulance.status !== "available" ? "#94a3b8" : "#fff",
                        fontWeight: 900, fontSize: 12, cursor: ambulance.status === "available" ? "pointer" : "not-allowed",
                        boxShadow: ambulance.status === "available" ? "0 4px 12px rgba(220,38,38,0.3)" : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {accepting === d.id ? "Claiming..." : ambulance.status !== "available" ? "Unavailable" : "Accept 🚑"}
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* GPS Card */}
          <Card style={locationShare ? { borderColor: "#a7f3d0", background: "#ecfdf5" } : {}}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, background: locationShare ? "#d1fae5" : "#f1f5f9", border: `1px solid ${locationShare ? "#a7f3d0" : "#e2e8f0"}` }}>📍</div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", margin: 0 }}>GPS Location Sharing</p>
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>
                    {locationShare ? "Broadcasting real-time location" : "Enable so patients & admin can track you"}
                  </p>
                  {locationShare && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ fontSize: 11, color: "#059669", fontWeight: 700 }}>LIVE · updating</span>
                  </div>}
                </div>
              </div>
              <button onClick={toggleGPS} style={{
                padding: "10px 20px", borderRadius: 12, border: "none", fontSize: 12, fontWeight: 800, cursor: "pointer",
                background: locationShare ? "#fef2f2" : "#10b981", color: locationShare ? "#dc2626" : "#fff",
                boxShadow: locationShare ? "none" : "0 2px 8px rgba(16,185,129,0.3)",
              }}>
                {locationShare ? "Stop Sharing" : "Start Sharing"}
              </button>
            </div>
          </Card>

          {/* Active dispatch */}
          {activeDispatch ? (
            <Card style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 24 }}>📡</span>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 900, color: "#0f172a", margin: 0 }}>Active Dispatch</p>
                  <StatusBadge status={activeDispatch.status} />
                </div>
              </div>
              <InfoRow label="Pickup" value={activeDispatch.pickup_address || "GPS Location"} icon="📍" />
              {activeDispatch.hospitals && <InfoRow label="Hospital" value={activeDispatch.hospitals.name} icon="🏥" />}
              {activeDispatch.pickup_lat && (
                <a href={`https://maps.google.com/?q=${activeDispatch.pickup_lat},${activeDispatch.pickup_lng}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 12, color: "#3b82f6", textDecoration: "underline", display: "block", marginTop: 8 }}>
                  📍 Navigate to patient
                </a>
              )}
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <span style={{ fontSize: 40, display: "block", marginBottom: 12 }}>🚦</span>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0 }}>You're on standby</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>SOS requests from patients will appear above</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );

  /* ════════ MY AMBULANCE ════════ */
  if (section === "ambulance") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🚑 My Ambulance" subtitle="Vehicle details" />
      {!ambulance ? (
        <AlertBox type="error">No ambulance linked to your account.</AlertBox>
      ) : (
        <>
          <Card>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <InfoRow label="Vehicle No" value={ambulance.vehicle_number} icon="🚗" />
              <InfoRow label="Type" value={ambulance.ambulance_type} icon="🚑" />
              <InfoRow label="Fuel" value={ambulance.fuel_type} icon="⛽" />
              <InfoRow label="Year" value={ambulance.year_of_manufacture} icon="📅" />
              <InfoRow label="License" value={ambulance.license_number} icon="📋" />
              <InfoRow label="Status" value={ambulance.status} icon="✅" />
            </div>
          </Card>
          {/* Status picker */}
          <Card>
            <p style={{ fontSize: 11, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Update My Status</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {["available", "maintenance", "offline"].map(s => {
                const st = { available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" }, maintenance: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" }, offline: { bg: "#f8fafc", border: "#e2e8f0", text: "#64748b" } }[s];
                const isActive = ambulance.status === s;
                return (
                  <button key={s} onClick={async () => {
                    await supabase.from("ambulances").update({ status: s }).eq("id", ambulance.id);
                    setAmbulance({ ...ambulance, status: s });
                  }} style={{
                    padding: "10px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                    textTransform: "capitalize", cursor: "pointer",
                    border: `1px solid ${isActive ? st.border : "#e2e8f0"}`,
                    background: isActive ? st.bg : "#fff",
                    color: isActive ? st.text : "#94a3b8",
                  }}>{s}</button>
                );
              })}
            </div>
          </Card>
        </>
      )}
    </div>
  );

  /* ════════ DISPATCH HISTORY ════════ */
  if (section === "dispatches") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📡 Dispatch History" subtitle="Your past assignments" />
      {dispatches.length === 0
        ? <EmptyState icon="📡" message="No dispatches yet" />
        : dispatches.map(d => (
          <Card key={d.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <StatusBadge status={d.status} />
                <p style={{ fontSize: 13, color: "#475569", margin: "6px 0 0" }}>{d.pickup_address || "GPS Location"}</p>
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

  return <EmptyState icon="🚑" message="Select a section from the sidebar" />;
}