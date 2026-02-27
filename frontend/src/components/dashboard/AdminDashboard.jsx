// src/components/dashboard/AdminDashboard.jsx
import React from "react";
import { useDashboard } from "../../hooks/useDashboard";
import { StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner, Card, BedBar } from "../shared/UIComponents";

export default function AdminDashboard({ section }) {
  const { data, loading, error } = useDashboard("admin");

  if (loading) return <LoadingSpinner />;
  if (error)   return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data)   return null;

  const { system_totals: t, ambulance_summary: a, total_patients,
          pending_bookings, active_dispatches, hospitals,
          recent_bookings, recent_dispatches } = data;

  if (section === "home" || !section) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">System Overview</h1>
        <p className="text-white/40 text-sm mt-1">JeevanSetu — Pune City-Wide Dashboard</p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🛏️" label="Available Beds"   value={t.available_beds}  sub={`of ${t.total_beds} total`} color="emerald" />
        <StatCard icon="❤️‍🔥" label="ICU Available"   value={t.available_icu}   sub={`of ${t.total_icu} ICU total`} color="red" />
        <StatCard icon="🚑" label="Ambulances Free"  value={a.available}       sub={`${a.dispatched} dispatched`} color="amber" />
        <StatCard icon="👥" label="Total Patients"   value={total_patients}    color="violet" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon="⏳" label="Pending Bookings"   value={pending_bookings}  color="amber" />
        <StatCard icon="📡" label="Active Dispatches"  value={active_dispatches} color="blue" />
        <StatCard icon="🏥" label="Active Hospitals"   value={hospitals.length}  color="cyan" />
      </div>

      {/* Two column layout */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Bookings */}
        <Card>
          <SectionTitle>📋 Recent Bookings</SectionTitle>
          {recent_bookings.length === 0 ? <EmptyState icon="📋" message="No bookings" /> : (
            <div className="space-y-3">
              {recent_bookings.map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-semibold">{b.patient_profiles?.users?.full_name || "Unknown"}</p>
                    <p className="text-white/40 text-xs">{b.hospitals?.name} — {b.beds?.bed_type}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={b.status} />
                    {b.booking_type === "emergency" && <StatusBadge status="emergency" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Dispatches */}
        <Card>
          <SectionTitle>🚑 Recent Dispatches</SectionTitle>
          {recent_dispatches.length === 0 ? <EmptyState icon="🚑" message="No dispatches" /> : (
            <div className="space-y-3">
              {recent_dispatches.map((d) => (
                <div key={d.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
                  <div>
                    <p className="text-white text-sm font-semibold">{d.patient_profiles?.users?.full_name || "Anonymous"}</p>
                    <p className="text-white/40 text-xs truncate max-w-[180px]">{d.pickup_address}</p>
                    <p className="text-white/30 text-xs">{d.ambulances?.vehicle_number}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={d.status} />
                    {d.priority === "emergency" && <span className="text-red-400 text-xs font-bold">EMERGENCY</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );

  // HOSPITALS section
  if (section === "hospitals") return (
    <div className="space-y-6">
      <SectionTitle>🏥 All Hospitals</SectionTitle>
      <div className="grid gap-4">
        {hospitals.map((h) => (
          <Card key={h.id} className="hover:border-white/20 transition-colors">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1">
                <p className="text-white font-bold text-lg mb-1">{h.name}</p>
                <p className="text-white/40 text-sm mb-4">{h.city}</p>
                <div className="grid grid-cols-3 gap-4">
                  <BedBar label="General" available={h.available_beds} total={h.total_beds} />
                  <BedBar label="ICU"     available={h.available_icu}  total={h.total_icu || 0} />
                  <BedBar label="NICU"    available={h.available_nicu} total={h.total_nicu || 0} />
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-white/40 text-xs mb-1">OPD Queue</p>
                <p className={`text-2xl font-black ${h.opd_queue_count > 30 ? "text-red-400" : "text-white"}`}>
                  {h.opd_queue_count}
                </p>
                <p className="text-white/30 text-xs">patients</p>
              </div>
            </div>
            <p className="text-white/20 text-xs mt-2">Updated: {new Date(h.updated_at).toLocaleTimeString("en-IN")}</p>
          </Card>
        ))}
      </div>
    </div>
  );

  // AMBULANCES section
  if (section === "ambulances") return (
    <div className="space-y-6">
      <SectionTitle>🚑 Fleet Overview</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="✅" label="Available"   value={a.available}    color="emerald" />
        <StatCard icon="🔴" label="Dispatched"  value={a.dispatched}   color="red" />
        <StatCard icon="🔧" label="Maintenance" value={a.maintenance}  color="amber" />
        <StatCard icon="📊" label="Total Fleet" value={a.total}        color="blue" />
      </div>
      <div className="space-y-3">
        {recent_dispatches.map((d) => (
          <Card key={d.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-white font-bold">{d.ambulances?.vehicle_number}</p>
                <p className="text-white/40 text-sm">{d.pickup_address}</p>
                <p className="text-white/30 text-xs mt-1">{new Date(d.created_at).toLocaleString("en-IN")}</p>
              </div>
              <StatusBadge status={d.status} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return <EmptyState icon="⚙️" message="Select a section from sidebar" />;
}