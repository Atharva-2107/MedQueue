// src/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

const ProtectedRoute = ({ children }) => {
  // Get session, user profile (with role), and loading state from AuthProvider
  const { session, user, loading } = useAuth();

  // Show a loading screen while session + user profile are being fetched from DB
  if (loading || (session && !user)) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c12", color: "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: "12px"
      }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%",
          border: "3px solid rgba(255,255,255,0.1)",
          borderTopColor: "#34d399",
          animation: "spin 0.8s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.85rem", margin: 0 }}>
          Loading your dashboard...
        </p>
      </div>
    );
  }

  // No session → back to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Session + profile ready → render the dashboard
  return children;
};

export default ProtectedRoute;