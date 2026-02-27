// src/components/shared/UIComponents.jsx
import React from "react";

export const StatCard = ({ icon, label, value, sub, color = "emerald", trend }) => {
  const colors = {
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30 text-emerald-400",
    red:     "from-red-500/20 to-red-600/5 border-red-500/30 text-red-400",
    blue:    "from-blue-500/20 to-blue-600/5 border-blue-500/30 text-blue-400",
    amber:   "from-amber-500/20 to-amber-600/5 border-amber-500/30 text-amber-400",
    violet:  "from-violet-500/20 to-violet-600/5 border-violet-500/30 text-violet-400",
    cyan:    "from-cyan-500/20 to-cyan-600/5 border-cyan-500/30 text-cyan-400",
  };
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${colors[color]}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">{label}</p>
          <p className="text-3xl font-black text-white">{value}</p>
          {sub && <p className="text-xs mt-1 text-white/50">{sub}</p>}
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trend > 0 ? "text-red-400" : "text-emerald-400"}`}>
              {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}% today
            </p>
          )}
        </div>
        <span className="text-3xl opacity-80">{icon}</span>
      </div>
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const map = {
    available:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    pending:     "bg-amber-500/20 text-amber-300 border-amber-500/30",
    confirmed:   "bg-blue-500/20 text-blue-300 border-blue-500/30",
    admitted:    "bg-violet-500/20 text-violet-300 border-violet-500/30",
    discharged:  "bg-slate-500/20 text-slate-300 border-slate-500/30",
    cancelled:   "bg-red-500/20 text-red-300 border-red-500/30",
    dispatched:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
    en_route:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
    completed:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    occupied:    "bg-red-500/20 text-red-300 border-red-500/30",
    reserved:    "bg-amber-500/20 text-amber-300 border-amber-500/30",
    maintenance: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    emergency:   "bg-red-500/20 text-red-300 border-red-500/30 animate-pulse",
    routine:     "bg-slate-500/20 text-slate-300 border-slate-500/30",
    urgent:      "bg-orange-500/20 text-orange-300 border-orange-500/30",
    requested:   "bg-amber-500/20 text-amber-300 border-amber-500/30",
    arrived:     "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${map[status] || "bg-slate-700 text-white"}`}>
      {status?.replace("_", " ").toUpperCase()}
    </span>
  );
};

export const SectionTitle = ({ children, action }) => (
  <div className="flex items-center justify-between mb-4">
    <h2 className="text-lg font-bold text-white tracking-tight">{children}</h2>
    {action}
  </div>
);

export const EmptyState = ({ icon, message }) => (
  <div className="flex flex-col items-center justify-center py-12 text-white/30">
    <span className="text-5xl mb-3">{icon}</span>
    <p className="text-sm">{message}</p>
  </div>
);

export const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full min-h-[400px]">
    <div className="relative">
      <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-emerald-400 animate-spin" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl">🏥</span>
      </div>
    </div>
  </div>
);

export const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 ${className}`}>
    {children}
  </div>
);

export const BedBar = ({ label, available, total, color }) => {
  const pct = total ? Math.round(((total - available) / total) * 100) : 0;
  const barColor = pct > 80 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs text-white/60 mb-1">
        <span className="font-semibold text-white/80">{label}</span>
        <span>{available} / {total} free</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${barColor} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-right text-xs text-white/40 mt-0.5">{pct}% occupied</p>
    </div>
  );
};