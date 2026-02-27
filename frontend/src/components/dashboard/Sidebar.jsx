// src/components/dashboard/Sidebar.jsx
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
  patient: { label: "Patient", color: "text-emerald-400", dot: "bg-emerald-400", accent: "#34d399" },
  admin: { label: "System Admin", color: "text-violet-400", dot: "bg-violet-400", accent: "#a78bfa" },
  hospital_staff: { label: "Hospital Staff", color: "text-blue-400", dot: "bg-blue-400", accent: "#60a5fa" },
  driver: { label: "Ambulance Driver", color: "text-orange-400", dot: "bg-orange-400", accent: "#fb923c" },
};

export default function Sidebar({ role, activeSection, onNavigate }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = NAV_ITEMS[role] || [];
  const meta = ROLE_META[role] || { label: role, color: "text-white", dot: "bg-white", accent: "#fff" };

  return (
    <aside
      className={`relative flex flex-col h-screen border-r border-white/10 transition-all duration-300 ${collapsed ? "w-16" : "w-64"}`}
      style={{ background: "linear-gradient(180deg, #090e1a 0%, #080c12 100%)" }}
    >
      {/* Collapse Button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-20 w-6 h-6 rounded-full border border-white/20 bg-[#0d1220] text-white/50 hover:text-white flex items-center justify-center text-xs transition-colors"
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}
      >
        {collapsed ? "›" : "‹"}
      </button>

      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}>
        {/* MedQueue icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-black font-black text-sm"
          style={{ background: `linear-gradient(135deg, ${meta.accent}, ${meta.accent}99)`, boxShadow: `0 4px 12px ${meta.accent}40` }}
        >
          ✚
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-black text-sm tracking-tight leading-none">MedQueue</p>
            <p className={`text-xs font-semibold mt-0.5 ${meta.color}`}>{meta.label}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative group ${isActive
                  ? "text-white"
                  : "text-white/40 hover:text-white/80 hover:bg-white/5"
                } ${collapsed ? "justify-center" : ""}`}
              style={isActive ? {
                background: `linear-gradient(90deg, ${meta.accent}20, ${meta.accent}08)`,
                border: `1px solid ${meta.accent}30`,
              } : {}}
            >
              {/* Active left-bar accent */}
              {isActive && !collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: meta.accent }}
                />
              )}
              <span className="text-base flex-shrink-0">{item.icon}</span>
              {!collapsed && <span className="flex-1 text-left">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User card */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.accent}40, ${meta.accent}15)`, border: `1px solid ${meta.accent}30` }}
            >
              <span style={{ color: meta.accent }}>
                {user?.full_name?.[0]?.toUpperCase() || "?"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
              <p className="text-white/30 text-xs truncate">{user?.email}</p>
            </div>
            <button
              onClick={logout}
              title="Logout"
              className="text-white/30 hover:text-red-400 transition-colors text-base p-1 rounded-lg hover:bg-red-500/10"
            >
              ⎋
            </button>
          </div>
        ) : (
          <button
            onClick={logout}
            title="Logout"
            className="text-white/30 hover:text-red-400 transition-colors text-xl p-1 rounded-lg hover:bg-red-500/10"
          >
            ⎋
          </button>
        )}
      </div>
    </aside>
  );
}