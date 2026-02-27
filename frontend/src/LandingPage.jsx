// src/LandingPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function App() {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [type, setType] = useState("General");
  const [errorMsg, setErrorMsg] = useState("");   // ← was missing in teammate's code

  const services = [
    { title: "General Medicine", desc: "24/7 primary care and digital health consultations." },
    { title: "Bed Availability", desc: "Real-time ICU and Ventilator inventory tracking." },
    { title: "Ambulance Hub", desc: "Instant GPS dispatch for cardiac and trauma cases." },
    { title: "Digital Vault", desc: "Secure encrypted storage for medical history." }
  ];

  const systemFeatures = [
    { title: "System Integration", desc: "Seamlessly integrates with existing hospital HIS and ambulance dispatch systems." },
    { title: "Scalable & Secure", desc: "Encrypted data architecture ensuring full privacy compliance and HIPAA standards." },
    { title: "Low Connectivity", desc: "Engineered to remain reliable and functional even in areas with poor network coverage." }
  ];

  const workflow = [
    { id: "1", title: "Open Website", desc: "Access the MedQueue portal on any device.", img: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?q=80&w=400&h=300&fit=crop" },
    { id: "2", title: "Register / Login", desc: "Secure multi-factor authentication setup.", img: "https://images.unsplash.com/photo-1554734867-bf3c00a49371?q=80&w=400&h=300&fit=crop" },
    { id: "3", title: "Enter Location", desc: "Auto-detecting nearest medical facilities.", img: "https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?q=80&w=400&h=300&fit=crop" },
    { id: "4", title: "Choose Service", desc: "Filter by Bed, Ambulance, or Specialist.", img: "https://images.unsplash.com/photo-1516549655169-df83a0774514?q=80&w=400&h=300&fit=crop" },
    { id: "5", title: "Enter Details", desc: "Vital information for hospital readiness.", img: "https://images.unsplash.com/photo-1454165205744-3b78555e5572?q=80&w=400&h=300&fit=crop" },
    { id: "6", title: "View Results", desc: "Compare distance, ratings, and availability.", img: "https://images.unsplash.com/photo-1581056771107-24ca5f033842?q=80&w=400&h=300&fit=crop" },
    { id: "7", title: "Confirm Request", desc: "Digital handshake with the medical team.", img: "https://images.unsplash.com/photo-1584432810601-6c7f27d2362b?q=80&w=400&h=300&fit=crop" },
    { id: "8", title: "Track Updates", desc: "Live ETA and paramedic communication.", img: "https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?q=80&w=400&h=300&fit=crop" }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveCard((prev) => (prev + 1) % services.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [services.length]);

  // ── Emergency SOS ─────────────────────────────────────────────
  const handleSOS = async () => {
    setErrorMsg("");

    if (!phone.trim()) {
      setErrorMsg("Phone number is required");
      return;
    }

    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported by your browser");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(`${API}/emergency/sos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: phone.trim(),
              type,
              lat: latitude,
              lng: longitude,
            }),
          });
          const json = await res.json();
          if (!json.success) {
            setErrorMsg(json.message || "Failed to send emergency request. Try again.");
            return;
          }
          alert("🚨 Emergency request sent! Help is on the way.");
          setShowModal(false);
          setPhone("");
          setType("General");
          setErrorMsg("");
        } catch {
          setErrorMsg("Network error — please try again or call 112 directly.");
        }
      },
      (err) => {
        console.warn("Location denied:", err);
        setErrorMsg("Location access denied. Please allow location to send emergency request.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  return (
    <div className="med-root">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">Med<span>Queue</span></div>
          <div className="nav-actions">
            <button className="btn-login" onClick={() => navigate("/login")}>Login</button>
            <button className="btn-signup" onClick={() => navigate("/signup")}>Sign Up</button>
          </div>
        </div>
      </nav>

      {/* Emergency SOS FAB */}
      <button className="emergency-fab" onClick={() => { setShowModal(true); setErrorMsg(""); }}>
        EMERGENCY SOS
      </button>

      {/* SOS Modal */}
      {showModal && (
        <div className="sos-modal">
          <div className="sos-content">
            <h2>🚨 Emergency SOS</h2>
            <span className="sos-subtitle">Help will be dispatched to your location</span>

            {errorMsg && (
              <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "10px 14px", color: "#f87171", fontSize: 13, marginTop: 8 }}>
                ⚠️ {errorMsg}
              </div>
            )}

            <input
              type="tel"
              placeholder="Enter Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="General">General Medical</option>
              <option value="Cardiac">Cardiac Emergency</option>
              <option value="Accident">Accident / Trauma</option>
              <option value="Pregnancy">Pregnancy / Labor</option>
            </select>

            <div className="modal-buttons">
              <button className="btn-confirm" onClick={handleSOS}>Confirm Emergency Request</button>
              <button className="btn-cancel" onClick={() => { setShowModal(false); setErrorMsg(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      <header className="hero">
        <div className="hero-box">
          <span className="badge">Next-Gen Healthcare</span>
          <h1>Smart Logistics For <br /><span>Life-Saving Care</span></h1>
          <p className="ppt-info">
            MedQueue bridges the gap between emergency patients and critical resources.
            We provide a real-time command center for bed inventory and ambulance dispatch.
          </p>
          <div className="hero-stats">
            <div className="stat"><strong>500+</strong><span>Hospitals</span></div>
            <div className="stat"><strong>12min</strong><span>Avg Response</span></div>
            <div className="stat"><strong>24/7</strong><span>Support</span></div>
          </div>
        </div>
      </header>

      <section className="services-section">
        <h2 className="section-title">Core Services</h2>
        <div className="mini-card-container">
          <div className="mini-blue-card">
            <div className="circle-decor"></div>
            <h3>{services[activeCard].title}</h3>
            <p>{services[activeCard].desc}</p>
            <div className="dots">
              {services.map((_, i) => (
                <span key={i} className={`dot ${i === activeCard ? "active" : ""}`}></span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="features-highlight">
        <div className="features-grid">
          {systemFeatures.map((f, i) => (
            <div className="feature-item" key={i}>
              <div className="feature-dot"></div>
              <h4>{f.title}</h4>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="workflow">
        <h2 className="section-title">Operational Workflow</h2>
        <div className="timeline">
          <div className="line-connector"></div>
          {workflow.map((item, idx) => (
            <div className={`t-block ${idx % 2 === 0 ? "left" : "right"}`} key={idx}>
              <div className="t-marker">{item.id}</div>
              <div className="t-card">
                <div className="t-img-box">
                  <img src={item.img} alt={item.title} />
                </div>
                <div className="t-text">
                  <h4>{item.title}</h4>
                  <p>{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <p>© 2026 MedQueue Systems | All Rights Reserved</p>
      </footer>
    </div>
  );
}

export default App;
