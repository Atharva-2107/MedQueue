// src/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";

const ProtectedRoute = ({ children }) => {
  // 1. Get the session and loading state directly from your global AuthProvider
  const { session, loading } = useAuth();

  // 2. Show a loading state while useAuth is fetching the DB profile
  if (loading) {
    return (
      <div style={{ 
        minHeight: "100vh", background: "#080c12", color: "white", 
        display: "flex", alignItems: "center", justifyContent: "center" 
      }}>
        Verifying access...
      </div>
    );
  }

  // 3. Kick unauthorized users back to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // 4. Allow access to the dashboard
  return children;
};

export default ProtectedRoute;