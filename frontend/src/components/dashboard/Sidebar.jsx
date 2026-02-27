// src/components/dashboard/Sidebar.jsx
import React, { useState } from "react";
import { useAuth } from "../../hooks/useAuth";

const NAV_ITEMS = {
  patient: [
    { label: "Dashboard",      icon: "⚡", id: "home" },
    { label: "My Health",      icon: "🩺", id: "health" },
    { label: "Book a Bed",     icon: "🛏️", id: "book" },
    { label: "Ambulance",      icon: "🚑", id: "ambulance" },
    { label: "Hospitals",      icon: "🏥", id: "hospitals" },
    { label: "My Bookings",    icon: "📋", id: "bookings" },
  ],
  admin: [
    { label: "Overview",       icon: "📊", id: "home" },
    { label: "Hospitals",      icon: "🏥", id: "hospitals" },
    { label: "Bed Management", icon: "🛏️", id: "beds" },
    { label: "Ambulances",     icon: "🚑", id: "ambulances" },
    { label: "Patients",       icon: "👥", id: "patients" },
    { label: "Dispatches",     icon: "📡", id: "dispatches" },
    { label: "Analytics",      icon: "📈", id: "analytics" },
  ],
  hospital_staff: [
    { label: "Dashboard",      icon: "⚡", id: "home" },
    { label: "Bed Map",        icon: "🛏️", id: "bedmap" },
    { label: "Bookings",       icon: "📋", id: "bookings" },
    { label: "Admitted",       icon: "🏨", id: "admitted" },
    { label: "OPD Queue",      icon: "🧑‍⚕️", id: "opd" },
  ],
  driver: [
    { label: "Dashboard",      icon: "⚡", id: "home" },
    { label: "My Ambulance",   icon: "🚑", id: "ambulance" },
    { label: "Dispatch Log",   icon: "📡", id: "dispatches" },
  ],
};

export default function Sidebar({ role, activeSection, onNavigate }) {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = NAV_ITEMS[role] || [];

  const roleLabel = {
    patient:        "Patient",
    admin:          "System Admin",
    hospital_staff: "Hospital Staff",
    driver:         "Ambulance Driver",
  }[role] || role;

  const roleColor = {
    patient:        "text-emerald-400",
    admin:          "text-violet-400",
    hospital_staff: "text-blue-400",
    driver:         "text-orange-400",
  }[role] || "text-white";

  return (
    <aside className={`relative flex flex-col h-screen border-r border-white/10 bg-[#0a0f1a] transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Collapse button */}
      <button onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-6 z-10 w-6 h-6 rounded-full border border-white/20 bg-[#0a0f1a] text-white/60 hover:text-white flex items-center justify-center text-xs">
        {collapsed ? "›" : "‹"}
      </button>

      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-5 border-b border-white/10 ${collapsed ? "justify-center" : ""}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-sm font-black text-black flex-shrink-0">
          J
        </div>
        {!collapsed && (
          <div>
            <p className="text-white font-black text-sm tracking-tight">JeevanSetu</p>
            <p className={`text-xs font-semibold ${roleColor}`}>{roleLabel}</p>
          </div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <button key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
              activeSection === item.id
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                : "text-white/40 hover:text-white/80 hover:bg-white/5"
            } ${collapsed ? "justify-center" : ""}`}>
            <span className="text-base flex-shrink-0">{item.icon}</span>
            {!collapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* User card at bottom */}
      <div className={`border-t border-white/10 p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/20 flex items-center justify-center text-sm flex-shrink-0">
              {user?.full_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
              <p className="text-white/30 text-xs truncate">{user?.email}</p>
            </div>
            <button onClick={logout} title="Logout"
              className="text-white/30 hover:text-red-400 transition-colors text-base">⎋</button>
          </div>
        ) : (
          <button onClick={logout} title="Logout"
            className="text-white/30 hover:text-red-400 transition-colors text-xl">⎋</button>
        )}
      </div>
    </aside>
  );
}