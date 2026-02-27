// src/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import { useAuth } from "./hooks/useAuth";
import "./login.css";

const ROLES = [
  { id: "patient", label: "Patient", desc: "Access Healthcare" },
  { id: "driver", label: "Driver", desc: "Emergency Transit" },
  { id: "admin", label: "Admin", desc: "System Control" },
  { id: "hospital_staff", label: "Hospital", desc: "Facility Management" },
];

export default function Login() {
  const navigate = useNavigate();
  const { loadUserProfile } = useAuth();

  const [role, setRole] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);

    try {
      let emailToUse = identifier.trim().toLowerCase();

      // ── If phone number entered, look up the email first ─────
      const isPhone = /^\d{10}$/.test(emailToUse);
      if (isPhone) {
        const { data: userRow, error: lookupErr } = await supabase
          .from("users")
          .select("email, role")
          .eq("phone", identifier.trim())
          .maybeSingle();

        if (lookupErr || !userRow) {
          throw new Error("No account found with this phone number. Try logging in with your email.");
        }
        emailToUse = userRow.email;

        // Verify role matches if selected
        if (role && userRow.role !== role) {
          throw new Error(`Your account is registered as "${userRow.role}". Please select the correct portal.`);
        }
      }

      // ── Sign in with Supabase Auth ───────────────────────────
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });

      if (authError) {
        if (authError.message.toLowerCase().includes("invalid")) {
          throw new Error("Incorrect email/phone or password. Please try again.");
        }
        if (authError.message.toLowerCase().includes("email not confirmed")) {
          throw new Error("Please verify your email first — check your inbox for a confirmation link.");
        }
        throw new Error(authError.message);
      }

      if (!authData.user) throw new Error("Login failed. Please try again.");

      // ── Verify role in DB if role was selected ───────────────
      if (role) {
        const { data: userRow } = await supabase
          .from("users")
          .select("role, is_active")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (userRow && !userRow.is_active) {
          await supabase.auth.signOut();
          throw new Error("Your account has been deactivated. Contact your administrator.");
        }

        if (userRow && userRow.role !== role) {
          await supabase.auth.signOut();
          throw new Error(`You're registered as "${userRow.role}". Please select the correct portal.`);
        }
      }

      // ── Load profile into AuthContext THEN navigate ─────────────
      // This ensures the ProtectedRoute finds user != null immediately.
      await loadUserProfile(authData.user.id);
      navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "Login failed. Please try again.");
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

  const isFormValid = identifier.trim().length > 0 && password.length >= 6;

  const btnLabel = loading ? "Verifying..."
    : !identifier ? "Enter Email or Phone"
      : password.length < 6 ? "Password too short"
        : role ? `Continue as ${ROLES.find(r => r.id === role)?.label}`
          : "Continue";

  return (
    <div className="windows-viewport">
      <div className="master-stack">

        {/* Brand */}
        <div className="brand-display-container">
          <h1 className="website-brand-name">MedQueue</h1>
          <p className="brand-tagline">Emergency Response Network</p>
        </div>

        {/* Card */}
        <main className="login-card-premium">
          <header className="auth-header">
            <h2 className="welcome-text">Welcome Back</h2>
            <p className="welcome-sub">Choose your portal and verify your identity</p>
          </header>

          {error && (
            <div className="login-error-banner">⚠️ {error}</div>
          )}

          {/* Role selector */}
          <section className="entity-selection-container">
            <div className="entity-grid">
              {ROLES.map(item => (
                <div key={item.id}
                  className={`entity-box-advanced ${role === item.id ? "active" : ""}`}
                  onClick={() => { setRole(item.id); setError(""); }}>
                  <div className="glow-indicator" />
                  <div className="entity-info">
                    <span className="entity-title">{item.label}</span>
                    <span className="entity-subtitle">{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Form */}
          <form className="auth-form-stack" onSubmit={handleLogin}>
            <div className="input-field-container">
              <input
                type="text"
                placeholder="Email address or 10-digit phone number"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
              />
            </div>

            <div className="input-field-container">
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              {password.length > 0 && password.length < 6 && (
                <p className="hint-text">Minimum 6 characters</p>
              )}
            </div>

            <button type="submit" className="primary-action-btn"
              disabled={!isFormValid || loading}>
              {btnLabel}
            </button>

            <button type="button" className="google-auth-btn" onClick={handleGoogle} disabled={loading}>
              <span className="google-icon">G</span>
              Continue with Google
            </button>
          </form>

          <footer className="card-footer">
            <p className="signup-text">
              Don't have an account?{" "}
              <span className="signup-trigger" onClick={() => navigate("/signup")}>
                Sign up here
              </span>
            </p>
          </footer>
        </main>
      </div>

      <div className="bg-gradient-orb" />
    </div>
  );
}