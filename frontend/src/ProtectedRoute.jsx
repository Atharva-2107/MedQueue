// src/ProtectedRoute.jsx
// Simple and bulletproof — no timers, no grace periods.
// session === undefined → still initializing (show spinner)
// session === null      → confirmed no session (→ login)
// session exists + user exists → render children
// session exists + user null   → show spinner (profile loading)
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

const Spinner = () => (
  <div style={{
    minHeight: "100vh", background: "#080c12",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: 16,
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: "50%",
      border: "4px solid rgba(255,255,255,0.08)",
      borderTopColor: "#34d399",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "0.85rem", margin: 0 }}>
      ✚ MedQueue — Loading your dashboard...
    </p>
  </div>
);

export default function ProtectedRoute({ children }) {
  const { session, user, loading } = useAuth();

  // Still initializing Supabase session
  if (loading || session === undefined) return <Spinner />;

  // Confirmed: no active session → go to login
  if (!session) return <Navigate to="/login" replace />;

  // Session confirmed but profile still loading from DB
  if (!user) return <Spinner />;

  // All good
  return children;
}