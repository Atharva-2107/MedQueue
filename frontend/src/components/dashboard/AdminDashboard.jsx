// src/components/dashboard/AdminDashboard.jsx
import React from "react";
import { useDashboard } from "../../hooks/useDashboard";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, ProgressRing, DashboardHeader, InfoRow,
} from "../shared/UIComponents";

export default function AdminDashboard({ section }) {
  const { data, loading, error } = useDashboard("admin");

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-8 text-red-400 font-semibold">⚠️ Error: {error}</div>;
  if (!data) return null;

  const {
    system_totals: t, ambulance_summary: a, total_patients,
    pending_bookings, active_dispatches, hospitals,
    recent_bookings, recent_dispatches,
  } = data;

  /* ── HOME ── */
  if (section === "home" || !section) {
    const bedPct = t.total_beds ? Math.round(((t.total_beds - t.available_beds) / t.total_beds) * 100) : 0;
    const icuPct = t.total_icu ? Math.round(((t.total_icu - t.available_icu) / t.total_icu) * 100) : 0;
    const fleetPct = a.total ? Math.round((a.dispatched / a.total) * 100) : 0;

    return (
      <div className="space-y-6">
        {/* Header */}
        <DashboardHeader
          title="System Overview"
          subtitle="MedQueue — Pune City-Wide Dashboard"
          badge="ADMIN"
          badgeColor="violet"
        />

        {/* Occupancy Rings */}
        <Card>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-5">City-Wide Capacity</p>
          <div className="flex justify-around flex-wrap gap-6">
            <ProgressRing label="Bed Occupancy" value={t.total_beds - t.available_beds} max={t.total_beds} icon="🛏️" color="emerald" />
            <ProgressRing label="ICU Occupancy" value={t.total_icu - t.available_icu} max={t.total_icu} icon="❤️‍🔥" color="red" />
            <ProgressRing label="Fleet Active" value={a.dispatched} max={a.total} icon="🚑" color="amber" />
          </div>
        </Card>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon="🛏️" label="Available Beds" value={t.available_beds} sub={`of ${t.total_beds} total`} color="emerald" />
          <StatCard icon="❤️‍🔥" label="ICU Available" value={t.available_icu} sub={`of ${t.total_icu} ICU total`} color="red" />
          <StatCard icon="🚑" label="Ambulances Free" value={a.available} sub={`${a.dispatched} dispatched`} color="amber" />
          <StatCard icon="👥" label="Total Patients" value={total_patients} color="violet" />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StatCard icon="⏳" label="Pending Bookings" value={pending_bookings} color="amber" />
          <StatCard icon="📡" label="Active Dispatches" value={active_dispatches} color="blue" />
          <StatCard icon="🏥" label="Active Hospitals" value={hospitals.length} color="cyan" />
        </div>

        {/* Two-column list */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Bookings */}
          <Card>
            <SectionTitle>📋 Recent Bookings</SectionTitle>
            {recent_bookings.length === 0
              ? <EmptyState icon="📋" message="No bookings yet" />
              : (
                <div className="space-y-2">
                  {recent_bookings.map((b) => (
                    <div key={b.id}
                      className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 gap-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-xs font-black text-violet-300 flex-shrink-0">
                        {(b.patient_profiles?.users?.full_name || "?")[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{b.patient_profiles?.users?.full_name || "Unknown"}</p>
                        <p className="text-white/40 text-xs truncate">{b.hospitals?.name} — {b.beds?.bed_type}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
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
            {recent_dispatches.length === 0
              ? <EmptyState icon="🚑" message="No dispatches" />
              : (
                <div className="space-y-2">
                  {recent_dispatches.map((d) => (
                    <div key={d.id}
                      className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 gap-3">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ background: d.priority === "emergency" ? "rgba(239,68,68,0.2)" : "rgba(251,191,36,0.15)" }}
                      >
                        🚑
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-semibold truncate">{d.patient_profiles?.users?.full_name || "Anonymous"}</p>
                        <p className="text-white/40 text-xs truncate">{d.pickup_address}</p>
                        <p className="text-white/30 text-xs">{d.ambulances?.vehicle_number}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={d.status} />
                        {d.priority === "emergency" && (
                          <span className="text-red-400 text-xs font-black animate-pulse">🆘 EMERGENCY</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </Card>
        </div>
      </div>
    );
  }

  /* ── HOSPITALS ── */
  if (section === "hospitals") return (
    <div className="space-y-6">
      <DashboardHeader title="🏥 All Hospitals" subtitle={`${hospitals.length} registered facilities`} />
      <div className="grid gap-4">
        {hospitals.map((h) => {
          const bedPct = h.total_beds ? Math.round(((h.total_beds - h.available_beds) / h.total_beds) * 100) : 0;
          const borderColor = bedPct > 80 ? "#f87171" : bedPct > 60 ? "#fbbf24" : "#34d399";
          return (
            <Card key={h.id} className="hover:border-white/20 transition-colors">
              <div
                className="absolute left-0 top-4 bottom-4 w-1 rounded-r-full"
                style={{ background: borderColor, position: "relative", display: "none" }}
              />
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: borderColor }}
                    />
                    <p className="text-white font-bold text-lg">{h.name}</p>
                  </div>
                  <p className="text-white/40 text-sm mb-4">📍 {h.city}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <BedBar label="General" available={h.available_beds} total={h.total_beds} />
                    <BedBar label="ICU" available={h.available_icu} total={h.total_icu || 0} />
                    <BedBar label="NICU" available={h.available_nicu} total={h.total_nicu || 0} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-white/40 text-xs mb-1 font-semibold uppercase tracking-wider">OPD Queue</p>
                  <p className={`text-3xl font-black ${h.opd_queue_count > 30 ? "text-red-400" : "text-white"}`}>
                    {h.opd_queue_count}
                  </p>
                  <p className="text-white/30 text-xs">patients</p>
                </div>
              </div>
              <p className="text-white/20 text-xs mt-3 pt-3 border-t border-white/5">
                🕐 Updated: {new Date(h.updated_at).toLocaleTimeString("en-IN")}
              </p>
            </Card>
          );
        })}
      </div>
    </div>
  );

  /* ── AMBULANCES ── */
  if (section === "ambulances") return (
    <div className="space-y-6">
      <DashboardHeader title="🚑 Fleet Overview" subtitle="Real-time ambulance status" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="✅" label="Available" value={a.available} color="emerald" />
        <StatCard icon="🔴" label="Dispatched" value={a.dispatched} color="red" />
        <StatCard icon="🔧" label="Maintenance" value={a.maintenance} color="amber" />
        <StatCard icon="📊" label="Total Fleet" value={a.total} color="blue" />
      </div>
      <Card>
        <SectionTitle>Active Dispatch Log</SectionTitle>
        {recent_dispatches.length === 0
          ? <EmptyState icon="🚑" message="No active dispatches" />
          : (
            <div className="space-y-3">
              {recent_dispatches.map((d) => (
                <div key={d.id}
                  className={`p-4 rounded-xl border flex items-start gap-4 ${d.priority === "emergency" ? "border-red-500/30 bg-red-500/5" : "border-white/8 bg-white/3"}`}>
                  <span className="text-2xl flex-shrink-0">🚑</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold">{d.ambulances?.vehicle_number}</p>
                      <StatusBadge status={d.status} />
                      {d.priority === "emergency" && <StatusBadge status="emergency" />}
                    </div>
                    <p className="text-white/50 text-sm truncate">{d.pickup_address}</p>
                    <p className="text-white/30 text-xs mt-1">{new Date(d.created_at).toLocaleString("en-IN")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
      </Card>
    </div>
  );

  return <EmptyState icon="⚙️" message="Select a section from the sidebar" />;
}