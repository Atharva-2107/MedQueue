// src/ProtectedRoute.jsx — Light mode
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

const Spinner = () => (
  <div style={{
    minHeight: "100vh", background: "#f8fafc",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: 16,
  }}>
    <div style={{
      width: 44, height: 44, borderRadius: "50%",
      border: "4px solid #e2e8f0", borderTopColor: "#10b981",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600, margin: 0 }}>
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