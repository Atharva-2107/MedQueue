// // src/Signup.jsx
// import React, { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import { supabase } from "./supabaseClient";
// import "./signup.css";

// const ROLES = [
//   { id: "patient", icon: "👤", label: "Patient", desc: "Personal Care & Health History" },
//   { id: "driver", icon: "🚑", label: "Driver", desc: "Emergency Dispatch & Telemetry" },
//   { id: "hospital_staff", icon: "🏥", label: "Hospital", desc: "Bed Management & Resources" },
//   { id: "admin", icon: "🔑", label: "Admin", desc: "System-wide Analytics & Control" },
// ];

// export default function Signup() {
//   const navigate = useNavigate();

//   const [role, setRole] = useState("patient");
//   const [fullName, setFullName] = useState("");
//   const [email, setEmail] = useState("");
//   const [phone, setPhone] = useState("");
//   const [password, setPassword] = useState("");

//   const [dob, setDob] = useState("");
//   const [bloodGroup, setBloodGroup] = useState("");
//   const [address, setAddress] = useState("");
//   const [healthNotes, setHealthNotes] = useState("");

//   const [drivingExp, setDrivingExp] = useState("");
//   const [licenseNo, setLicenseNo] = useState("");
//   const [ambulanceNo, setAmbulanceNo] = useState("");

//   const [hospitalName, setHospitalName] = useState("");
//   const [hospitalAddress, setHospitalAddress] = useState("");
//   const [staffStrength, setStaffStrength] = useState("");
//   const [totalAmbs, setTotalAmbs] = useState("");
//   const [landmark, setLandmark] = useState("");

//   const [department, setDepartment] = useState("");
//   const [employeeId, setEmployeeId] = useState("");

//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState("");
//   const [success, setSuccess] = useState("");

//   const handleSignup = async (e) => {
//     e.preventDefault();
//     setError("");
//     setSuccess("");

//     if (!fullName.trim()) return setError("Please enter your full name.");
//     if (phone.length !== 10) return setError("Phone number must be exactly 10 digits.");
//     if (password.length < 6) return setError("Password must be at least 6 characters.");

//     setLoading(true);

//     try {
//       // 1. AUTH SIGNUP
//       const { data: authData, error: authError } = await supabase.auth.signUp({
//         email: email.trim().toLowerCase(),
//         password,
//         options: {
//           data: {
//             full_name: fullName.trim(),
//             phone_number: phone.trim(),
//             user_role: role,
//           },
//         },
//       });

//       if (authError) throw authError;

//       console.log("Auth Data:", authData);

//       const userId = authData?.user?.id;
//       if (!userId) throw new Error("User ID not returned from auth");

//       // 2. USERS TABLE
//       const { error: userError } = await supabase.from("users").upsert({
//         id: userId,
//         full_name: fullName.trim(),
//         email: email.trim().toLowerCase(),
//         phone: phone.trim(),
//         role: role,
//         is_active: true,
//       });

//       if (userError) {
//         console.error("Users Table Error:", userError);
//         throw userError;
//       }

//       // 3. ROLE TABLES

//       if (role === "patient") {
//         const { error } = await supabase.from("patient_profiles").upsert({
//           user_id: userId,
//           date_of_birth: dob || null,
//           blood_group: bloodGroup || null,
//           address: address || null,
//           medical_notes: healthNotes || null,
//         });
//         if (error) throw error;
//       }

//       if (role === "driver") {
//         const { error } = await supabase.from("driver_profiles").upsert({
//           user_id: userId,
//           license_number: licenseNo || null,
//           driving_experience: drivingExp || null,
//           ambulance_number: ambulanceNo || null,
//           is_profile_complete: !!(licenseNo && ambulanceNo),
//         });
//         if (error) throw error;
//       }

//       if (role === "hospital_staff") {
//         const { error } = await supabase.from("hospital_profiles").upsert({
//           user_id: userId,
//           hospital_name: hospitalName || null,
//           hospital_address: hospitalAddress || null,
//           staff_strength: staffStrength ? parseInt(staffStrength) : null,
//           total_ambulances: totalAmbs ? parseInt(totalAmbs) : null,
//           nearest_landmark: landmark || null,
//           is_profile_complete: !!(hospitalName && hospitalAddress),
//         });
//         if (error) throw error;
//       }

//       if (role === "admin") {
//         const { error } = await supabase.from("admin_profiles").upsert({
//           user_id: userId,
//           department: department || null,
//           employee_id: employeeId || null,
//         });
//         if (error) throw error;
//       }

//       // ✅ 4. FORCE LOGIN AFTER SIGNUP (FIXES REDIRECT ISSUE)
//       const { error: loginError } = await supabase.auth.signInWithPassword({
//         email: email.trim().toLowerCase(),
//         password,
//       });

//       if (loginError) {
//         console.warn("Auto login failed:", loginError.message);
//         setSuccess("Account created! Please login.");
//         navigate("/login");
//         return;
//       }

//       // ✅ 5. DIRECT REDIRECT (NO SESSION CHECK)
//       setSuccess("✅ Account created successfully!");
//       navigate("/dashboard");

//     } catch (err) {
//       console.error("Signup FULL ERROR:", err);
//       setError(err.message || "Signup failed");
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleGoogle = async () => {
//     setError("");
//     const { error } = await supabase.auth.signInWithOAuth({
//       provider: "google",
//       options: { redirectTo: `${window.location.origin}/dashboard` },
//     });
//     if (error) setError("Google sign-in failed: " + error.message);
//   };

//   const isValid =
//     fullName.trim().length > 0 &&
//     email.trim().length > 0 &&
//     phone.length === 10 &&
//     password.length >= 6;

//   const currentRole = ROLES.find((r) => r.id === role);

//   return (
//     <div className="signup-wrapper">
//       <nav className="web-nav">
//         <div className="nav-container">
//           <div className="logo">Jeevan<span>Setu</span></div>
//           <button className="login-btn-pill" onClick={() => navigate("/login")}>
//             Login to Account
//           </button>
//         </div>
//       </nav>

//       <main className="main-content">
//         <header className="hero-section">
//           <span className="hero-badge">JeevanSetu — Health-Tech Ecosystem</span>
//           <h1>Join the Network</h1>
//           <p>Integrated Emergency Response & Healthcare Management</p>
//         </header>

//         <div className="role-selection-area">
//           <div className="role-nav-grid">
//             {ROLES.map((r) => (
//               <div
//                 key={r.id}
//                 className={`role-tab ${role === r.id ? "active" : ""}`}
//                 onClick={() => {
//                   setRole(r.id);
//                   setError("");
//                 }}
//               >
//                 <div className="role-icon-wrapper">{r.icon}</div>
//                 <div className="role-tab-text">
//                   <h3>{r.label}</h3>
//                   <p>{r.desc}</p>
//                 </div>
//               </div>
//             ))}
//           </div>
//         </div>

//         <section className="form-section">
//           <div className="registration-card">
//             <div className="card-header">
//               <span className="form-badge">
//                 {currentRole?.icon} {role?.toUpperCase()} REGISTRATION
//               </span>
//               <h2>Registration Details</h2>
//             </div>

//             {error && <div className="form-alert error">⚠️ {error}</div>}
//             {success && <div className="form-alert success">{success}</div>}

//             <form onSubmit={handleSignup} className="dynamic-form">
//               <div className="form-input-grid">
//                 <div className="input-field full">
//                   <label>Full Name *</label>
//                   <input
//                     type="text"
//                     value={fullName}
//                     onChange={(e) => setFullName(e.target.value)}
//                     required
//                   />
//                 </div>
//               </div>

//               <div className="form-input-grid">
//                 <div className="input-field">
//                   <label>Phone Number *</label>
//                   <input
//                     type="tel"
//                     value={phone}
//                     onChange={(e) =>
//                       setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
//                     }
//                     required
//                   />
//                 </div>

//                 <div className="input-field">
//                   <label>Email *</label>
//                   <input
//                     type="email"
//                     value={email}
//                     onChange={(e) => setEmail(e.target.value)}
//                     required
//                   />
//                 </div>

//                 <div className="input-field">
//                   <label>Password *</label>
//                   <input
//                     type="password"
//                     value={password}
//                     onChange={(e) => setPassword(e.target.value)}
//                     required
//                   />
//                 </div>
//               </div>

//               <button disabled={loading || !isValid}>
//                 {loading ? "Creating..." : "Register"}
//               </button>
//             </form>
//           </div>
//         </section>
//       </main>
//     </div>
//   );
// }
// src/Signup.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient";
import "./signup.css";

const ROLES = [
  { id: "patient", icon: "👤", label: "Patient", desc: "Personal Care & Health History" },
  { id: "driver", icon: "🚑", label: "Driver", desc: "Emergency Dispatch & Telemetry" },
  { id: "hospital_staff", icon: "🏥", label: "Hospital", desc: "Bed Management & Resources" },
  { id: "admin", icon: "🔑", label: "Admin", desc: "System-wide Analytics & Control" },
];

export default function Signup() {
  const navigate = useNavigate();

  // Core State
  const [role, setRole] = useState("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  // Role Specific States
  const [dob, setDob] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [address, setAddress] = useState("");
  const [healthNotes, setHealthNotes] = useState("");
  const [drivingExp, setDrivingExp] = useState("");
  const [licenseNo, setLicenseNo] = useState("");
  const [ambulanceNo, setAmbulanceNo] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [hospitalAddress, setHospitalAddress] = useState("");
  const [staffStrength, setStaffStrength] = useState("");
  const [totalAmbs, setTotalAmbs] = useState("");
  const [landmark, setLandmark] = useState("");
  const [department, setDepartment] = useState("");
  const [employeeId, setEmployeeId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!fullName.trim()) return setError("Please enter your full name.");
    if (phone.length !== 10) return setError("Phone number must be exactly 10 digits.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");

    setLoading(true);

    try {
      // 1. AUTH SIGNUP 
      // This triggers the SQL Function we wrote to populate public.users automatically
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

      if (authError) throw authError;
      const userId = authData?.user?.id;
      if (!userId) throw new Error("Authentication failed to return a User ID.");

      // 2. ROLE-SPECIFIC PROFILE DATA
      // We perform this step after auth. The trigger ensures the user row exists.
      let profileError = null;

      if (role === "patient") {
        const { error } = await supabase.from("patient_profiles").upsert({
          user_id: userId,
          date_of_birth: dob || null,
          blood_group: bloodGroup || null,
          address: address || null,
          medical_notes: healthNotes || null,
        });
        profileError = error;
      } else if (role === "driver") {
        const { error } = await supabase.from("driver_profiles").upsert({
          user_id: userId,
          license_number: licenseNo || null,
          driving_experience: drivingExp || null,
          ambulance_number: ambulanceNo || null,
          is_profile_complete: !!(licenseNo && ambulanceNo),
        });
        profileError = error;
      } else if (role === "hospital_staff") {
        const { error } = await supabase.from("hospital_profiles").upsert({
          user_id: userId,
          hospital_name: hospitalName || null,
          hospital_address: hospitalAddress || null,
          staff_strength: staffStrength ? parseInt(staffStrength) : null,
          total_ambulances: totalAmbs ? parseInt(totalAmbs) : null,
          nearest_landmark: landmark || null,
          is_profile_complete: !!(hospitalName && hospitalAddress),
        });
        profileError = error;
      } else if (role === "admin") {
        const { error } = await supabase.from("admin_profiles").upsert({
          user_id: userId,
          department: department || null,
          employee_id: employeeId || null,
        });
        profileError = error;
      }

      if (profileError) {
        console.error("Profile Creation Error:", profileError);
        // We don't throw here so the user isn't stuck; they can update profile later
      }

      // 3. AUTO LOGIN
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (loginError) {
        setSuccess("Account created! Please log in manually.");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        setSuccess("✅ Account created successfully!");
        navigate("/dashboard");
      }

    } catch (err) {
      console.error("Signup Process Error:", err);
      setError(err.message || "Signup failed");
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

        {/* Role Selector */}
        <div className="role-selection-area">
          <div className="role-nav-grid">
            {ROLES.map((r) => (
              <div
                key={r.id}
                className={`role-tab ${role === r.id ? "active" : ""}`}
                onClick={() => setRole(r.id)}
              >
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
              <span className="form-badge">
                {currentRole?.icon} {role?.toUpperCase()} REGISTRATION
              </span>
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
                    type="tel" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} 
                    required 
                  />
                </div>
                <div className="input-field">
                  <label>Email *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="input-field">
                  <label>Password *</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
              </div>

              {/* Dynamic Role Fields */}
              <div className="role-specific-fields">
                {role === "patient" && (
                  <div className="form-input-grid">
                    <div className="input-field"><label>DOB</label><input type="date" onChange={(e) => setDob(e.target.value)} /></div>
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
                    <div className="input-field"><label>Landmark</label><input type="text" onChange={(e) => setLandmark(e.target.value)} /></div>
                  </div>
                )}
              </div>

              <button className="submit-btn" disabled={loading || !isValid}>
                {loading ? "Processing..." : "Create Account"}
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}