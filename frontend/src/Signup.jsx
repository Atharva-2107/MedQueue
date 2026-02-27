// src/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./signup.css";

const ROLES = [
  { id: "patient",        icon: "👤", label: "Patient",  desc: "Personal Care & Health History" },
  { id: "driver",         icon: "🚑", label: "Driver",   desc: "Emergency Dispatch & Telemetry" },
  { id: "hospital_staff", icon: "🏥", label: "Hospital", desc: "Bed Management & Resources" },
  { id: "admin",          icon: "🔑", label: "Admin",    desc: "System-wide Analytics & Control" },
];

export default function Signup() {
  const navigate = useNavigate();

  const [role,     setRole]     = useState("patient");
  const [fullName, setFullName] = useState("");
  const [email,    setEmail]    = useState("");
  const [phone,    setPhone]    = useState("");
  const [password, setPassword] = useState("");

  // Patient
  const [dob,         setDob]         = useState("");
  const [bloodGroup,  setBloodGroup]  = useState("");
  const [address,     setAddress]     = useState("");
  const [healthNotes, setHealthNotes] = useState("");

  // Driver
  const [drivingExp,  setDrivingExp]  = useState("");
  const [licenseNo,   setLicenseNo]   = useState("");
  const [ambulanceNo, setAmbulanceNo] = useState("");

  // Hospital
  const [hospitalName,    setHospitalName]    = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [staffStrength,   setStaffStrength]   = useState("");
  const [totalAmbs,       setTotalAmbs]       = useState("");
  const [landmark,        setLandmark]        = useState("");

  // Admin
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");

    // Client-side validation first
    if (!fullName.trim()) { setError("Please enter your full name."); return; }
    if (phone.length !== 10) { setError("Phone number must be exactly 10 digits."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);

    try {
      // ── 1. Create Supabase Auth user ─────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email:    email.trim().toLowerCase(),
        password: password,
        options: {
          data: {
            full_name:    fullName.trim(),
            phone_number: phone.trim(),
            user_role:    role,
          },
        },
      });

      if (authError) {
        // Common errors with friendly messages
        if (authError.message.includes("already registered")) {
          throw new Error("This email is already registered. Please log in instead.");
        }
        throw new Error(authError.message);
      }

      const userId = authData?.user?.id;
      if (!userId) throw new Error("Account creation failed. Please try again.");

      // ── 2. Write to public.users ─────────────────────────────
      // Try upsert — may fail if trigger already ran, that's fine
      await supabase.from("users").upsert({
        id:            userId,
        full_name:     fullName.trim(),
        email:         email.trim().toLowerCase(),
        phone:         phone.trim(),
        password_hash: "SUPABASE_AUTH",
        role:          role,
        is_active:     true,
      }, { onConflict: "id" });

      // ── 3. Write role-specific profile ──────────────────────
      if (role === "patient") {
        await supabase.from("patient_profiles").upsert({
          user_id:       userId,
          date_of_birth: dob        || null,
          blood_group:   bloodGroup || null,
          address:       address    || null,
          medical_notes: healthNotes || null,
          updated_at:    new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      if (role === "driver") {
        await supabase.from("driver_profiles").upsert({
          user_id:            userId,
          license_number:     licenseNo   || null,
          driving_experience: drivingExp  || null,
          ambulance_number:   ambulanceNo || null,
          is_profile_complete: !!(licenseNo && ambulanceNo),
        }, { onConflict: "user_id" });
      }

      if (role === "hospital_staff") {
        await supabase.from("hospital_profiles").upsert({
          user_id:          userId,
          hospital_name:    hospitalName    || null,
          hospital_address: hospitalAddress || null,
          staff_strength:   staffStrength ? parseInt(staffStrength) : null,
          total_ambulances: totalAmbs      ? parseInt(totalAmbs)    : null,
          nearest_landmark: landmark       || null,
          is_profile_complete: !!(hospitalName && hospitalAddress),
        }, { onConflict: "user_id" });
      }

      // ── 4. Navigate based on session state ──────────────────
      // session exists → email confirm is OFF → go to dashboard
      // session is null → email confirm is ON  → ask to verify
      if (authData?.session) {
        setSuccess("✅ Account created! Redirecting to dashboard...");
        navigate("/dashboard");
      } else {
        setSuccess("✅ Account created! Please check your email to verify your account, then log in.");
        setTimeout(() => navigate("/login"), 3500);
      }

    } catch (err) {
      console.error("Signup error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/dashboard` },
    });
    if (error) setError("Google sign-in failed: " + error.message);
  };

  const isValid = fullName.trim().length > 0 && email.trim().length > 0
    && phone.length === 10 && password.length >= 6;

  const currentRole = ROLES.find(r => r.id === role);

  return (
    <div className="signup-wrapper">
      <nav className="web-nav">
        <div className="nav-container">
          <div className="logo">Jeevan<span>Setu</span></div>
          <button className="login-btn-pill" onClick={() => navigate("/login")}>
            Login to Account
          </button>
        </div>
      </nav>

      <main className="main-content">
        <header className="hero-section">
          <span className="hero-badge">JeevanSetu — Health-Tech Ecosystem</span>
          <h1>Join the Network</h1>
          <p>Integrated Emergency Response & Healthcare Management</p>
        </header>

        {/* Role Tabs */}
        <div className="role-selection-area">
          <div className="role-nav-grid">
            {ROLES.map(r => (
              <div key={r.id} className={`role-tab ${role === r.id ? "active" : ""}`}
                onClick={() => { setRole(r.id); setError(""); }}>
                <div className="role-icon-wrapper">{r.icon}</div>
                <div className="role-tab-text"><h3>{r.label}</h3><p>{r.desc}</p></div>
              </div>
            ))}
          </div>
        </div>

        <section className="form-section">
          <div className="registration-card">
            <div className="card-header">
              <span className="form-badge">{currentRole?.icon} {role?.toUpperCase()} REGISTRATION</span>
              <h2>Registration Details</h2>
            </div>

            {error   && <div className="form-alert error">⚠️ {error}</div>}
            {success && <div className="form-alert success">{success}</div>}

            <form onSubmit={handleSignup} className="dynamic-form">

              {/* Always: Full Name */}
              <div className="form-input-grid">
                <div className="input-field full">
                  <label>Full Name *</label>
                  <input type="text" placeholder="Your legal full name"
                    value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
              </div>

              {/* Patient-specific */}
              {role === "patient" && (
                <div className="form-input-grid">
                  <div className="input-field">
                    <label>Date of Birth</label>
                    <input type="date" value={dob} onChange={e => setDob(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Blood Group</label>
                    <select value={bloodGroup} onChange={e => setBloodGroup(e.target.value)}>
                      <option value="">Select Group</option>
                      {["O+","O-","A+","A-","B+","B-","AB+","AB-"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                  <div className="input-field full">
                    <label>Address</label>
                    <input type="text" placeholder="Your full address"
                      value={address} onChange={e => setAddress(e.target.value)} />
                  </div>
                  <div className="input-field full">
                    <label>Health Notes (Optional)</label>
                    <textarea rows={3} placeholder="Known conditions, allergies, medications..."
                      value={healthNotes} onChange={e => setHealthNotes(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Driver-specific */}
              {role === "driver" && (
                <div className="form-input-grid">
                  <div className="input-field">
                    <label>Driving Experience</label>
                    <input type="text" placeholder="e.g. 5 years"
                      value={drivingExp} onChange={e => setDrivingExp(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>License Number</label>
                    <input type="text" placeholder="DL Number"
                      value={licenseNo} onChange={e => setLicenseNo(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Ambulance Vehicle No.</label>
                    <input type="text" placeholder="e.g. MH12AB1234"
                      value={ambulanceNo} onChange={e => setAmbulanceNo(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Hospital Staff-specific */}
              {role === "hospital_staff" && (
                <div className="form-input-grid">
                  <div className="input-field full">
                    <label>Hospital Name</label>
                    <input type="text" placeholder="Full hospital name"
                      value={hospitalName} onChange={e => setHospitalName(e.target.value)} />
                  </div>
                  <div className="input-field full">
                    <label>Hospital Address</label>
                    <input type="text" placeholder="Full address with city"
                      value={hospitalAddress} onChange={e => setHospitalAddress(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Staff Strength</label>
                    <input type="number" placeholder="Total staff count"
                      value={staffStrength} onChange={e => setStaffStrength(e.target.value)} />
                  </div>
                  <div className="input-field">
                    <label>Total Ambulances</label>
                    <input type="number" placeholder="Fleet size"
                      value={totalAmbs} onChange={e => setTotalAmbs(e.target.value)} />
                  </div>
                  <div className="input-field full">
                    <label>Nearest Landmark</label>
                    <input type="text" placeholder="Landmark for navigation"
                      value={landmark} onChange={e => setLandmark(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Admin-specific */}
              {role === "admin" && (
                <div className="form-input-grid">
                  <div className="input-field full">
                    <label>Assigned Department</label>
                    <input type="text" placeholder="e.g. Emergency Operations"
                      value={department} onChange={e => setDepartment(e.target.value)} />
                  </div>
                  <div className="input-field full">
                    <label>Employee ID</label>
                    <input type="text" placeholder="Official employee ID"
                      value={employeeId} onChange={e => setEmployeeId(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Security section */}
              <div className="security-divider">
                <div className="divider-line" />
                <h3>🔐 Security & Credentials</h3>
                <div className="divider-line" />
              </div>

              <div className="form-input-grid">
                <div className="input-field">
                  <label>Phone Number *</label>
                  <input type="tel" placeholder="10-digit mobile number" value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    required maxLength={10} />
                  {phone.length > 0 && phone.length !== 10 &&
                    <span className="field-hint">Must be exactly 10 digits ({phone.length}/10)</span>}
                </div>
                <div className="input-field">
                  <label>Email Address *</label>
                  <input type="email" placeholder="your@email.com" value={email}
                    onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="input-field">
                  <label>Password *</label>
                  <input type="password" placeholder="Min. 6 characters" value={password}
                    onChange={e => setPassword(e.target.value)} required minLength={6} />
                  {password.length > 0 && password.length < 6 &&
                    <span className="field-hint">Need {6 - password.length} more characters</span>}
                </div>
              </div>

              <button type="submit" className="submit-btn-premium"
                disabled={loading || !isValid}>
                {loading ? "Creating Account..." : `Register as ${currentRole?.label}`}
              </button>

              <button type="button" onClick={handleGoogle} className="google-btn" disabled={loading}>
                <span>G</span> Continue with Google
              </button>

              <p className="already-member">
                Already have an account?{" "}
                <span onClick={() => navigate("/login")} className="link-text">Log in here</span>
              </p>
            </form>
          </div>
        </section>
      </main>

      <footer className="centered-footer">
        <p>© 2026 <strong>JeevanSetu</strong> | Digital Healthcare Ecosystem</p>
        <div className="footer-links">
          <span>Privacy Policy</span> • <span>Terms of Service</span> • <span>Support</span>
        </div>
      </footer>
    </div>
  );
}