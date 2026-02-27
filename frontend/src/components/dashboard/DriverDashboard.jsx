// src/components/dashboard/DriverDashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useDashboard } from "../../hooks/useDashboard";
import { StatusBadge, SectionTitle, EmptyState, LoadingSpinner, Card, StatCard } from "../shared/UIComponents";
import api from "../../lib/api";
import { io } from "socket.io-client";
import { useAuth } from "../../hooks/useAuth";

export default function DriverDashboard({ section }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useDashboard("driver");
  const [updating, setUpdating] = useState(false);
  const [locationSharing, setLocationSharing] = useState(false);
  const socketRef = useRef(null);
  const watchIdRef = useRef(null);

  // Connect to socket and start location sharing
  const startLocationSharing = () => {
    if (!data?.ambulance) return;

    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:5000", {
      auth: { token: localStorage.getItem("token") }
    });
    socketRef.current = socket;

    socket.emit("driver:register", data.ambulance.id);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit("driver:location", {
          ambulance_id: data.ambulance.id,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        // Also update via REST for persistence
        api.put(`/ambulances/${data.ambulance.id}/location`, {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }).catch(() => {});
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
    } catch (err) {
      alert("Failed to update status");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error)   return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data)   return null;

  const { ambulance, current_dispatch, completed_today, dispatch_history } = data;

  const DISPATCH_FLOW = ["accepted", "en_route", "arrived", "completed"];
  const nextStatus = current_dispatch
    ? DISPATCH_FLOW[DISPATCH_FLOW.indexOf(current_dispatch.status) + 1]
    : null;

  const nextLabel = {
    accepted:  "Start Driving →",
    en_route:  "Mark Arrived",
    arrived:   "Complete Job ✓",
    completed: null,
  }[current_dispatch?.status];

  if (section === "home" || !section) return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Driver Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">{ambulance?.vehicle_number} — {ambulance?.ambulance_type}</p>
        </div>
        {ambulance && (
          <StatusBadge status={ambulance.status} />
        )}
      </div>

      {!ambulance ? (
        <Card className="border-red-500/20">
          <p className="text-red-400 font-bold">⚠️ No ambulance assigned to your account</p>
          <p className="text-white/40 text-sm mt-1">Contact your admin to link an ambulance to your profile.</p>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon="✅" label="Completed Today" value={completed_today} color="emerald" />
            <StatCard icon="📡" label="Active Job" value={current_dispatch ? "YES" : "NO"} color={current_dispatch ? "amber" : "cyan"} />
            <StatCard icon="🚑" label="Status" value={ambulance.status?.toUpperCase()} color={ambulance.status === "available" ? "emerald" : "amber"} />
          </div>

          {/* Location sharing toggle */}
          <Card className={`border-${locationSharing ? "emerald" : "white"}/20`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold mb-0.5">📍 GPS Location Sharing</p>
                <p className="text-white/40 text-xs">{locationSharing ? "Your location is being shared in real-time" : "Share your location so dispatch can track you"}</p>
              </div>
              <button
                onClick={locationSharing ? stopLocationSharing : startLocationSharing}
                className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  locationSharing
                    ? "bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                    : "bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg shadow-emerald-500/25"
                }`}>
                {locationSharing ? "Stop Sharing" : "Start Sharing"}
              </button>
            </div>
            {locationSharing && (
              <div className="flex items-center gap-2 mt-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <p className="text-emerald-400 text-xs">Live — broadcasting every 5 seconds</p>
              </div>
            )}
          </Card>

          {/* Ambulance status control */}
          <Card>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">My Ambulance Status</p>
            <div className="grid grid-cols-3 gap-2">
              {["available","maintenance","offline"].map((s) => (
                <button key={s} onClick={() => updateAmbulanceStatus(s)}
                  className={`py-2 rounded-xl border text-xs font-bold capitalize transition-all ${
                    ambulance.status === s
                      ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                      : "border-white/10 bg-white/5 text-white/40 hover:border-white/30"
                  }`}>
                  {s}
                </button>
              ))}
            </div>
          </Card>

          {/* Active Dispatch */}
          {current_dispatch ? (
            <Card className={`border-${current_dispatch.priority === "emergency" ? "red" : "amber"}-500/30 bg-${current_dispatch.priority === "emergency" ? "red" : "amber"}-500/5`}>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl">📡</span>
                <p className="text-white font-black text-lg">Active Dispatch</p>
                <StatusBadge status={current_dispatch.status} />
                {current_dispatch.priority === "emergency" && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-black animate-pulse">EMERGENCY</span>
                )}
              </div>

              {/* Patient Info */}
              {current_dispatch.patient_profiles && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Patient</p>
                  <p className="text-white font-bold">{current_dispatch.patient_profiles.users?.full_name}</p>
                  <p className="text-white/50 text-sm">📞 {current_dispatch.patient_profiles.users?.phone}</p>
                  {current_dispatch.patient_profiles.blood_group && (
                    <p className="text-red-400 text-sm font-bold mt-1">🩸 {current_dispatch.patient_profiles.blood_group}</p>
                  )}
                  {current_dispatch.patient_profiles.allergies?.length > 0 && (
                    <p className="text-orange-400 text-xs mt-1">⚠️ Allergies: {current_dispatch.patient_profiles.allergies.join(", ")}</p>
                  )}
                  {current_dispatch.patient_profiles.emergency_contact_name && (
                    <p className="text-white/40 text-xs mt-1">Emergency: {current_dispatch.patient_profiles.emergency_contact_name} — {current_dispatch.patient_profiles.emergency_contact_phone}</p>
                  )}
                </div>
              )}

              {/* Pickup */}
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Pickup Location</p>
                <p className="text-white font-medium">{current_dispatch.pickup_address}</p>
                {current_dispatch.estimated_eta && (
                  <p className="text-emerald-400 text-sm font-bold mt-1">ETA: {current_dispatch.estimated_eta} min</p>
                )}
              </div>

              {/* Destination */}
              {current_dispatch.hospitals && (
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                  <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">Destination Hospital</p>
                  <p className="text-white font-medium">{current_dispatch.hospitals.name}</p>
                  <p className="text-white/50 text-sm">{current_dispatch.hospitals.address}</p>
                </div>
              )}

              {/* Action button */}
              {nextStatus && nextLabel && (
                <button onClick={() => updateDispatchStatus(current_dispatch.id, nextStatus)}
                  disabled={updating}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50">
                  {updating ? "Updating..." : nextLabel}
                </button>
              )}
            </Card>
          ) : (
            <Card>
              <EmptyState icon="🚦" message="No active dispatch — you're free" />
            </Card>
          )}
        </>
      )}
    </div>
  );

  // Dispatch history section
  if (section === "dispatches") return (
    <div className="space-y-6">
      <SectionTitle>📡 Dispatch History</SectionTitle>
      {dispatch_history.length === 0 ? <EmptyState icon="📡" message="No dispatches yet" /> : (
        <div className="space-y-3">
          {dispatch_history.map((d) => (
            <Card key={d.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={d.status} />
                    {d.priority === "emergency" && <StatusBadge status="emergency" />}
                  </div>
                  <p className="text-white font-semibold">{d.patient_profiles?.users?.full_name || "Unknown"}</p>
                  <p className="text-white/40 text-sm truncate max-w-xs">{d.pickup_address}</p>
                  <p className="text-white/20 text-xs mt-1">{new Date(d.created_at).toLocaleString("en-IN")}</p>
                  {d.completed_at && <p className="text-white/20 text-xs">Completed: {new Date(d.completed_at).toLocaleString("en-IN")}</p>}
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