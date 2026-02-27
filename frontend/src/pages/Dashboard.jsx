// src/pages/Dashboard.jsx — Light mode wrapper
import React, { useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/dashboard/Sidebar";
import PatientDashboard from "../components/dashboard/PatientDashboard";
import AdminDashboard from "../components/dashboard/AdminDashboard";
import StaffDashboard from "../components/dashboard/StaffDashboard";
import DriverDashboard from "../components/dashboard/DriverDashboard";
import PatientOnboarding from "../components/onboarding/PatientOnboarding";
import DriverOnboarding from "../components/onboarding/DriverOnboarding";
import StaffOnboarding from "../components/onboarding/StaffOnboarding";

const LoadingScreen = () => (
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
    <p style={{ color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>Loading MedQueue...</p>
  </div>
);

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState("home");
  const skippedRef = useRef(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Redirect if not logged in
  if (!authLoading && !user) {
    navigate("/login", { replace: true });
    return null;
  }

  if (authLoading) return <LoadingScreen />;
  if (!user) return null;

  const handleSkip = () => { skippedRef.current = true; setShowOnboarding(false); };
  const handleComplete = () => { skippedRef.current = true; setShowOnboarding(false); };

  // Show onboarding if needed (only for first-time flag, kept simple)
  if (showOnboarding && !skippedRef.current) {
    if (user.role === "patient") return <PatientOnboarding onComplete={handleComplete} onSkip={handleSkip} />;
    if (user.role === "driver") return <DriverOnboarding onComplete={handleComplete} onSkip={handleSkip} />;
    if (user.role === "hospital_staff") return <StaffOnboarding onComplete={handleComplete} onSkip={handleSkip} />;
  }

  // Dashboard component map
  const DashboardComponent = {
    patient: PatientDashboard,
    admin: AdminDashboard,
    hospital_staff: StaffDashboard,
    driver: DriverDashboard,
  }[user.role];

  if (!DashboardComponent) {
    return (
      <div style={{
        minHeight: "100vh", background: "#f8fafc", display: "flex",
        alignItems: "center", justifyContent: "center", fontFamily: "sans-serif",
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "#ef4444", fontWeight: 700 }}>Unknown role: <strong>{user.role}</strong></p>
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Contact your administrator to fix your account role.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "flex", height: "100vh", background: "#f8fafc", overflow: "hidden",
      fontFamily: "'DM Sans', 'Inter', sans-serif",
    }}>
      <Sidebar role={user.role} activeSection={activeSection} onNavigate={setActiveSection} />
      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
          <DashboardComponent section={activeSection} />
        </div>
      </main>
    </div>
  );
}