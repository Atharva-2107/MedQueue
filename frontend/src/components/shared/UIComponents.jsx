// src/components/shared/UIComponents.jsx
import React from "react";

/* ─── Color palettes ─────────────────────────────────────────── */
const COLOR = {
  emerald: {
    bg: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/30",
    text: "text-emerald-400",
    ring: "bg-emerald-500/20",
    bar: "bg-emerald-500",
    glow: "shadow-emerald-500/20",
  },
  red: {
    bg: "from-red-500/20 to-red-600/5",
    border: "border-red-500/30",
    text: "text-red-400",
    ring: "bg-red-500/20",
    bar: "bg-red-500",
    glow: "shadow-red-500/20",
  },
  blue: {
    bg: "from-blue-500/20 to-blue-600/5",
    border: "border-blue-500/30",
    text: "text-blue-400",
    ring: "bg-blue-500/20",
    bar: "bg-blue-500",
    glow: "shadow-blue-500/20",
  },
  amber: {
    bg: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/30",
    text: "text-amber-400",
    ring: "bg-amber-500/20",
    bar: "bg-amber-500",
    glow: "shadow-amber-500/20",
  },
  violet: {
    bg: "from-violet-500/20 to-violet-600/5",
    border: "border-violet-500/30",
    text: "text-violet-400",
    ring: "bg-violet-500/20",
    bar: "bg-violet-500",
    glow: "shadow-violet-500/20",
  },
  cyan: {
    bg: "from-cyan-500/20 to-cyan-600/5",
    border: "border-cyan-500/30",
    text: "text-cyan-400",
    ring: "bg-cyan-500/20",
    bar: "bg-cyan-500",
    glow: "shadow-cyan-500/20",
  },
  orange: {
    bg: "from-orange-500/20 to-orange-600/5",
    border: "border-orange-500/30",
    text: "text-orange-400",
    ring: "bg-orange-500/20",
    bar: "bg-orange-500",
    glow: "shadow-orange-500/20",
  },
};

/* ─── StatCard ───────────────────────────────────────────────── */
export const StatCard = ({ icon, label, value, sub, color = "emerald", trend }) => {
  const c = COLOR[color] || COLOR.emerald;
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${c.bg} ${c.border} ${c.glow}`}
      style={{ boxShadow: "0 2px 20px rgba(0,0,0,0.3)" }}
    >
      {/* Decorative ring */}
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-30 ${c.ring}`} />

      <div className="flex items-start justify-between relative z-10">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">{label}</p>
          <p className="text-3xl font-black text-white leading-none">{value ?? "—"}</p>
          {sub && <p className="text-xs mt-1.5 text-white/50">{sub}</p>}
          {trend !== undefined && (
            <p className={`text-xs mt-2 font-semibold ${trend > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% today
            </p>
          )}
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ml-3 ${c.ring}`}>
          <span className="text-xl">{icon}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── StatusBadge ────────────────────────────────────────────── */
export const StatusBadge = ({ status }) => {
  const map = {
    available: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pending: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    confirmed: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    admitted: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    discharged: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
    dispatched: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    en_route: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    completed: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    occupied: "bg-red-500/20 text-red-300 border-red-500/30",
    reserved: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    maintenance: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    emergency: "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse",
    routine: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    urgent: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    requested: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    arrived: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    offline: "bg-slate-600/30 text-slate-400 border-slate-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[status] || "bg-slate-700/50 text-white/60 border-white/10"}`}>
      {status?.replace(/_/g, " ").toUpperCase()}
    </span>
  );
};

/* ─── SectionTitle ───────────────────────────────────────────── */
export const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold text-white tracking-tight">{children}</h2>
    {action}
  </div>
);

/* ─── EmptyState ─────────────────────────────────────────────── */
export const EmptyState = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-14 text-white/30">
    <span className="text-5xl mb-4 opacity-60">{icon}</span>
    <p className="text-sm font-medium">{message}</p>
  </div>
);

/* ─── LoadingSpinner ─────────────────────────────────────────── */
export const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4">
    <div className="relative">
      <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-emerald-400 animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">🏥</span>
      </div>
    </div>
    <p className="text-sm text-white/30 font-medium animate-pulse">Loading data...</p>
  </div>
);

/* ─── Card ───────────────────────────────────────────────────── */
export const Card = ({ children, className = "" }) => (
  <div
    className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 transition-all duration-200 hover:border-white/15 hover:bg-white/[0.07] ${className}`}
    style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.25)" }}
  >
    {children}
  </div>
);

/* ─── BedBar ─────────────────────────────────────────────────── */
export const BedBar = ({ label, available, total }) => {
  const pct = total ? Math.round(((total - available) / total) * 100) : 0;
  const barColor =
    pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  const textColor =
    pct > 80 ? "text-red-400" : pct > 60 ? "text-amber-400" : "text-emerald-400";
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="font-semibold text-white/80">{label}</span>
        <span className={`font-bold ${textColor}`}>
          {available}<span className="text-white/30">/{total} free</span>
        </span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className={`text-right text-xs mt-0.5 ${textColor}`}>{pct}% occupied</p>
    </div>
  );
};

/* ─── ProgressRing ───────────────────────────────────────────── */
export const ProgressRing = ({ label, value, max, icon, color = "emerald" }) => {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const used = ((100 - pct) / 100) * circ; // filled arc
  const c = COLOR[color] || COLOR.emerald;
  const strokeMap = {
    emerald: "#34d399", red: "#f87171", blue: "#60a5fa",
    amber: "#fbbf24", violet: "#a78bfa", cyan: "#22d3ee", orange: "#fb923c",
  };
  const stroke = strokeMap[color] || "#34d399";
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
          <circle cx="44" cy="44" r={radius} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={radius} fill="none"
            stroke={stroke} strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={used}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg">{icon}</span>
          <p className="text-xs font-black text-white">{pct}%</p>
        </div>
      </div>
      <div className="text-center">
        <p className={`text-xs font-semibold uppercase tracking-wider ${c.text}`}>{label}</p>
        <p className="text-white/40 text-xs">{value} / {max}</p>
      </div>
    </div>
  );
};

/* ─── DashboardHeader ────────────────────────────────────────── */
export const DashboardHeader = ({ title, subtitle, badge, badgeColor = "emerald" }) => {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  const c = COLOR[badgeColor] || COLOR.emerald;
  return (
    <div className="flex items-start justify-between flex-wrap gap-4">
      <div>
        <h1 className="text-2xl font-black text-white leading-tight">{title}</h1>
        {subtitle && <p className="text-white/40 text-sm mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {badge && (
          <span className={`px-3 py-1.5 rounded-xl border text-xs font-bold ${c.border} ${c.ring} ${c.text}`}>
            {badge}
          </span>
        )}
        <div className="text-right">
          <p className="text-white font-bold text-sm">{timeStr}</p>
          <p className="text-white/30 text-xs">{dateStr}</p>
        </div>
      </div>
    </div>
  );
};

/* ─── InfoRow ────────────────────────────────────────────────── */
export const InfoRow = ({ label, value, icon }) => (
  <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
    {icon && <span className="text-base w-5 text-center flex-shrink-0">{icon}</span>}
    <span className="text-white/40 text-xs font-semibold w-28 flex-shrink-0">{label}</span>
    <span className="text-white text-sm font-medium truncate">{value || "—"}</span>
  </div>
);

/* ─── Divider ────────────────────────────────────────────────── */
export const Divider = ({ label }) => (
  <div className="flex items-center gap-3 my-2">
    <div className="h-px flex-1 bg-white/5" />
    {label && <span className="text-white/20 text-xs font-semibold uppercase tracking-wider">{label}</span>}
    <div className="h-px flex-1 bg-white/5" />
  </div>
);