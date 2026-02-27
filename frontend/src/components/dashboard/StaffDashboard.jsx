// src/components/dashboard/StaffDashboard.jsx
import React, { useState } from "react";
import { useDashboard } from "../../hooks/useDashboard";
import { StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner, Card } from "../shared/UIComponents";
import api from "../../lib/api";

export default function StaffDashboard({ section }) {
  const { data, loading, error, refetch } = useDashboard("hospital_staff");
  const [updating, setUpdating] = useState(null);
  const [opdQueue, setOpdQueue] = useState("");

  const updateBookingStatus = async (id, status) => {
    setUpdating(id);
    try {
      await api.put(`/beds/bookings/${id}/status`, { status });
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally {
      setUpdating(null);
    }
  };

  const updateOpd = async () => {
    try {
      await api.post("/monitoring/opd/update", {
        hospital_id: data.hospital.id,
        opd_queue_count: parseInt(opdQueue),
      });
      refetch();
      setOpdQueue("");
    } catch (err) {
      alert("Failed to update OPD queue");
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error)   return <div className="p-8 text-red-400">Error: {error}</div>;
  if (!data)   return null;

  const { hospital: h, bed_breakdown: bd, all_beds, pending_bookings, admitted_patients, recent_activity } = data;

  const bedTypes = ["general","icu","nicu","emergency","private"];

  // HOME section
  if (section === "home" || !section) return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-white">{h?.name}</h1>
        <p className="text-white/40 text-sm">{h?.address}, {h?.city}</p>
      </div>

      {/* Bed stats per type */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🛏️" label="Available Beds" value={h?.available_beds}  sub={`of ${h?.total_beds}`} color="emerald" />
        <StatCard icon="❤️‍🔥" label="ICU Available"  value={h?.available_icu}   sub={`of ${h?.total_icu}`}  color="red" />
        <StatCard icon="⏳" label="Pending"          value={pending_bookings.length} color="amber" />
        <StatCard icon="🏨" label="Admitted"          value={admitted_patients.length} color="violet" />
      </div>

      {/* Bed type breakdown */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {bedTypes.filter(t => bd[t]).map((type) => {
          const b = bd[type];
          const pct = b.total ? Math.round(((b.total - b.available) / b.total) * 100) : 0;
          return (
            <Card key={type}>
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">{type}</p>
              <div className="flex items-end gap-2 mb-2">
                <p className="text-3xl font-black text-white">{b.available}</p>
                <p className="text-white/30 text-sm pb-1">/ {b.total} free</p>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500"}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <div className="flex justify-between text-xs mt-2 text-white/30">
                <span>{b.occupied || 0} occupied</span>
                <span>{b.reserved || 0} reserved</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* OPD Update */}
      <Card className="border-amber-500/20">
        <SectionTitle>🧑‍⚕️ OPD Queue</SectionTitle>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <p className="text-4xl font-black text-white">{h?.opd_queue_count}</p>
            <p className="text-white/40 text-sm">current patients in queue</p>
          </div>
          <div className="flex gap-2">
            <input type="number" value={opdQueue} onChange={(e) => setOpdQueue(e.target.value)}
              placeholder="New count" min="0"
              className="w-28 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-400/50" />
            <button onClick={updateOpd} disabled={!opdQueue}
              className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition-all disabled:opacity-50">
              Update
            </button>
          </div>
        </div>
      </Card>

      {/* Pending bookings */}
      <div>
        <SectionTitle>⏳ Pending Approvals ({pending_bookings.length})</SectionTitle>
        {pending_bookings.length === 0 ? <EmptyState icon="✅" message="No pending bookings" /> : (
          <div className="space-y-3">
            {pending_bookings.map((b) => {
              const p = b.patient_profiles;
              return (
                <Card key={b.id} className={b.booking_type === "emergency" ? "border-red-500/30 bg-red-500/5" : ""}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-bold">{p?.users?.full_name}</p>
                        <StatusBadge status={p?.priority_level} />
                        {b.booking_type === "emergency" && <StatusBadge status="emergency" />}
                      </div>
                      <p className="text-white/50 text-sm">📞 {p?.users?.phone}</p>
                      <p className="text-white/50 text-sm">
                        Bed: {b.beds?.bed_number} ({b.beds?.bed_type})
                      </p>
                      {b.reason_for_admission && (
                        <p className="text-white/30 text-xs mt-1">Reason: {b.reason_for_admission}</p>
                      )}
                      <p className="text-white/20 text-xs">{new Date(b.created_at).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <button onClick={() => updateBookingStatus(b.id, "confirmed")}
                        disabled={updating === b.id}
                        className="px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-all">
                        ✓ Confirm
                      </button>
                      <button onClick={() => updateBookingStatus(b.id, "cancelled")}
                        disabled={updating === b.id}
                        className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-all">
                        ✗ Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // BED MAP section
  if (section === "bedmap") return (
    <div className="space-y-6">
      <SectionTitle>🛏️ Bed Map — {h?.name}</SectionTitle>
      <div className="flex gap-3 text-xs flex-wrap">
        {[["available","emerald"],["occupied","red"],["reserved","amber"],["maintenance","slate"]].map(([s,c]) => (
          <span key={s} className={`px-3 py-1 rounded-full border ${
            c === "emerald" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" :
            c === "red"     ? "border-red-500/40 bg-red-500/10 text-red-300" :
            c === "amber"   ? "border-amber-500/40 bg-amber-500/10 text-amber-300" :
            "border-slate-500/40 bg-slate-500/10 text-slate-300"
          } font-medium capitalize`}>{s}</span>
        ))}
      </div>
      {["icu","nicu","emergency","general","private"].map((type) => {
        const beds = all_beds.filter((b) => b.bed_type === type);
        if (!beds.length) return null;
        return (
          <div key={type}>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">{type} Ward</p>
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-10 gap-2">
              {beds.map((bed) => (
                <div key={bed.id}
                  title={`Bed ${bed.bed_number} — ${bed.status}`}
                  className={`aspect-square rounded-xl border flex items-center justify-center text-xs font-bold cursor-default transition-all ${
                    bed.status === "available"   ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300" :
                    bed.status === "occupied"    ? "border-red-500/40 bg-red-500/15 text-red-300" :
                    bed.status === "reserved"    ? "border-amber-500/40 bg-amber-500/15 text-amber-300" :
                    "border-slate-500/40 bg-slate-500/10 text-slate-400"
                  }`}>
                  {bed.bed_number.replace(/[^0-9]/g, "") || bed.bed_number.slice(-2)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  // ADMITTED section
  if (section === "admitted") return (
    <div className="space-y-6">
      <SectionTitle>🏨 Currently Admitted ({admitted_patients.length})</SectionTitle>
      {admitted_patients.length === 0 ? <EmptyState icon="🏨" message="No patients currently admitted" /> : (
        <div className="space-y-3">
          {admitted_patients.map((b) => {
            const p = b.patient_profiles;
            return (
              <Card key={b.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-bold">{p?.users?.full_name}</p>
                      {p?.blood_group && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 border border-red-500/30 text-red-300 font-bold">{p.blood_group}</span>}
                      <StatusBadge status={p?.priority_level} />
                    </div>
                    <p className="text-white/50 text-sm">📞 {p?.users?.phone}</p>
                    <p className="text-white/50 text-sm">🛏️ Bed {b.beds?.bed_number} — {b.beds?.ward}</p>
                    {b.attending_doctor && <p className="text-white/50 text-sm">👨‍⚕️ {b.attending_doctor}</p>}
                    {p?.allergies?.length > 0 && (
                      <p className="text-orange-400 text-xs mt-1">⚠️ Allergies: {p.allergies.join(", ")}</p>
                    )}
                    {b.admitted_at && <p className="text-white/20 text-xs mt-1">Admitted: {new Date(b.admitted_at).toLocaleString("en-IN")}</p>}
                  </div>
                  <button onClick={() => updateBookingStatus(b.id, "discharged")}
                    disabled={updating === b.id}
                    className="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/30 transition-all">
                    Discharge
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}