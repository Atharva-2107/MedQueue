// src/components/dashboard/Sidebar.jsx — Light mode
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const NAV_ITEMS = {
  patient: [
    { label: "Dashboard", icon: "⚡", id: "home" },
    { label: "My Health", icon: "🩺", id: "health" },
    { label: "Book a Bed", icon: "🛏️", id: "book" },
    { label: "Ambulance", icon: "🚑", id: "ambulance" },
    { label: "Hospitals", icon: "🏥", id: "hospitals" },
    { label: "My Bookings", icon: "📋", id: "bookings" },
  ],
  admin: [
    { label: "Overview", icon: "📊", id: "home" },
    { label: "Hospitals", icon: "🏥", id: "hospitals" },
    { label: "Bed Management", icon: "🛏️", id: "beds" },
    { label: "Ambulances", icon: "🚑", id: "ambulances" },
    { label: "Patients", icon: "👥", id: "patients" },
    { label: "Dispatches", icon: "📡", id: "dispatches" },
    { label: "All Bookings", icon: "📋", id: "bookings" },
    { label: "Analytics", icon: "📈", id: "analytics" },
  ],
  hospital_staff: [
    { label: "Dashboard", icon: "⚡", id: "home" },
    { label: "Bed Map", icon: "🛏️", id: "bedmap" },
    { label: "Bookings", icon: "📋", id: "bookings" },
    { label: "Admitted", icon: "🏨", id: "admitted" },
    { label: "OPD Queue", icon: "🧑‍⚕️", id: "opd" },
  ],
  driver: [
    { label: "Dashboard", icon: "⚡", id: "home" },
    { label: "My Ambulance", icon: "🚑", id: "ambulance" },
    { label: "Dispatch Log", icon: "📡", id: "dispatches" },
  ],
};

const ROLE_META = {
  patient: { label: "Patient", accent: "#10b981" },
  admin: { label: "System Admin", accent: "#8b5cf6" },
  hospital_staff: { label: "Hospital Staff", accent: "#3b82f6" },
  driver: { label: "Ambulance Driver", accent: "#f97316" },
};

export default function Sidebar({ role, activeSection, onNavigate }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = NAV_ITEMS[role] || [];
  const meta = ROLE_META[role] || { label: role, accent: "#64748b" };

  return (
    <aside style={{
      display: "flex", flexDirection: "column", height: "100vh",
      width: collapsed ? 64 : 256, transition: "width 0.3s ease",
      background: "#ffffff", borderRight: "1px solid #e2e8f0",
      fontFamily: "'DM Sans', 'Inter', sans-serif", position: "relative", flexShrink: 0,
    }}>
      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          position: "absolute", right: -12, top: 24, zIndex: 20,
          width: 24, height: 24, borderRadius: "50%", border: "1px solid #e2e8f0",
          background: "#fff", color: "#94a3b8", fontSize: 12, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {/* Logo area */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: collapsed ? "20px 12px" : "20px 20px",
        borderBottom: "1px solid #f1f5f9",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: meta.accent, display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 14,
          boxShadow: `0 3px 10px ${meta.accent}40`,
        }}>✚</div>
        {!collapsed && (
          <div>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#0f172a", lineHeight: 1 }}>MedQueue</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, fontWeight: 600, color: meta.accent }}>{meta.label}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: "16px 8px", overflowY: "auto" }}>
        {navItems.map(item => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                gap: 12, padding: collapsed ? "10px 0" : "10px 14px",
                borderRadius: 12, border: "none", cursor: "pointer",
                marginBottom: 2, fontSize: 13, fontWeight: isActive ? 700 : 500,
                transition: "all 0.15s",
                justifyContent: collapsed ? "center" : "flex-start",
                background: isActive ? `${meta.accent}10` : "transparent",
                color: isActive ? meta.accent : "#64748b",
                borderLeft: isActive && !collapsed ? `3px solid ${meta.accent}` : "3px solid transparent",
              }}
              onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
              onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div style={{ borderTop: "1px solid #f1f5f9", padding: collapsed ? "12px 8px" : "12px 16px" }}>
        {!collapsed ? (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
              background: `${meta.accent}15`, border: `1px solid ${meta.accent}30`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 900, color: meta.accent,
            }}>
              {user?.full_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.full_name}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "#94a3b8", fontSize: 16, padding: 4, borderRadius: 8,
                transition: "color 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
              onMouseLeave={e => e.currentTarget.style.color = "#94a3b8"}
            >⎋</button>
          </div>
        ) : (
          <button
            onClick={logout} title="Logout"
            style={{
              width: "100%", background: "none", border: "none",
              cursor: "pointer", color: "#94a3b8", fontSize: 18, padding: 4,
            }}
          >⎋</button>
        )}
      </div>
    </aside>
  );
}