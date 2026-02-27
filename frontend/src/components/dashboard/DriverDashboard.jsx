// src/components/dashboard/DriverDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../hooks/useDashboard";
import {
  StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, StatCard, DashboardHeader, InfoRow,
} from "../shared/UIComponents";
import api from "../../lib/api";
import { io } from "socket.io-client";
import { supabase } from "../../supabaseClient";

export default function DriverDashboard({ section }) {
  const { data, loading, error, refetch } = useDashboard("driver");
  const [updating, setUpdating] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  const startLocationSharing = async () => {
    if (!data?.ambulance) return;

    // Get Supabase JWT for socket auth
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("driver:register", data.ambulance.id);
    });

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit("driver:location", {
          ambulance_id: data.ambulance.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        api.put(`/ambulances/${data.ambulance.id}/location`, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => { });
      },
      null,
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
    setLocationSharing(true);
  };

  const stopLocationSharing = () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (socketRef.current) socketRef.current.disconnect();
    setLocationSharing(false);
  };

  useEffect(() => () => stopLocationSharing(), []);


  const updateDispatchStatus = async (id, status) => {
    setUpdating(true);
    try {
      await api.put(`/ambulances/dispatches/${id}/status`, { status });
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setUpdating(false);
    }
  };

  const updateAmbulanceStatus = async (status) => {
    if (!data?.ambulance) return;
    try {
      await api.put(`/ambulances/${data.ambulance.id}/status`, { status });
      refetch();
    } catch {
      alert("Failed to update status");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-8 text-red-400 font-semibold">⚠️ Error: {error}</div>;
  if (!data) return null;

  const { ambulance, current_dispatch, completed_today, dispatch_history } = data;

  const DISPATCH_FLOW = ["accepted", "en_route", "arrived", "completed"];
  const nextStatus = current_dispatch
    ? DISPATCH_FLOW[DISPATCH_FLOW.indexOf(current_dispatch.status) + 1]
    : null;
  const nextLabel = {
    accepted: "🚗 Start Driving",
    en_route: "📍 Mark Arrived",
    arrived: "✅ Complete Job",
    completed: null,
  }[current_dispatch?.status];

  const statusColors = {
    available: { text: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/25", dot: "bg-emerald-400" },
    dispatched: { text: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/25", dot: "bg-orange-400" },
    maintenance: { text: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/25", dot: "bg-amber-400" },
    offline: { text: "text-slate-400", bg: "bg-slate-600/15 border-slate-500/25", dot: "bg-slate-400" },
  };
  const sc = statusColors[ambulance?.status] || statusColors.offline;

  /* ── HOME ── */
  if (section === "home" || !section) return (
    <div className="space-y-6">
      {/* Vehicle Banner */}
      <div
        className="rounded-2xl p-5 border relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, rgba(251,146,60,0.12) 0%, rgba(8,12,18,0.9) 60%)", borderColor: "rgba(251,146,60,0.25)" }}
      >
        <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #fb923c 0%, transparent 70%)" }} />
        <div className="flex items-start justify-between gap-4 relative z-10">
          <div>
            <p className="text-orange-400 text-xs font-bold uppercase tracking-widest mb-1">Driver Dashboard</p>
            <h1 className="text-2xl font-black text-white">
              {ambulance ? ambulance.vehicle_number : "No Vehicle Assigned"}
            </h1>
            {ambulance && (
              <p className="text-white/40 text-sm mt-1">
                {ambulance.ambulance_type} · {user?.full_name}
              </p>
            )}
          </div>
          {ambulance && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${sc.bg}`}>
              <div className={`w-2 h-2 rounded-full ${sc.dot} ${ambulance.status === "available" ? "animate-pulse" : ""}`} />
              <span className={`text-xs font-bold uppercase ${sc.text}`}>{ambulance.status}</span>
            </div>
          )}
        </div>
      </div>

      {!ambulance ? (
        <Card className="!border-red-500/25 !bg-red-500/5">
          <div className="flex items-center gap-4">
            <span className="text-3xl">⚠️</span>
            <div>
              <p className="text-red-400 font-bold">No ambulance assigned to your account</p>
              <p className="text-white/40 text-sm mt-0.5">Contact your admin to link an ambulance to your profile.</p>
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon="✅" label="Completed Today" value={completed_today} color="emerald" />
            <StatCard icon="📡" label="Active Job" value={current_dispatch ? "ACTIVE" : "FREE"} color={current_dispatch ? "amber" : "cyan"} />
            <StatCard icon="🚑" label="Fleet Status" value={ambulance.status?.toUpperCase()} color={ambulance.status === "available" ? "emerald" : "amber"} />
          </div>

          {/* GPS Location Sharing */}
          <Card className={locationSharing ? "!border-emerald-500/30 !bg-emerald-500/5" : ""}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${locationSharing ? "bg-emerald-500/20 border border-emerald-500/30" : "bg-white/5 border border-white/10"}`}>
                  📍
                </div>
                <div>
                  <p className="text-white font-bold text-sm">GPS Location Sharing</p>
                  <p className="text-white/40 text-xs mt-0.5">
                    {locationSharing ? "Broadcasting your location in real-time" : "Share location so dispatch can track you"}
                  </p>
                  {locationSharing && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-emerald-400 text-xs font-semibold">LIVE · updating every 5s</p>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={locationSharing ? stopLocationSharing : startLocationSharing}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${locationSharing
                  ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                  : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/25"
                  }`}
              >
                {locationSharing ? "Stop Sharing" : "Start Sharing"}
              </button>
            </div>
          </Card>

          {/* Status Control */}
          <Card>
            <p className="text-white/50 text-xs font-bold uppercase tracking-widest mb-3">My Ambulance Status</p>
            <div className="grid grid-cols-3 gap-2">
              {["available", "maintenance", "offline"].map((s) => {
                const sc2 = statusColors[s] || statusColors.offline;
                const isActive = ambulance.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => updateAmbulanceStatus(s)}
                    className={`py-2.5 rounded-xl border text-xs font-bold capitalize transition-all flex items-center justify-center gap-1.5 ${isActive
                      ? `${sc2.bg} ${sc2.text}`
                      : "border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white/70"
                      }`}
                  >
                    {isActive && <div className={`w-1.5 h-1.5 rounded-full ${sc2.dot}`} />}
                    {s}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Active Dispatch */}
          {current_dispatch ? (
            <div
              className={`rounded-2xl p-5 border relative overflow-hidden ${current_dispatch.priority === "emergency"
                ? "border-red-500/40 bg-red-500/5"
                : "border-amber-500/30 bg-amber-500/5"
                }`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${current_dispatch.priority === "emergency" ? "bg-red-500/20 border border-red-500/30 animate-pulse" : "bg-amber-500/15 border border-amber-500/25"}`}>
                  📡
                </div>
                <div>
                  <p className="text-white font-black text-lg">Active Dispatch</p>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={current_dispatch.status} />
                    {current_dispatch.priority === "emergency" && (
                      <span className="text-red-300 text-xs font-black animate-pulse">🆘 EMERGENCY</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Patient Info */}
              {current_dispatch.patient_profiles && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-3">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-3">Patient Info</p>
                  <InfoRow label="Name" value={current_dispatch.patient_profiles.users?.full_name} icon="👤" />
                  <InfoRow label="Phone" value={current_dispatch.patient_profiles.users?.phone} icon="📞" />
                  {current_dispatch.patient_profiles.blood_group && (
                    <InfoRow label="Blood" value={current_dispatch.patient_profiles.blood_group} icon="🩸" />
                  )}
                  {current_dispatch.patient_profiles.allergies?.length > 0 && (
                    <p className="text-orange-400 text-xs mt-2 font-medium">
                      ⚠️ Allergies: {current_dispatch.patient_profiles.allergies.join(", ")}
                    </p>
                  )}
                </div>
              )}

              {/* Pickup */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-3">
                <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">📍 Pickup Location</p>
                <p className="text-white font-semibold">{current_dispatch.pickup_address}</p>
                {current_dispatch.estimated_eta && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <p className="text-emerald-400 text-sm font-black">ETA: {current_dispatch.estimated_eta} min</p>
                  </div>
                )}
              </div>

              {/* Destination */}
              {current_dispatch.hospitals && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-4 mb-4">
                  <p className="text-white/40 text-xs font-bold uppercase tracking-wider mb-2">🏥 Destination Hospital</p>
                  <p className="text-white font-semibold">{current_dispatch.hospitals.name}</p>
                  <p className="text-white/50 text-sm">{current_dispatch.hospitals.address}</p>
                </div>
              )}

              {/* Action */}
              {nextStatus && nextLabel && (
                <button
                  onClick={() => updateDispatchStatus(current_dispatch.id, nextStatus)}
                  disabled={updating}
                  className="w-full py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all shadow-lg shadow-emerald-500/30 disabled:opacity-50 hover:shadow-emerald-500/50"
                >
                  {updating ? "Updating..." : nextLabel}
                </button>
              )}
            </div>
          ) : (
            <Card>
              <div className="flex flex-col items-center justify-center py-8 gap-3">
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-3xl">
                  🚦
                </div>
                <p className="text-white font-semibold">You're Free</p>
                <p className="text-white/30 text-sm">No active dispatch — standby for assignments</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );

  /* ── DISPATCHES ── */
  if (section === "dispatches") return (
    <div className="space-y-6">
      <DashboardHeader title="📡 Dispatch History" subtitle="Your completed and past assignments" />
      {dispatch_history.length === 0
        ? <EmptyState icon="📡" message="No dispatches yet" />
        : (
          <div className="space-y-3">
            {dispatch_history.map((d) => (
              <Card key={d.id} className="hover:border-white/20 transition-colors">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${d.status === "completed" ? "bg-emerald-500/15 border border-emerald-500/25" : "bg-white/5 border border-white/10"}`}>
                    🚑
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <StatusBadge status={d.status} />
                      {d.priority === "emergency" && <StatusBadge status="emergency" />}
                    </div>
                    <p className="text-white font-semibold">{d.patient_profiles?.users?.full_name || "Unknown Patient"}</p>
                    <p className="text-white/40 text-sm truncate">{d.pickup_address}</p>
                    <div className="flex items-center gap-4 mt-1">
                      <p className="text-white/20 text-xs">{new Date(d.created_at).toLocaleString("en-IN")}</p>
                      {d.completed_at && (
                        <p className="text-emerald-400/60 text-xs">
                          ✓ {new Date(d.completed_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
    </div>
  );

  return <EmptyState icon="🚑" message="Select a section from the sidebar" />;
}