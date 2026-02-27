// src/components/shared/UIComponents.jsx
// Light-mode design system for MedQueue dashboards
import React from "react";

/* ─── Color tokens ───────────────────────────────────────────── */
const C = {
  emerald: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669", light: "#d1fae5", bar: "#10b981" },
  red: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", light: "#fee2e2", bar: "#ef4444" },
  blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#2563eb", light: "#dbeafe", bar: "#3b82f6" },
  violet: { bg: "#f5f3ff", border: "#ddd6fe", text: "#7c3aed", light: "#ede9fe", bar: "#8b5cf6" },
  amber: { bg: "#fffbeb", border: "#fde68a", text: "#d97706", light: "#fef3c7", bar: "#f59e0b" },
  cyan: { bg: "#ecfeff", border: "#a5f3fc", text: "#0891b2", light: "#cffafe", bar: "#06b6d4" },
  orange: { bg: "#fff7ed", border: "#fed7aa", text: "#ea580c", light: "#ffedd5", bar: "#f97316" },
};

/* ─── StatCard ───────────────────────────────────────────────── */
export function StatCard({ icon, label, value, sub, color = "emerald" }) {
  const c = C[color] || C.emerald;
  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 16,
      padding: "20px 18px", transition: "transform 0.15s, box-shadow 0.15s",
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 8px 24px ${c.border}40`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, background: c.light,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
        }}>{icon}</div>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
      </div>
      <p style={{ fontSize: 28, fontWeight: 900, color: "#0f172a", margin: 0, lineHeight: 1 }}>{value ?? "—"}</p>
      {sub && <p style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{sub}</p>}
    </div>
  );
}

/* ─── StatusBadge ────────────────────────────────────────────── */
const BADGE = {
  pending: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
  confirmed: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  admitted: { bg: "#ede9fe", text: "#5b21b6", border: "#c4b5fd" },
  discharged: { bg: "#d1fae5", text: "#065f46", border: "#6ee7b7" },
  cancelled: { bg: "#fee2e2", text: "#991b1b", border: "#fca5a5" },
  emergency: { bg: "#fee2e2", text: "#dc2626", border: "#fca5a5" },
  available: { bg: "#d1fae5", text: "#059669", border: "#6ee7b7" },
  dispatched: { bg: "#ffedd5", text: "#c2410c", border: "#fdba74" },
  en_route: { bg: "#dbeafe", text: "#1d4ed8", border: "#93c5fd" },
  arrived: { bg: "#ede9fe", text: "#6d28d9", border: "#c4b5fd" },
  completed: { bg: "#d1fae5", text: "#047857", border: "#6ee7b7" },
  accepted: { bg: "#dbeafe", text: "#1e40af", border: "#93c5fd" },
  maintenance: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
  offline: { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" },
};
export function StatusBadge({ status }) {
  if (!status) return null;
  const s = BADGE[status] || { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" };
  return (
    <span style={{
      display: "inline-flex", padding: "2px 10px", borderRadius: 20,
      fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.3px",
      background: s.bg, color: s.text, border: `1px solid ${s.border}`,
    }}>{status.replace(/_/g, " ")}</span>
  );
}

/* ─── SectionTitle ───────────────────────────────────────────── */
export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
      <h3 style={{ fontSize: 16, fontWeight: 800, color: "#1e293b", margin: 0 }}>{children}</h3>
      {action}
    </div>
  );
}

/* ─── EmptyState ─────────────────────────────────────────────── */
export function EmptyState({ icon, message }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "48px 24px", borderRadius: 16, background: "#f8fafc", border: "1px dashed #e2e8f0",
    }}>
      <span style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}>{icon}</span>
      <p style={{ color: "#94a3b8", fontSize: 14, fontWeight: 600, margin: 0 }}>{message}</p>
    </div>
  );
}

/* ─── LoadingSpinner ─────────────────────────────────────────── */
export function LoadingSpinner() {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "80px 0", flexDirection: "column", gap: 16,
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: "50%",
        border: "4px solid #e2e8f0", borderTopColor: "#10b981",
        animation: "spin 0.8s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Loading...</p>
    </div>
  );
}

/* ─── Card ───────────────────────────────────────────────────── */
export function Card({ children, className = "", style = {} }) {
  return (
    <div
      className={className}
      style={{
        background: "#ffffff", borderRadius: 16, padding: 20,
        border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        transition: "box-shadow 0.2s", ...style,
      }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.06)"}
      onMouseLeave={e => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)"}
    >
      {children}
    </div>
  );
}

/* ─── BedBar ─────────────────────────────────────────────────── */
export function BedBar({ label, available, total }) {
  if (!total) return null;
  const pct = Math.round(((total - (available || 0)) / total) * 100);
  const barColor = pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: barColor }}>{available}/{total}</span>
      </div>
      <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: barColor, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

/* ─── ProgressRing ───────────────────────────────────────────── */
export function ProgressRing({ label, value, max, icon, color = "emerald" }) {
  const c = C[color] || C.emerald;
  const pct = max ? Math.round((value / max) * 100) : 0;
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ position: "relative", width: 96, height: 96, margin: "0 auto 8px" }}>
        <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="48" cy="48" r={r} fill="none" stroke="#f1f5f9" strokeWidth="8" />
          <circle cx="48" cy="48" r={r} fill="none" stroke={c.bar} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={circ - (circ * pct / 100)}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.8s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column" }}>
          <span style={{ fontSize: 20 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: "#0f172a" }}>{pct}%</span>
        </div>
      </div>
      <p style={{ fontSize: 11, color: "#64748b", fontWeight: 700, margin: 0 }}>{label}</p>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>{value}/{max}</p>
    </div>
  );
}

/* ─── DashboardHeader ────────────────────────────────────────── */
export function DashboardHeader({ title, subtitle, badge, badgeColor = "emerald" }) {
  const c = C[badgeColor] || C.emerald;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>{title}</h1>
        {badge && (
          <span style={{
            padding: "3px 12px", borderRadius: 20, fontSize: 11, fontWeight: 800,
            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          }}>{badge}</span>
        )}
      </div>
      {subtitle && <p style={{ fontSize: 14, color: "#94a3b8", marginTop: 4, fontWeight: 500 }}>{subtitle}</p>}
    </div>
  );
}

/* ─── InfoRow ────────────────────────────────────────────────── */
export function InfoRow({ label, value, icon }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
      {icon && <span style={{ fontSize: 13 }}>{icon}</span>}
      <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>{label}:</span>
      <span style={{ fontSize: 12, color: "#475569", fontWeight: 700 }}>{value}</span>
    </div>
  );
}

/* ─── Divider ────────────────────────────────────────────────── */
export function Divider({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
      {label && <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>}
      <div style={{ flex: 1, height: 1, background: "#e2e8f0" }} />
    </div>
  );
}

/* ─── AlertBox ───────────────────────────────────────────────── */
export function AlertBox({ type = "info", children }) {
  const styles = {
    info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", icon: "ℹ️" },
    success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#065f46", icon: "✅" },
    warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "⚠️" },
    error: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: "❌" },
  }[type];
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
      borderRadius: 12, background: styles.bg, border: `1px solid ${styles.border}`,
      color: styles.text, fontSize: 13, fontWeight: 600,
    }}>
      <span>{styles.icon}</span> {children}
    </div>
  );
}