// src/Signup.jsx — Fixed with manual users upsert safety net
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./hooks/useAuth";
import "./signup.css";

const ROLES = [
  { id: "patient", icon: "👤", label: "Patient", desc: "Personal Care & Health History" },
  { id: "driver", icon: "🚑", label: "Driver", desc: "Emergency Dispatch & Telemetry" },
  { id: "hospital_staff", icon: "🏥", label: "Hospital", desc: "Bed Management & Resources" },
  { id: "admin", icon: "🔑", label: "Admin", desc: "System-wide Analytics & Control" },
];

export default function Signup() {
  const navigate = useNavigate();
  const { loadUserProfile } = useAuth();

  const [role, setRole] = useState("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [ambulanceNo, setAmbulanceNo] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [landmark, setLandmark] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    if (!fullName.trim()) return setError("Please enter your full name.");
    if (phone.length !== 10) return setError("Phone number must be exactly 10 digits.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (!email.trim()) return setError("Please enter a valid email address.");

    setLoading(true);

    try {
      // ── 1. Auth signup ──────────────────────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone_number: phone.trim(),
            user_role: role,
          },
        },
      });

      if (authError) {
        if (authError.message.includes("already registered") || authError.message.includes("already exists")) {
          throw new Error("This email is already registered. Please log in instead.");
        }
        throw new Error(authError.message);
      }

      const userId = authData?.user?.id;
      if (!userId) throw new Error("Signup failed to return a user ID. Please try again.");

      // ── 2. Auto login to get session ────────────────────────────
      const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        // Account created but Supabase requires email confirmation
        setSuccess("Account created! Please check your email to confirm, then log in.");
        setTimeout(() => navigate("/login"), 3000);
        setLoading(false);
        return;
      }

      // ── 3. Manually upsert users row (safety net if trigger failed) ──
      // Trigger should have done this, but if it failed we ensure the row exists.
      const { error: upsertErr } = await supabase.from("users").upsert({
        id: userId,
        full_name: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        role,
        is_active: true,
      }, { onConflict: "id" });

      if (upsertErr) {
        // Not fatal — trigger may have already created the row
        console.warn("[signup] users upsert warning:", upsertErr.message);
      }

      // ── 4. Role-specific profile tables ─────────────────────────
      if (role === "patient") {
        const { error: pe } = await supabase.from("patient_profiles").upsert({
          user_id: userId,
          date_of_birth: dob || null,
          blood_group: bloodGroup || null,
          address: address || null,
          medical_notes: healthNotes || null,
        }, { onConflict: "user_id" });
        if (pe) console.warn("[signup] patient_profiles:", pe.message);
      } else if (role === "hospital_staff") {
        const { error: se } = await supabase.from("staff_profiles").upsert({
          user_id: userId,
          department: department || null,
          employee_id: employeeId || null,
          is_profile_complete: false,
        }, { onConflict: "user_id" });
        if (se) console.warn("[signup] staff_profiles:", se.message);
      }
      // driver / admin: profile completed via onboarding after login

      // ── 5. Load profile into context + navigate ──────────────────
      await loadUserProfile(loginData.user.id);
      setSuccess("✅ Account created successfully!");
      navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error("[signup] error:", err.message);
      setError(err.message || "Signup failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isValid = fullName.trim() && email.trim() && phone.length === 10 && password.length >= 6;
  const currentRole = ROLES.find((r) => r.id === role);

  return (
    <div className="signup-wrapper">
      <nav className="web-nav">
        <div className="nav-container">
          <div className="logo">Med<span>Queue</span></div>
          <button className="login-btn-pill" onClick={() => navigate("/login")}>
            Login to Account
          </button>
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
              <div key={r.id} className={`role-tab ${role === r.id ? "active" : ""}`} onClick={() => setRole(r.id)}>
                <div className="role-icon-wrapper">{r.icon}</div>
                <div className="role-tab-text">
                  <h3>{r.label}</h3>
                  <p>{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Form Section */}
        <section className="form-section">
          <div className="registration-card">
            <div className="card-header">
              <span className="form-badge">{currentRole?.icon} {role?.toUpperCase()} REGISTRATION</span>
              <h2>Registration Details</h2>
            </div>

            {error && <div className="form-alert error">⚠️ {error}</div>}
            {success && <div className="form-alert success">{success}</div>}

            <form onSubmit={handleSignup} className="dynamic-form">
              <div className="form-input-grid">
                <div className="input-field full">
                  <label>Full Name *</label>
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
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
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="input-field">
                  <label>Password *</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required />
                </div>
              </div>

              {/* Dynamic Role Fields */}
              <div className="role-specific-fields">
                {role === "patient" && (
                  <div className="form-input-grid">
                    <div className="input-field"><label>Date of Birth</label><input type="date" onChange={(e) => setDob(e.target.value)} /></div>
                    <div className="input-field"><label>Blood Group</label><input type="text" placeholder="e.g. O+" onChange={(e) => setBloodGroup(e.target.value)} /></div>
                    <div className="input-field full"><label>Address</label><input type="text" onChange={(e) => setAddress(e.target.value)} /></div>
                  </div>
                )}
                {role === "driver" && (
                  <div className="form-input-grid">
                    <div className="input-field"><label>License No.</label><input type="text" onChange={(e) => setLicenseNo(e.target.value)} /></div>
                    <div className="input-field"><label>Ambulance No.</label><input type="text" onChange={(e) => setAmbulanceNo(e.target.value)} /></div>
                  </div>
                )}
                {role === "hospital_staff" && (
                  <div className="form-input-grid">
                    <div className="input-field full"><label>Hospital Name</label><input type="text" onChange={(e) => setHospitalName(e.target.value)} /></div>
                    <div className="input-field"><label>Department</label><input type="text" onChange={(e) => setDepartment(e.target.value)} /></div>
                    <div className="input-field"><label>Employee ID</label><input type="text" onChange={(e) => setEmployeeId(e.target.value)} /></div>
                  </div>
                )}
                {role === "admin" && (
                  <div className="form-input-grid">
                    <div className="input-field"><label>Department</label><input type="text" onChange={(e) => setDepartment(e.target.value)} /></div>
                    <div className="input-field"><label>Employee ID</label><input type="text" onChange={(e) => setEmployeeId(e.target.value)} /></div>
                  </div>
                )}
              </div>

              <button className="submit-btn" disabled={loading || !isValid}>
                {loading ? "Creating Account..." : "Create Account"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}