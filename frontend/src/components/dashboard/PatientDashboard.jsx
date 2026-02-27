// src/components/dashboard/PatientDashboard.jsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useDashboard } from "../../hooks/useDashboard";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, DashboardHeader, InfoRow,
} from "../shared/UIComponents";
import api from "../../lib/api";

export default function PatientDashboard({ section }) {
  const { user } = useAuth();
  const { data, loading, error, refetch } = useDashboard("patient");
  const [dispatchLoading, setDispatchLoading] = useState(false);
  const [dispatchSuccess, setDispatchSuccess] = useState("");

  const requestAmbulance = async (hospitalId) => {
    if (!navigator.geolocation) return alert("Geolocation not supported");
    setDispatchLoading(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await api.post("/ambulances/dispatch", {
          pickup_latitude: pos.coords.latitude,
          pickup_longitude: pos.coords.longitude,
          pickup_address: "Current Location",
          hospital_id: hospitalId,
          priority: "emergency",
        });
        setDispatchSuccess(`🚑 Ambulance dispatched! ETA: ${res.data.dispatch.estimated_eta} min`);
        refetch();
      } catch (err) {
        alert(err.response?.data?.message || "Failed to dispatch ambulance");
      } finally {
        setDispatchLoading(false);
      }
    }, () => { setDispatchLoading(false); alert("Location permission denied"); });
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-8 text-red-400 font-semibold">⚠️ Error: {error}</div>;
  if (!data) return null;

  const { profile, active_booking, recent_bookings, recent_dispatches, nearby_hospitals, available_ambulances } = data;
  const firstName = user?.full_name?.split(" ")[0] || "there";

  /* ── HOME ── */
  if (section === "home" || !section) return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeader
        title={`Welcome back, ${firstName} 👋`}
        subtitle={`Your health dashboard — ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
        badge={profile?.blood_group ? `🩸 ${profile.blood_group}` : undefined}
        badgeColor="red"
      />

      {/* Profile incomplete warning */}
      {!data.profile_complete && (
        <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm font-semibold flex items-center gap-2">
          ⚠️ Your health profile is incomplete — please complete it for emergency support.
        </div>
      )}

      {dispatchSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium flex items-center gap-3">
          <span className="text-2xl">✅</span> {dispatchSuccess}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🚑" label="Available Ambulances" value={available_ambulances} color="emerald" />
        <StatCard icon="🏥" label="Nearby Hospitals" value={nearby_hospitals.length} color="blue" />
        <StatCard icon="🛏️" label="Booking Status"
          value={active_booking ? active_booking.status.toUpperCase() : "NONE"}
          sub={active_booking ? active_booking.hospitals?.name : "No active booking"}
          color={active_booking ? "violet" : "cyan"} />
        <StatCard icon="🩸" label="Blood Group"
          value={profile?.blood_group || "—"}
          sub={profile?.blood_group ? "On file" : "Not set"}
          color="red" />
      </div>

      {/* Active Booking Banner */}
      {active_booking && (
        <Card className="!border-violet-500/30 !bg-violet-500/5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-2xl flex-shrink-0">
              🛏️
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-white font-bold text-lg">{active_booking.hospitals?.name}</p>
                <StatusBadge status={active_booking.status} />
              </div>
              <p className="text-white/60 text-sm">
                Bed {active_booking.beds?.bed_number} ({active_booking.beds?.bed_type})
                {active_booking.beds?.ward ? ` — ${active_booking.beds.ward}` : ""}
              </p>
              {active_booking.attending_doctor && (
                <p className="text-white/50 text-sm">👨‍⚕️ Dr. {active_booking.attending_doctor}</p>
              )}
              {active_booking.admitted_at && (
                <p className="text-white/30 text-xs mt-1">
                  Admitted: {new Date(active_booking.admitted_at).toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <p className="text-violet-400 text-xs font-semibold">Active</p>
            </div>
          </div>
        </Card>
      )}

      {/* Nearby Hospitals */}
      <div>
        <SectionTitle>🏥 Hospitals Near You</SectionTitle>
        <div className="grid gap-4">
          {nearby_hospitals.length === 0
            ? <EmptyState icon="🏥" message="No nearby hospitals found" />
            : nearby_hospitals.map((h) => {
              const bedPct = h.total_beds ? Math.round(((h.total_beds - h.available_beds) / h.total_beds) * 100) : 0;
              const avail = h.available_beds;
              const availColor = avail > 5 ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                : avail > 0 ? "text-amber-400 bg-amber-500/10 border-amber-500/30"
                  : "text-red-400 bg-red-500/10 border-red-500/30";
              const leftBar = avail > 5 ? "#34d399" : avail > 0 ? "#fbbf24" : "#f87171";
              return (
                <Card key={h.id} className="hover:border-white/20 transition-colors !p-0 overflow-hidden">
                  <div className="flex">
                    {/* Left accent bar */}
                    <div className="w-1 flex-shrink-0 rounded-l-2xl" style={{ background: leftBar }} />
                    <div className="flex-1 p-5 flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-bold text-base mb-0.5">{h.name}</p>
                        <p className="text-white/40 text-xs mb-3">📍 {h.address}, {h.city}</p>
                        <div className="space-y-2 max-w-sm">
                          <BedBar label="General Beds" available={h.available_beds} total={h.total_beds} />
                          <BedBar label="ICU" available={h.available_icu} total={h.total_icu || 0} />
                          <BedBar label="NICU" available={h.available_nicu} total={h.total_nicu || 0} />
                        </div>
                        {h.opd_queue_count > 0 && (
                          <p className="text-amber-400 text-xs mt-2 font-medium">⏳ OPD Queue: {h.opd_queue_count} patients</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                        <button
                          onClick={() => requestAmbulance(h.id)}
                          disabled={dispatchLoading}
                          className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-black hover:bg-red-500/30 transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-red-500/20"
                        >
                          🚨 SOS
                        </button>
                        <span className={`px-3 py-1 rounded-lg text-center text-xs font-black border ${availColor}`}>
                          {avail} beds
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>
    </div>
  );

  /* ── BOOKINGS ── */
  if (section === "bookings") return (
    <div className="space-y-6">
      <DashboardHeader title="📋 My Bookings" subtitle="Your hospital admission history" />
      {recent_bookings.length === 0
        ? <EmptyState icon="🛏️" message="No bookings yet" />
        : (
          <div className="space-y-0">
            {recent_bookings.map((b, i) => (
              <div key={b.id} className="flex gap-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1 ${b.status === "admitted" ? "border-violet-400 bg-violet-500/30"
                      : b.status === "confirmed" ? "border-blue-400 bg-blue-500/30"
                        : b.status === "pending" ? "border-amber-400 bg-amber-500/30"
                          : "border-slate-500 bg-slate-600/30"
                    }`} />
                  {i < recent_bookings.length - 1 && <div className="w-px flex-1 bg-white/5 my-1" />}
                </div>
                <div className="flex-1 pb-4 min-w-0">
                  <Card className="hover:border-white/20 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <p className="text-white font-bold">{b.hospitals?.name}</p>
                          <StatusBadge status={b.status} />
                          {b.booking_type === "emergency" && <StatusBadge status="emergency" />}
                        </div>
                        <p className="text-white/50 text-sm">
                          {b.beds?.bed_type?.toUpperCase()} — Bed {b.beds?.bed_number}
                          {b.beds?.ward ? `, ${b.beds.ward}` : ""}
                        </p>
                        {b.reason_for_admission && (
                          <p className="text-white/30 text-xs mt-1">Reason: {b.reason_for_admission}</p>
                        )}
                      </div>
                      <p className="text-white/20 text-xs flex-shrink-0 text-right">
                        {new Date(b.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        <br />
                        {new Date(b.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </Card>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );

  /* ── AMBULANCE ── */
  if (section === "ambulance") return (
    <div className="space-y-6">
      <DashboardHeader title="🚑 Ambulance Tracker" subtitle="Request & track emergency ambulances" />

      {/* SOS Card */}
      <Card className="!border-red-500/20 !bg-red-500/5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-2xl animate-pulse">
            🆘
          </div>
          <div>
            <p className="text-white font-bold text-lg">Emergency? Act Now.</p>
            <p className="text-white/40 text-xs">We'll dispatch the nearest ambulance to your location</p>
          </div>
        </div>
        <button
          onClick={() => nearby_hospitals[0] && requestAmbulance(nearby_hospitals[0].id)}
          disabled={dispatchLoading || available_ambulances === 0}
          className="w-full py-4 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-base transition-all disabled:opacity-50 shadow-lg shadow-red-500/30 hover:shadow-red-500/50"
          style={{ letterSpacing: "0.5px" }}
        >
          {dispatchLoading ? "Requesting..." : available_ambulances === 0 ? "No Ambulances Available" : "🚨 Request Emergency Ambulance"}
        </button>
        {dispatchSuccess && (
          <p className="text-emerald-400 text-sm mt-3 font-medium flex items-center gap-2">
            <span className="animate-bounce">✅</span> {dispatchSuccess}
          </p>
        )}
      </Card>

      {/* Active dispatches */}
      {recent_dispatches.length > 0 ? (
        <div className="space-y-3">
          {recent_dispatches.map((d) => (
            <Card key={d.id} className={d.status === "en_route" ? "!border-blue-500/30 !bg-blue-500/5" : ""}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${d.status === "en_route" ? "bg-blue-500/20 border border-blue-500/30" : "bg-white/5 border border-white/10"}`}>
                  🚑
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-white font-bold">{d.ambulances?.vehicle_number}</p>
                    <StatusBadge status={d.status} />
                    {d.priority === "emergency" && <StatusBadge status="emergency" />}
                  </div>
                  <InfoRow label="Driver" value={d.ambulances?.driver_name} icon="👨‍⚕️" />
                  <InfoRow label="Type" value={d.ambulances?.ambulance_type} icon="🚑" />
                  {d.estimated_eta && d.status !== "completed" && (
                    <div className="mt-2 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-emerald-400 text-sm font-black">ETA: {d.estimated_eta} min</p>
                    </div>
                  )}
                  {d.actual_arrival && (
                    <p className="text-white/30 text-xs mt-1">
                      Arrived: {new Date(d.actual_arrival).toLocaleString("en-IN")}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon="🚑" message="No recent ambulance dispatches" />
      )}
    </div>
  );

  /* ── HEALTH PROFILE ── */
  if (section === "health" && profile) return (
    <div className="space-y-6">
      <DashboardHeader title="🩺 My Health Profile" subtitle="Your medical information on file" />
      <div className="grid grid-cols-2 gap-4">
        {[
          ["Blood Group", profile.blood_group || "Not set", "🩸", "red"],
          ["Gender", profile.gender || "Not set", "👤", "blue"],
          ["Date of Birth", profile.date_of_birth || "Not set", "📅", "violet"],
          ["City", profile.city || "Not set", "📍", "cyan"],
        ].map(([k, v, ico, color]) => (
          <Card key={k} className="text-center hover:border-white/20">
            <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center text-2xl ${color === "red" ? "bg-red-500/15 border border-red-500/20"
                : color === "blue" ? "bg-blue-500/15 border border-blue-500/20"
                  : color === "violet" ? "bg-violet-500/15 border border-violet-500/20"
                    : "bg-cyan-500/15 border border-cyan-500/20"
              }`}>
              {ico}
            </div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-1">{k}</p>
            <p className="text-white font-bold text-base">{v}</p>
          </Card>
        ))}
      </div>

      {profile.allergies?.length > 0 && (
        <Card className="!border-orange-500/20">
          <p className="text-orange-400 text-xs font-bold uppercase tracking-wider mb-3">⚠️ Known Allergies</p>
          <div className="flex flex-wrap gap-2">
            {profile.allergies.map((a) => (
              <span key={a} className="px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold">{a}</span>
            ))}
          </div>
        </Card>
      )}

      {profile.chronic_diseases?.length > 0 && (
        <Card className="!border-violet-500/20">
          <p className="text-violet-400 text-xs font-bold uppercase tracking-wider mb-3">🏥 Chronic Conditions</p>
          <div className="flex flex-wrap gap-2">
            {profile.chronic_diseases.map((d) => (
              <span key={d} className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold">{d}</span>
            ))}
          </div>
        </Card>
      )}

      {profile.emergency_contact_name && (
        <Card className="!border-red-500/20 !bg-red-500/3">
          <p className="text-red-400 text-xs font-bold uppercase tracking-wider mb-3">🆘 Emergency Contact</p>
          <InfoRow label="Name" value={profile.emergency_contact_name} icon="👤" />
          <InfoRow label="Phone" value={profile.emergency_contact_phone} icon="📞" />
        </Card>
      )}
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}