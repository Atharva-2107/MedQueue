// // src/pages/Dashboard.jsx
// // ─────────────────────────────────────────────────────────────────
// //  Master dashboard — works with Supabase Auth session.
// //
// //  CHANGE FROM PREVIOUS VERSION:
// //   Before: checked localStorage JWT token
// //   Now:    reads user from AuthContext (populated by Supabase session)
// //
// //  ONBOARDING FLOW:
// //   Patient   → checks if blood_group + emergency_contact set in patient_profiles
// //   Driver    → checks driver_profiles.is_profile_complete
// //   Hospital  → checks hospital_profiles.is_profile_complete
// //   Admin     → no onboarding needed, goes straight to dashboard
// // ─────────────────────────────────────────────────────────────────
// import React, { useState, useEffect } from "react";
// import { useAuth } from "../hooks/useAuth";
// import { useNavigate } from "react-router-dom";
// import { supabase } from "../supabaseClient";
// import Sidebar          from "../components/dashboard/Sidebar";
// import PatientDashboard  from "../components/dashboard/PatientDashboard";
// import AdminDashboard    from "../components/dashboard/AdminDashboard";
// import StaffDashboard    from "../components/dashboard/StaffDashboard";
// import DriverDashboard   from "../components/dashboard/DriverDashboard";
// import PatientOnboarding from "../components/onboarding/PatientOnboarding";

// export default function Dashboard() {
//   const { user, loading: authLoading } = useAuth();
//   const navigate = useNavigate();

//   const [activeSection,    setActiveSection]    = useState("home");
//   const [showOnboarding,   setShowOnboarding]   = useState(false);
//   const [checkingProfile,  setCheckingProfile]  = useState(true);

//   // ── Redirect if not logged in ─────────────────────────────────
//   useEffect(() => {
//     if (!authLoading && !user) navigate("/login", { replace: true });
//   }, [user, authLoading]);

//   // ── Check if profile is complete ─────────────────────────────
//   useEffect(() => {
//     const checkProfile = async () => {
//       if (!user) { setCheckingProfile(false); return; }

//       try {
//         if (user.role === "patient") {
//           const { data } = await supabase
//             .from("patient_profiles")
//             .select("blood_group, gender, emergency_contact_phone")
//             .eq("user_id", user.id)
//             .maybeSingle();

//           // Show onboarding if core fields are missing
//           const isComplete = data?.blood_group && data?.gender && data?.emergency_contact_phone;
//           setShowOnboarding(!isComplete);

//         } else if (user.role === "driver") {
//           const { data } = await supabase
//             .from("driver_profiles")
//             .select("is_profile_complete")
//             .eq("user_id", user.id)
//             .maybeSingle();

//           setShowOnboarding(!data?.is_profile_complete);

//         } else if (user.role === "hospital_staff") {
//           const { data } = await supabase
//             .from("hospital_profiles")
//             .select("is_profile_complete")
//             .eq("user_id", user.id)
//             .maybeSingle();

//           setShowOnboarding(!data?.is_profile_complete);

//         } else {
//           // admin → no onboarding
//           setShowOnboarding(false);
//         }
//       } catch (err) {
//         console.warn("Profile check error:", err);
//         setShowOnboarding(false);
//       } finally {
//         setCheckingProfile(false);
//       }
//     };

//     if (user) checkProfile();
//   }, [user]);

//   // ── Loading screen ────────────────────────────────────────────
//   if (authLoading || checkingProfile) {
//     return (
//       <div style={{
//         minHeight: "100vh", background: "#080c12",
//         display: "flex", alignItems: "center", justifyContent: "center",
//         fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: "16px",
//       }}>
//         <div style={{
//           width: "48px", height: "48px", borderRadius: "50%",
//           border: "4px solid rgba(255,255,255,0.1)",
//           borderTopColor: "#34d399",
//           animation: "spin 0.8s linear infinite",
//         }} />
//         <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
//         <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>
//           Loading JeevanSetu...
//         </p>
//       </div>
//     );
//   }

//   if (!user) return null;

//   // ── Show onboarding for patients with incomplete profile ──────
//   if (showOnboarding && user.role === "patient") {
//     return <PatientOnboarding onComplete={() => setShowOnboarding(false)} />;
//   }

//   // ── Role → Dashboard component mapping ───────────────────────
//   const DashboardComponent = {
//     patient:        PatientDashboard,
//     admin:          AdminDashboard,
//     hospital_staff: StaffDashboard,
//     driver:         DriverDashboard,
//   }[user.role];

//   if (!DashboardComponent) {
//     return (
//       <div style={{
//         minHeight: "100vh", background: "#080c12",
//         display: "flex", alignItems: "center", justifyContent: "center",
//         color: "white", fontFamily: "sans-serif",
//       }}>
//         <div>
//           <p style={{ color: "#f87171" }}>Unknown role: <strong>{user.role}</strong></p>
//           <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
//             Contact your administrator to fix your account role.
//           </p>
//         </div>
//       </div>
//     );
//   }

//   // ── Main dashboard layout ─────────────────────────────────────
//   return (
//     <div
//       className="flex h-screen bg-[#080c12] overflow-hidden"
//       style={{ fontFamily: "'DM Sans', sans-serif" }}
//     >
//       {/* Ambient background glows */}
//       <div style={{
//         position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
//       }}>
//         <div style={{
//           position: "absolute", top: "-160px", left: "-160px",
//           width: "500px", height: "500px",
//           background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
//           borderRadius: "50%",
//         }} />
//         <div style={{
//           position: "absolute", bottom: "-100px", right: "-100px",
//           width: "400px", height: "400px",
//           background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)",
//           borderRadius: "50%",
//         }} />
//       </div>

//       {/* Sidebar */}
//       <Sidebar
//         role={user.role}
//         activeSection={activeSection}
//         onNavigate={setActiveSection}
//       />

//       {/* Main content area */}
//       <main style={{ flex: 1, overflowY: "auto" }}>
//         <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
//           <DashboardComponent section={activeSection} />
//         </div>
//       </main>
//     </div>
//   );
// }

// src/pages/Dashboard.jsx
// ─────────────────────────────────────────────────────────────────
//  Master dashboard — works with Supabase Auth session.
//
//  CHANGE FROM PREVIOUS VERSION:
//   Before: checked localStorage JWT token
//   Now:    reads user from AuthContext (populated by Supabase session)
//
//  ONBOARDING FLOW:
//   Patient   → checks if blood_group + emergency_contact set in patient_profiles
//   Driver    → checks driver_profiles.is_profile_complete
//   Hospital  → checks hospital_profiles.is_profile_complete
//   Admin     → no onboarding needed, goes straight to dashboard
// ─────────────────────────────────────────────────────────────────
import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Sidebar          from "../components/dashboard/Sidebar";
import PatientDashboard  from "../components/dashboard/PatientDashboard";
import AdminDashboard    from "../components/dashboard/AdminDashboard";
import StaffDashboard    from "../components/dashboard/StaffDashboard";
import DriverDashboard   from "../components/dashboard/DriverDashboard";
import PatientOnboarding from "../components/onboarding/PatientOnboarding";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [activeSection,    setActiveSection]    = useState("home");
  const [showOnboarding,   setShowOnboarding]   = useState(false);
  const [checkingProfile,  setCheckingProfile]  = useState(true);

  // ── Redirect if not logged in ─────────────────────────────────
  useEffect(() => {
    if (!authLoading && !user) navigate("/login", { replace: true });
  }, [user, authLoading]);

  // ── Check if profile is complete ─────────────────────────────
  useEffect(() => {
    const checkProfile = async () => {
      if (!user) { setCheckingProfile(false); return; }

      try {
        if (user.role === "patient") {
          const { data } = await supabase
            .from("patient_profiles")
            .select("blood_group, gender, emergency_contact_phone")
            .eq("user_id", user.id)
            .maybeSingle();

          // Show onboarding if core fields are missing
          const isComplete = data?.blood_group && data?.gender && data?.emergency_contact_phone;
          setShowOnboarding(!isComplete);

        } else if (user.role === "driver") {
          const { data } = await supabase
            .from("driver_profiles")
            .select("is_profile_complete")
            .eq("user_id", user.id)
            .maybeSingle();

          setShowOnboarding(!data?.is_profile_complete);

        } else if (user.role === "hospital_staff") {
          const { data } = await supabase
            .from("hospital_profiles")
            .select("is_profile_complete")
            .eq("user_id", user.id)
            .maybeSingle();

          setShowOnboarding(!data?.is_profile_complete);

        } else {
          // admin → no onboarding
          setShowOnboarding(false);
        }
      } catch (err) {
        console.warn("Profile check error:", err);
        setShowOnboarding(false);
      } finally {
        setCheckingProfile(false);
      }
    };

    if (user) checkProfile();
  }, [user]);

  // ── Loading screen ────────────────────────────────────────────
  if (authLoading || checkingProfile) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c12",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'DM Sans', sans-serif", flexDirection: "column", gap: "16px",
      }}>
        <div style={{
          width: "48px", height: "48px", borderRadius: "50%",
          border: "4px solid rgba(255,255,255,0.1)",
          borderTopColor: "#34d399",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.9rem" }}>
          Loading JeevanSetu...
        </p>
      </div>
    );
  }

  if (!user) return null;

  // ── Show onboarding for patients with incomplete profile ──────
  if (showOnboarding && user.role === "patient") {
    return <PatientOnboarding onComplete={() => setShowOnboarding(false)} />;
  }

  // ── Role → Dashboard component mapping ───────────────────────
  const DashboardComponent = {
    patient:        PatientDashboard,
    admin:          AdminDashboard,
    hospital_staff: StaffDashboard,
    driver:         DriverDashboard,
  }[user.role];

  if (!DashboardComponent) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c12",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "white", fontFamily: "sans-serif",
      }}>
        <div>
          <p style={{ color: "#f87171" }}>Unknown role: <strong>{user.role}</strong></p>
          <p style={{ color: "#6b7280", fontSize: "0.85rem" }}>
            Contact your administrator to fix your account role.
          </p>
        </div>
      </div>
    );
  }

  // ── Main dashboard layout ─────────────────────────────────────
  return (
    <div
      className="flex h-screen bg-[#080c12] overflow-hidden"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* Ambient background glows */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-160px", left: "-160px",
          width: "500px", height: "500px",
          background: "radial-gradient(circle, rgba(52,211,153,0.06) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
        <div style={{
          position: "absolute", bottom: "-100px", right: "-100px",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(59,130,246,0.05) 0%, transparent 70%)",
          borderRadius: "50%",
        }} />
      </div>

      {/* Sidebar */}
      <Sidebar
        role={user.role}
        activeSection={activeSection}
        onNavigate={setActiveSection}
      />

      {/* Main content area */}
      <main style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>
          <DashboardComponent section={activeSection} />
        </div>
      </main>
    </div>
  );
}