// src/components/dashboard/StaffDashboard.jsx
// Full Staff Dashboard – bed management, OPD queue, bookings, admissions
import React, { useState, useCallback } from "react";
import { useDashboard } from "../../hooks/useDashboard";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, DashboardHeader, InfoRow,
} from "../shared/UIComponents";
import api from "../../lib/api";

/* ─── constants ─────────────────────────────────────────────────── */
const BED_TYPES = ["general", "icu", "nicu", "emergency", "private"];
const BED_STATUSES = ["available", "occupied", "reserved", "maintenance"];

const BED_META = {
  general: { icon: "🛏️", color: "emerald" },
  icu: { icon: "❤️‍🔥", color: "red" },
  nicu: { icon: "👶", color: "violet" },
  emergency: { icon: "🆘", color: "orange" },
  private: { icon: "🔒", color: "blue" },
};

const STATUS_STYLE = {
  available: { ring: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", dot: "bg-emerald-400" },
  occupied: { ring: "bg-red-500/10 border-red-500/30 text-red-300", dot: "bg-red-400" },
  reserved: { ring: "bg-amber-500/10 border-amber-500/30 text-amber-300", dot: "bg-amber-400" },
  maintenance: { ring: "bg-slate-500/10 border-slate-500/30 text-slate-300", dot: "bg-slate-400" },
};

const COLOR_BAR = {
  emerald: "bg-emerald-500", red: "bg-red-500", violet: "bg-violet-500",
  orange: "bg-orange-500", blue: "bg-blue-500",
};

/* ─── tiny helpers ───────────────────────────────────────────────── */
const pct = (used, total) => (total ? Math.round((used / total) * 100) : 0);

/* ─── sub-components ─────────────────────────────────────────────── */
const Pill = ({ label, active, onClick, color = "emerald" }) => (
  <button
    onClick={onClick}
    className={`px-2 py-1 text-xs font-bold rounded-lg border transition-all capitalize ${active
        ? `bg-${color}-500/20 border-${color}-500/40 text-${color}-300`
        : "bg-white/5 border-white/10 text-white/40 hover:border-white/25 hover:text-white/70"
      }`}
  >
    {label}
  </button>
);

/* ─── AddBedModal ─────────────────────────────────────────────────── */
function AddBedModal({ hospitalId, onClose, onAdded }) {
  const [form, setForm] = useState({ bed_number: "", bed_type: "general", floor: "", ward: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!form.bed_number) return setErr("Bed number is required");
    setSaving(true); setErr("");
    try {
      await api.post("/beds", { ...form, hospital_id: hospitalId });
      onAdded();
      onClose();
    } catch (e) {
      setErr(e.response?.data?.message || "Failed to add bed");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0e1520] p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">🛏️ Add New Bed</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-xl">✕</button>
        </div>

        {err && <div className="mb-4 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/25 text-red-300 text-sm">{err}</div>}

        <div className="space-y-4">
          <div>
            <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Bed Number *</label>
            <input
              type="text" placeholder="e.g. G-101"
              value={form.bed_number} onChange={e => setForm(p => ({ ...p, bed_number: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400/50 transition-colors"
            />
          </div>
          <div>
            <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Bed Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {BED_TYPES.map(t => (
                <button key={t} onClick={() => setForm(p => ({ ...p, bed_type: t }))}
                  className={`py-2.5 rounded-xl border text-xs font-bold capitalize transition-all ${form.bed_type === t ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" : "bg-white/5 border-white/10 text-white/40 hover:border-white/25"}`}>
                  {BED_META[t]?.icon} {t}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Floor</label>
              <input type="text" placeholder="e.g. 2" value={form.floor}
                onChange={e => setForm(p => ({ ...p, floor: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400/50" />
            </div>
            <div>
              <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Ward</label>
              <input type="text" placeholder="e.g. North Wing" value={form.ward}
                onChange={e => setForm(p => ({ ...p, ward: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-emerald-400/50" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-white/50 text-sm font-bold hover:bg-white/8 transition-all">Cancel</button>
          <button onClick={submit} disabled={saving}
            className="flex-2 flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50">
            {saving ? "Adding..." : "Add Bed"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── AdmitPatientModal ────────────────────────────────────────────── */
function AdmitPatientModal({ booking, onClose, onDone }) {
  const [doctor, setDoctor] = useState(booking.attending_doctor || "");
  const [saving, setSaving] = useState(false);

  const admit = async () => {
    setSaving(true);
    try {
      await api.put(`/beds/bookings/${booking.id}/status`, { status: "admitted", attending_doctor: doctor });
      onDone();
      onClose();
    } catch { /* handled by parent */ } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-2xl border border-emerald-500/20 bg-[#0e1520] p-6">
        <h3 className="text-white font-black text-lg mb-1">🏥 Admit Patient</h3>
        <p className="text-white/40 text-sm mb-5">{booking.patient_profiles?.users?.full_name} → {booking.beds?.bed_number}</p>
        <label className="block text-white/40 text-xs font-bold uppercase tracking-widest mb-2">Attending Doctor</label>
        <input type="text" placeholder="Dr. Sharma" value={doctor} onChange={e => setDoctor(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm mb-5 focus:outline-none focus:border-emerald-400/50" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-sm font-bold">Cancel</button>
          <button onClick={admit} disabled={saving} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black disabled:opacity-50">
            {saving ? "Admitting..." : "Confirm Admit"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Component ───────────────────────────────────────────────── */
export default function StaffDashboard({ section }) {
  const { data, loading, error, refetch } = useDashboard("hospital_staff");
  const [updating, setUpdating] = useState(null);
  const [opdInput, setOpdInput] = useState("");
  const [showAddBed, setShowAddBed] = useState(false);
  const [admitModal, setAdmitModal] = useState(null);
  const [bedFilter, setBedFilter] = useState({ type: "all", status: "all", search: "" });

  const updateBooking = useCallback(async (id, status, extra = {}) => {
    setUpdating(id);
    try {
      await api.put(`/beds/bookings/${id}/status`, { status, ...extra });
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || "Update failed");
    } finally { setUpdating(null); }
  }, [refetch]);

  const updateBedStatus = useCallback(async (bedId, status) => {
    setUpdating(bedId);
    try {
      await api.put(`/beds/${bedId}`, { status });
      refetch();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update bed");
    } finally { setUpdating(null); }
  }, [refetch]);

  const updateOpd = async () => {
    if (!opdInput || !data?.hospital?.id) return;
    try {
      await api.post("/monitoring/opd/update", {
        hospital_id: data.hospital.id,
        opd_queue_count: parseInt(opdInput),
      });
      refetch();
      setOpdInput("");
    } catch { alert("Failed to update OPD queue"); }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <div className="p-8 text-red-400 font-semibold">⚠️ {error}</div>;
  if (!data) return null;

  const { hospital: h, bed_breakdown: bd = {}, all_beds = [], pending_bookings = [], admitted_patients = [] } = data;

  const filteredBeds = all_beds.filter(b => {
    const matchType = bedFilter.type === "all" || b.bed_type === bedFilter.type;
    const matchStatus = bedFilter.status === "all" || b.status === bedFilter.status;
    const matchSearch = !bedFilter.search || b.bed_number.toLowerCase().includes(bedFilter.search.toLowerCase()) ||
      (b.ward || "").toLowerCase().includes(bedFilter.search.toLowerCase());
    return matchType && matchStatus && matchSearch;
  });

  /* ════════════════════ HOME ════════════════════ */
  if (section === "home" || !section) return (
    <div className="space-y-6">
      {showAddBed && h && <AddBedModal hospitalId={h.id} onClose={() => setShowAddBed(false)} onAdded={refetch} />}
      {admitModal && <AdmitPatientModal booking={admitModal} onClose={() => setAdmitModal(null)} onDone={refetch} />}

      {/* Hospital banner */}
      <div className="rounded-2xl p-6 border relative overflow-hidden"
        style={{ background: "linear-gradient(135deg,rgba(59,130,246,.12) 0%,rgba(8,12,18,.9) 60%)", borderColor: "rgba(59,130,246,.2)" }}>
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full opacity-10" style={{ background: "radial-gradient(circle,#3b82f6 0%,transparent 70%)" }} />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-blue-400 text-xs font-bold uppercase tracking-widest mb-1">Hospital Staff Dashboard</p>
            <h1 className="text-2xl font-black text-white">{h?.name}</h1>
            <p className="text-white/40 text-sm mt-1">📍 {h?.address}, {h?.city}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button onClick={() => setShowAddBed(true)}
              className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-black transition-all shadow-lg shadow-emerald-500/25">
              ＋ Add Bed
            </button>
          </div>
        </div>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🛏️" label="Available Beds" value={h?.available_beds} sub={`/ ${h?.total_beds}`} color="emerald" />
        <StatCard icon="❤️‍🔥" label="ICU Available" value={h?.available_icu} sub={`/ ${h?.total_icu}`} color="red" />
        <StatCard icon="⏳" label="Pending" value={pending_bookings.length} color="amber" />
        <StatCard icon="🏨" label="Admitted" value={admitted_patients.length} color="violet" />
      </div>

      {/* Bed type breakdown */}
      <div>
        <SectionTitle>🛏️ Bed Breakdown</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {BED_TYPES.filter(t => bd[t]).map(type => {
            const b = bd[type];
            const m = BED_META[type];
            const barC = pct(b.total - b.available, b.total) > 80 ? "bg-red-500" : pct(b.total - b.available, b.total) > 60 ? "bg-amber-500" : COLOR_BAR[m.color];
            const occ = pct(b.total - b.available, b.total);
            return (
              <Card key={type} className={occ > 80 ? "!border-red-500/25" : ""}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg border bg-${m.color}-500/10 border-${m.color}-500/20`}>{m.icon}</div>
                  <p className="text-white/70 text-sm font-bold uppercase tracking-wide capitalize">{type}</p>
                </div>
                <div className="flex items-end gap-1.5 mb-3">
                  <span className="text-3xl font-black text-white">{b.available}</span>
                  <span className="text-white/30 text-sm pb-1">/ {b.total} free</span>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-1.5">
                  <div className={`h-full ${barC} rounded-full transition-all duration-700`} style={{ width: `${occ}%` }} />
                </div>
                <div className="flex justify-between text-xs text-white/30">
                  <span>{b.occupied || 0} occupied</span>
                  <span className={occ > 80 ? "text-red-400 font-bold" : "text-emerald-400"}>{occ}%</span>
                  <span>{b.reserved || 0} reserved</span>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* OPD Queue */}
      <Card className="!border-amber-500/20 !bg-amber-500/5">
        <SectionTitle>🧑‍⚕️ OPD Queue</SectionTitle>
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <p className="text-5xl font-black text-white">{h?.opd_queue_count ?? 0}</p>
            <p className="text-white/30 text-sm mt-1">patients waiting</p>
          </div>
          <div className="flex gap-2 ml-auto">
            <input type="number" value={opdInput} onChange={e => setOpdInput(e.target.value)} placeholder="New count" min="0"
              className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-400/50" />
            <button onClick={updateOpd} disabled={!opdInput}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-300 text-sm font-bold hover:bg-amber-500/30 transition-all disabled:opacity-40">
              Update
            </button>
          </div>
        </div>
      </Card>

      {/* Pending Bookings */}
      <div>
        <SectionTitle>⏳ Pending Approvals ({pending_bookings.length})</SectionTitle>
        {pending_bookings.length === 0
          ? <EmptyState icon="✅" message="No pending approvals" />
          : <div className="space-y-3">
            {pending_bookings.map(b => {
              const p = b.patient_profiles;
              const isEmergency = b.booking_type === "emergency";
              return (
                <Card key={b.id} className={isEmergency ? "!border-red-500/30 !bg-red-500/5" : ""}>
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${isEmergency ? "bg-red-500/20 border border-red-500/30 text-red-300" : "bg-blue-500/20 border border-blue-500/30 text-blue-300"}`}>
                      {(p?.users?.full_name || "?")[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className="text-white font-bold">{p?.users?.full_name}</p>
                        <StatusBadge status={p?.priority_level} />
                        {isEmergency && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 border border-red-500/30 text-red-300 font-black animate-pulse">🆘 EMERGENCY</span>}
                      </div>
                      <InfoRow label="Phone" value={p?.users?.phone} icon="📞" />
                      <InfoRow label="Bed" value={`${b.beds?.bed_number} (${b.beds?.bed_type})`} icon="🛏️" />
                      {b.reason_for_admission && <InfoRow label="Reason" value={b.reason_for_admission} icon="📋" />}
                      <p className="text-white/20 text-xs mt-1">{new Date(b.created_at).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button onClick={() => setAdmitModal(b)} disabled={updating === b.id}
                        className="px-4 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-bold hover:bg-emerald-500/30 transition-all">
                        ✓ Admit
                      </button>
                      <button onClick={() => updateBooking(b.id, "confirmed")} disabled={updating === b.id}
                        className="px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/30 transition-all">
                        ✓ Confirm
                      </button>
                      <button onClick={() => updateBooking(b.id, "cancelled")} disabled={updating === b.id}
                        className="px-4 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-bold hover:bg-red-500/30 transition-all">
                        ✗ Cancel
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        }
      </div>
    </div>
  );

  /* ════════════════════ BED MAP (interactive) ════════════════════ */
  if (section === "bedmap") return (
    <div className="space-y-6">
      {showAddBed && h && <AddBedModal hospitalId={h.id} onClose={() => setShowAddBed(false)} onAdded={refetch} />}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <DashboardHeader title="🛏️ Bed Management" subtitle={`${all_beds.length} beds · ${h?.name}`} />
        <button onClick={() => setShowAddBed(true)}
          className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-black transition-all shadow-lg shadow-emerald-500/20">
          ＋ Add Bed
        </button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-center">
          <input type="text" placeholder="🔍 Search bed / ward..." value={bedFilter.search}
            onChange={e => setBedFilter(p => ({ ...p, search: e.target.value }))}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm w-48 focus:outline-none focus:border-emerald-400/50" />
          <div className="flex gap-2 flex-wrap">
            <Pill label="All Types" active={bedFilter.type === "all"} onClick={() => setBedFilter(p => ({ ...p, type: "all" }))} />
            {BED_TYPES.map(t => <Pill key={t} label={`${BED_META[t]?.icon} ${t}`} active={bedFilter.type === t} onClick={() => setBedFilter(p => ({ ...p, type: t }))} />)}
          </div>
          <div className="flex gap-2 flex-wrap ml-auto">
            <Pill label="All Status" active={bedFilter.status === "all"} onClick={() => setBedFilter(p => ({ ...p, status: "all" }))} />
            {BED_STATUSES.map(s => <Pill key={s} label={s} active={bedFilter.status === s} onClick={() => setBedFilter(p => ({ ...p, status: s }))} color={s === "available" ? "emerald" : s === "occupied" ? "red" : s === "maintenance" ? "amber" : "blue"} />)}
          </div>
        </div>
      </Card>

      {/* Legend */}
      <div className="flex gap-3 flex-wrap text-xs">
        {BED_STATUSES.map(s => (
          <span key={s} className={`px-3 py-1.5 rounded-full border font-semibold capitalize ${STATUS_STYLE[s]?.ring}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${STATUS_STYLE[s]?.dot}`} />{s}
          </span>
        ))}
      </div>

      {/* Bed Grid - grouped by type */}
      {BED_TYPES.map(type => {
        const typeBeds = filteredBeds.filter(b => b.bed_type === type);
        if (!typeBeds.length) return null;
        return (
          <div key={type}>
            <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3">
              {BED_META[type]?.icon} {type} Ward ({typeBeds.length} beds)
            </p>
            <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-12 gap-2">
              {typeBeds.map(bed => {
                const s = STATUS_STYLE[bed.status] || STATUS_STYLE.maintenance;
                return (
                  <div key={bed.id} className="relative group">
                    <div className={`aspect-square rounded-xl border flex flex-col items-center justify-center text-xs font-bold cursor-pointer transition-all hover:scale-110 hover:z-10 ${s.ring}`}
                      title={`${bed.bed_number} — ${bed.status}${bed.ward ? ` · ${bed.ward}` : ""}`}>
                      <span>{bed.bed_number.replace(/\D/g, "").slice(-3) || bed.bed_number.slice(-2)}</span>
                    </div>
                    {/* click menu */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col gap-1 z-20 min-w-max">
                      {BED_STATUSES.filter(s2 => s2 !== bed.status).map(s2 => (
                        <button key={s2} onClick={() => updateBedStatus(bed.id, s2)} disabled={updating === bed.id}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border capitalize transition-all ${STATUS_STYLE[s2]?.ring} hover:opacity-100`}>
                          → {s2}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filteredBeds.length === 0 && <EmptyState icon="🛏️" message="No beds match your filters" />}
    </div>
  );

  /* ════════════════════ ADMITTED ════════════════════ */
  if (section === "admitted") return (
    <div className="space-y-6">
      <DashboardHeader title="🏨 Admitted Patients" subtitle={`${admitted_patients.length} currently admitted`} />

      {admitted_patients.length === 0
        ? <EmptyState icon="🏨" message="No patients currently admitted" />
        : <div className="space-y-3">
          {admitted_patients.map(b => {
            const p = b.patient_profiles;
            return (
              <Card key={b.id}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-sm font-black text-violet-300 flex-shrink-0">
                    {(p?.users?.full_name || "?")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <p className="text-white font-bold">{p?.users?.full_name}</p>
                      {p?.blood_group && <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/15 border border-red-500/30 text-red-300 font-black">{p.blood_group}</span>}
                      <StatusBadge status={p?.priority_level} />
                    </div>
                    <InfoRow label="Phone" value={p?.users?.phone} icon="📞" />
                    <InfoRow label="Bed" value={`${b.beds?.bed_number} — ${b.beds?.ward || "N/A"}`} icon="🛏️" />
                    {b.attending_doctor && <InfoRow label="Doctor" value={b.attending_doctor} icon="👨‍⚕️" />}
                    {p?.allergies?.length > 0 && (
                      <p className="text-orange-400 text-xs mt-1 font-medium">⚠️ Allergies: {p.allergies.join(", ")}</p>
                    )}
                    {b.admitted_at && <p className="text-white/20 text-xs mt-1">Admitted: {new Date(b.admitted_at).toLocaleString("en-IN")}</p>}
                  </div>
                  <button onClick={() => updateBooking(b.id, "discharged")} disabled={updating === b.id}
                    className="px-4 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-bold hover:bg-blue-500/30 transition-all flex-shrink-0">
                    Discharge
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      }
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}