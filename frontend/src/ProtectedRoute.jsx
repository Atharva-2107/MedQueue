import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "./supabaseClient";

const ProtectedRoute = ({ children }) => {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for an existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth events (like logging in or out)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => subscription.unsubscribe();
  }, []);

  // Show a loading state while checking auth
  if (loading) {
    return <div className="loading-screen">Verifying access...</div>;
  }

  // Kick unauthorized users back to login
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  // Allow access
  return children;
};

export default ProtectedRoute;