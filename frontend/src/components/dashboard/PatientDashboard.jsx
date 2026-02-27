// src/components/dashboard/PatientDashboard.jsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useDashboard } from "../../hooks/useDashboard";
import { StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner, Card, BedBar } from "../shared/UIComponents";
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
          pickup_latitude:  pos.coords.latitude,
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
  if (error)   return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data)   return null;

  const { profile, active_booking, recent_bookings, recent_dispatches, nearby_hospitals, available_ambulances } = data;

  // HOME section
  if (section === "home" || !section) return (
    <div className="space-y-6">
      {/* Welcome + alert banner */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">
            Welcome back, {user?.full_name?.split(" ")[0]} 👋
          </h1>
          <p className="text-white/40 text-sm mt-1">Your health dashboard — {new Date().toLocaleDateString("en-IN", { weekday:"long", day:"numeric", month:"long" })}</p>
        </div>
        {!data.profile_complete && (
          <div className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold">
            ⚠️ Profile incomplete
          </div>
        )}
      </div>

      {dispatchSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
          {dispatchSuccess}
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
        <Card className="border-violet-500/30 bg-violet-500/5">
          <div className="flex items-start gap-4">
            <span className="text-3xl">🛏️</span>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-white font-bold">{active_booking.hospitals?.name}</p>
                <StatusBadge status={active_booking.status} />
              </div>
              <p className="text-white/50 text-sm">
                Bed: {active_booking.beds?.bed_number} ({active_booking.beds?.bed_type}) — {active_booking.beds?.ward}
              </p>
              {active_booking.attending_doctor && (
                <p className="text-white/50 text-sm">Doctor: {active_booking.attending_doctor}</p>
              )}
              {active_booking.admitted_at && (
                <p className="text-white/30 text-xs mt-1">Admitted: {new Date(active_booking.admitted_at).toLocaleString("en-IN")}</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Hospitals Grid */}
      <div>
        <SectionTitle>🏥 Hospitals Near You</SectionTitle>
        <div className="grid gap-4">
          {nearby_hospitals.map((h) => (
            <Card key={h.id} className="hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-white font-bold mb-0.5">{h.name}</p>
                  <p className="text-white/40 text-xs mb-3">{h.address}, {h.city}</p>
                  <div className="space-y-2">
                    <BedBar label="General Beds" available={h.available_beds} total={h.total_beds} />
                    <BedBar label="ICU"           available={h.available_icu}  total={h.total_icu || 0} />
                    <BedBar label="NICU"          available={h.available_nicu} total={h.total_nicu || 0} />
                  </div>
                  {h.opd_queue_count > 0 && (
                    <p className="text-amber-400 text-xs mt-2">⏳ OPD Queue: {h.opd_queue_count} patients</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button
                    onClick={() => requestAmbulance(h.id)}
                    disabled={dispatchLoading}
                    className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-all disabled:opacity-50">
                    🚑 SOS
                  </button>
                  <div className={`px-3 py-1 rounded-lg text-center text-xs font-bold ${h.available_beds > 5 ? "text-emerald-400 bg-emerald-500/10" : h.available_beds > 0 ? "text-amber-400 bg-amber-500/10" : "text-red-400 bg-red-500/10"}`}>
                    {h.available_beds} beds
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );

  // BOOKINGS section
  if (section === "bookings") return (
    <div className="space-y-6">
      <SectionTitle>📋 My Bookings</SectionTitle>
      {recent_bookings.length === 0 ? (
        <EmptyState icon="🛏️" message="No bookings yet" />
      ) : (
        <div className="space-y-3">
          {recent_bookings.map((b) => (
            <Card key={b.id} className="hover:border-white/20 transition-colors">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
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
                  <p className="text-white/20 text-xs mt-1">{new Date(b.created_at).toLocaleString("en-IN")}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // AMBULANCE section
  if (section === "ambulance") return (
    <div className="space-y-6">
      <SectionTitle>🚑 Ambulance Tracker</SectionTitle>

      {recent_dispatches.length > 0 ? (
        <div className="space-y-3">
          {recent_dispatches.map((d) => (
            <Card key={d.id} className={d.status === "en_route" ? "border-blue-500/30 bg-blue-500/5" : ""}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">🚑</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-bold">{d.ambulances?.vehicle_number}</p>
                    <StatusBadge status={d.status} />
                    {d.priority === "emergency" && <StatusBadge status="emergency" />}
                  </div>
                  <p className="text-white/50 text-sm">Driver: {d.ambulances?.driver_name} — {d.ambulances?.driver_phone}</p>
                  <p className="text-white/50 text-sm">Type: {d.ambulances?.ambulance_type}</p>
                  {d.estimated_eta && d.status !== "completed" && (
                    <p className="text-emerald-400 text-sm font-bold mt-1">ETA: {d.estimated_eta} min</p>
                  )}
                  {d.actual_arrival && (
                    <p className="text-white/30 text-xs mt-1">Arrived: {new Date(d.actual_arrival).toLocaleString("en-IN")}</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon="🚑" message="No recent ambulance dispatches" />
      )}

      {/* Emergency Request Button */}
      <Card className="border-red-500/20 bg-red-500/5">
        <p className="text-white font-bold mb-2">Emergency? Request ambulance now</p>
        <p className="text-white/40 text-xs mb-4">We'll send the nearest available ambulance to your current location</p>
        <button
          onClick={() => nearby_hospitals[0] && requestAmbulance(nearby_hospitals[0].id)}
          disabled={dispatchLoading || available_ambulances === 0}
          className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white font-black text-sm transition-all disabled:opacity-50 shadow-lg shadow-red-500/20">
          {dispatchLoading ? "Requesting..." : available_ambulances === 0 ? "No ambulances available" : "🆘 Request Emergency Ambulance"}
        </button>
        {dispatchSuccess && <p className="text-emerald-400 text-sm mt-3">{dispatchSuccess}</p>}
      </Card>
    </div>
  );

  // Health profile section
  if (section === "health" && profile) return (
    <div className="space-y-6">
      <SectionTitle>🩺 My Health Profile</SectionTitle>
      <div className="grid grid-cols-2 gap-4">
        {[
          ["Blood Group",  profile.blood_group || "Not set",      "🩸"],
          ["Gender",       profile.gender || "Not set",           "👤"],
          ["Date of Birth",profile.date_of_birth || "Not set",    "📅"],
          ["City",         profile.city || "Not set",             "📍"],
        ].map(([k, v, ico]) => (
          <Card key={k} className="text-center">
            <span className="text-3xl">{ico}</span>
            <p className="text-white/40 text-xs mt-1">{k}</p>
            <p className="text-white font-bold mt-0.5">{v}</p>
          </Card>
        ))}
      </div>

      {profile.allergies?.length > 0 && (
        <Card>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">⚠️ Allergies</p>
          <div className="flex flex-wrap gap-2">
            {profile.allergies.map((a) => (
              <span key={a} className="px-3 py-1 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-medium">{a}</span>
            ))}
          </div>
        </Card>
      )}

      {profile.chronic_diseases?.length > 0 && (
        <Card>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">🏥 Chronic Conditions</p>
          <div className="flex flex-wrap gap-2">
            {profile.chronic_diseases.map((d) => (
              <span key={d} className="px-3 py-1 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-medium">{d}</span>
            ))}
          </div>
        </Card>
      )}

      {profile.emergency_contact_name && (
        <Card className="border-red-500/20">
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">🆘 Emergency Contact</p>
          <p className="text-white font-bold">{profile.emergency_contact_name}</p>
          <p className="text-white/50 text-sm">{profile.emergency_contact_phone}</p>
        </Card>
      )}
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}