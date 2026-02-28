// src/Signup.jsx — Clean role-specific signup
// Patient: name+email+phone+password only (health data in onboarding)
// Driver: + license + vehicle number → ambulance registered in DB
// Hospital Staff: name+email+phone+password only (hospital linked via GPS after login)
// Admin (Hospital Admin): same as staff (hospital linked via GPS after login)
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./hooks/useAuth";
import "./signup.css";

const ROLES = [
  {
    id: "patient",
    icon: "👤",
    label: "Patient",
    desc: "Personal care & health bookings",
    hint: "Your health profile is completed after signup via a guided setup.",
  },
  {
    id: "hospital_staff",
    icon: "🏥",
    label: "Hospital Staff",
    desc: "Bed management & patient intake",
    hint: "You'll select your hospital via GPS on your first login.",
  },
  {
    id: "admin",
    icon: "🔑",
    label: "Hospital Admin",
    desc: "Hospital analytics & full control",
    hint: "Hospital Admin — elevated access at your linked hospital. Hospital selected via GPS after signup.",
  },
  {
    id: "driver",
    icon: "🚑",
    label: "Ambulance Driver",
    desc: "Emergency dispatch & live tracking",
    hint: "Your ambulance is registered now. You'll receive SOS requests in real-time.",
  },
];

export default function Signup() {
  const navigate = useNavigate();
  const { loadUserProfile } = useAuth();

  const [role, setRole] = useState("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Driver-only fields
  const [licenseNo, setLicenseNo] = useState("");
  const [vehicleNo, setVehicleNo] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);

  const currentRole = ROLES.find((r) => r.id === role);
  const isValid = fullName.trim() && email.trim() && phone.length === 10 && password.length >= 6;

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!fullName.trim()) return setError("Please enter your full name.");
    if (phone.length !== 10) return setError("Phone number must be exactly 10 digits.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!email.trim()) return setError("Please enter a valid email address.");
    if (role === "driver" && !vehicleNo.trim()) return setError("Please enter your vehicle/ambulance number.");

    setLoading(true);
    try {
      // 1. Create auth account
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: fullName.trim(), phone_number: phone.trim(), user_role: role },
        },
      });
      if (authError) {
        if (authError.message.includes("already registered") || authError.message.includes("already exists"))
          throw new Error("This email is already registered. Please log in instead.");
        throw new Error(authError.message);
      }
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Signup failed to return a user ID. Please try again.");

      // 2. Auto sign-in
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      });
      if (loginError) {
        setSuccess("Account created! Please check your email to confirm, then log in.");
        setTimeout(() => navigate("/login"), 3000);
        setLoading(false);
        return;
      }

      // 3. Ensure users row exists (safety net if DB trigger failed)
      await supabase.from("users").upsert({
        id: userId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        is_active: true,
      }, { onConflict: "id" });

      // 4. Role-specific setup
      if (role === "patient") {
        // Minimal patient_profiles seed — health info filled via onboarding
        await supabase.from("patient_profiles").upsert(
          { user_id: userId }, { onConflict: "user_id" }
        );

      } else if (role === "driver") {
        // Register ambulance immediately with vehicle number
        const { error: ambErr } = await supabase.from("ambulances").insert({
          driver_id: userId,
          vehicle_number: vehicleNo.trim().toUpperCase(),
          license_number: licenseNo.trim() || null,
          status: "available",
        });
        if (ambErr) console.warn("[signup] ambulance insert:", ambErr.message);
      }
      // hospital_staff + admin: hospital linked via StaffHospitalSelector after first login
      // No extra profile data needed at signup time

      // 5. Load into context + redirect
      await loadUserProfile(loginData.user.id);
      setSuccess("✅ Account created!");
      navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error("[signup]", err.message);
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-wrapper">
      <nav className="web-nav">
        <div className="nav-container">
          <div className="logo">Med<span>Queue</span></div>
          <button className="login-btn-pill" onClick={() => navigate("/login")}>Login to Account</button>
        </div>
      </nav>

      <main className="main-content">
        <header className="hero-section">
          <span className="hero-badge">MedQueue — Health-Tech Ecosystem</span>
          <h1>Join the Network</h1>
          <p>Integrated Emergency Response &amp; Healthcare Management</p>
        </header>

        {/* Role Selector */}
        <div className="role-selection-area">
          <div className="role-nav-grid">
            {ROLES.map((r) => (
              <div
                key={r.id}
                className={`role-tab ${role === r.id ? "active" : ""}`}
                onClick={() => { setRole(r.id); setError(""); }}
              >
                <div className="role-icon-wrapper">{r.icon}</div>
                <div className="role-tab-text">
                  <h3>{r.label}</h3>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Role hint */}
          {currentRole?.hint && (
            <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flexShrink: 0 }}>ℹ️</span>
              <span>{currentRole.hint}</span>
            </div>
          )}
        </div>

        {/* Form */}
        <section className="form-section">
          <div className="registration-card">
            <div className="card-header">
              <span className="form-badge">{currentRole?.icon} {currentRole?.label?.toUpperCase()} REGISTRATION</span>
              <h2>Registration Details</h2>
            </div>

            {error && <div className="form-alert error">⚠️ {error}</div>}
            {success && <div className="form-alert success">{success}</div>}

            <form onSubmit={handleSignup} className="dynamic-form">
              {/* ── Common fields for ALL roles ── */}
              <div className="form-input-grid">
                <div className="input-field full">
                  <label>Full Name *</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" required />
                </div>
                <div className="input-field">
                  <label>Phone Number *</label>
                  <input
                    type="tel" value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit number" required
                  />
                </div>
                <div className="input-field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                <div className="input-field" style={{ position: "relative" }}>
                  <label>Password *</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 6 characters" required
                    style={{ paddingRight: 44 }}
                  />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: "absolute", right: 12, bottom: 11, background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8" }}>{showPass ? "🙈" : "👁️"}</button>
                </div>
              </div>

              {/* ── Driver-only: vehicle details ── */}
              {role === "driver" && (
                <div className="form-input-grid" style={{ marginTop: 8 }}>
                  <div style={{ gridColumn: "1/-1", borderTop: "1px solid #f1f5f9", paddingTop: 12, marginBottom: 4 }}>
                    <p style={{ fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>🚑 Ambulance Details</p>
                  </div>
                  <div className="input-field">
                    <label>Vehicle / Ambulance No. *</label>
                    <input type="text" value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="e.g. MH12AB1234" required />
                  </div>
                  <div className="input-field">
                    <label>License No. (optional)</label>
                    <input type="text" value={licenseNo} onChange={(e) => setLicenseNo(e.target.value)} placeholder="Driver license number" />
                  </div>
                </div>
              )}

              {/* ── Staff/Admin: what happens next ── */}
              {(role === "hospital_staff" || role === "admin") && (
                <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#059669", margin: "0 0 4px" }}>📍 After Registration</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
                    You'll be shown a GPS-based hospital picker on your first dashboard login.
                    Select the hospital you work at — all patient bookings from that hospital will then appear on your dashboard in real-time.
                  </p>
                </div>
              )}

              {/* ── Patient: onboarding nudge ── */}
              {role === "patient" && (
                <div style={{ marginTop: 8, padding: "12px 16px", borderRadius: 12, background: "#eff6ff", border: "1px solid #bfdbfe" }}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#1e40af", margin: "0 0 4px" }}>🩺 Health Profile Setup</p>
                  <p style={{ fontSize: 12, color: "#475569", margin: 0 }}>
                    After signing up, a guided 4-step onboarding will let you add blood group, allergies, emergency contacts, and documents at your own pace.
                  </p>
                </div>
              )}

              <button className="submit-btn" type="submit" disabled={loading || !isValid}>
                {loading ? "Creating Account…" : `Create ${currentRole?.label} Account`}
              </button>
            </form>

            <p style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginTop: 16 }}>
              Already have an account?{" "}
              <span style={{ color: "#10b981", fontWeight: 700, cursor: "pointer" }} onClick={() => navigate("/login")}>Log in here</span>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}