// src/pages/Dashboard.jsx
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
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
    minHeight: "100vh", background: "#080c12",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: 16,
  }}>
    <div style={{
      width: 48, height: 48, borderRadius: "50%",
      border: "4px solid rgba(255,255,255,0.1)", borderTopColor: "#34d399",
      animation: "spin 0.8s linear infinite",
    }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>Loading MedQueue...</p>
  </div>
);

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeSection, setActiveSection] = useState("home");
  const [showOnboarding, setShowOnboarding] = useState(null); // null = checking
  const [checkingProfile, setCheckingProfile] = useState(true);

  // "skipped" flag: once user hits Skip this session, never show onboarding again
  const skippedRef = useRef(false);

  // ── Redirect if not logged in ─────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [user, authLoading, navigate]);

  // ── Check if profile needs onboarding ─────────────────────────
  useEffect(() => {
    // Don't re-check if user already skipped this session
    if (skippedRef.current) {
      setShowOnboarding(false);
      setCheckingProfile(false);
      return;
    }

    const checkProfile = async () => {
      if (!user) { setCheckingProfile(false); return; }
      try {
        let needsOnboarding = false;

        switch (user.role) {
          case "patient": {
            const { data } = await supabase
              .from("patient_profiles")
              .select("blood_group, address")
              .eq("user_id", user.id)
              .maybeSingle();
            needsOnboarding = !(data?.blood_group && data?.address);
            break;
          }
          case "driver": {
            const { data } = await supabase
              .from("ambulances")
              .select("id")
              .eq("driver_id", user.id)
              .maybeSingle();
            needsOnboarding = !data?.id;
            break;
          }
          case "hospital_staff": {
            // Safe: hospital_id is now included in user profile
            needsOnboarding = !user.hospital_id;
            break;
          }
          default:
            needsOnboarding = false;
        }

        setShowOnboarding(needsOnboarding);
      } catch {
        setShowOnboarding(false); // any error → go to dashboard
      } finally {
        setCheckingProfile(false);
      }
    };

    if (user) checkProfile();
  }, [user]);

  // Called when user clicks "Skip for now" in any onboarding
  const handleOnboardingSkip = () => {
    skippedRef.current = true;  // permanent for this session
    setShowOnboarding(false);
  };

  // Called when user completes onboarding by submitting
  const handleOnboardingComplete = () => {
    skippedRef.current = true;  // also mark as done
    setShowOnboarding(false);
  };

  if (authLoading || checkingProfile) return <LoadingScreen />;
  if (!user) return null;

  // ── Onboarding routing by role ────────────────────────────────
  if (showOnboarding === true) {
    if (user.role === "patient") return <PatientOnboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
    if (user.role === "driver") return <DriverOnboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
    if (user.role === "hospital_staff") return <StaffOnboarding onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />;
  }

  // ── Dashboard component map ───────────────────────────────────
  const DashboardComponent = {
    patient: PatientDashboard,
    admin: AdminDashboard,
    hospital_staff: StaffDashboard,
    driver: DriverDashboard,
  }[user.role];

  if (!DashboardComponent) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c12", display: "flex",
        alignItems: "center", justifyContent: "center", color: "white", fontFamily: "sans-serif"
      }}>
        <div>
          <p style={{ color: "#f87171" }}>Unknown role: <strong>{user.role}</strong></p>
          <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>Contact your administrator to fix your account role.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#080c12] overflow-hidden" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{
          position: "absolute", top: -160, left: -160, width: 500, height: 500,
          background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)", borderRadius: "50%"
        }} />
        <div style={{
          position: "absolute", bottom: -100, right: -100, width: 400, height: 400,
          background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)", borderRadius: "50%"
        }} />
      </div>

      <Sidebar role={user.role} activeSection={activeSection} onNavigate={setActiveSection} />

      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
          <DashboardComponent section={activeSection} />
        </div>
      </main>
    </div>
  );
}