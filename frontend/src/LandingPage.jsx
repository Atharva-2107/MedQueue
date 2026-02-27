import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./LandingPage.css";
import { supabase } from './supabaseClient';

function App() {
  const navigate = useNavigate(); 
  const [activeCard, setActiveCard] = useState(0);

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
  
// Add this function inside your App component
const handleGoogleLogin = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      // This tells Supabase where to send the user after they log in
      redirectTo: 'http://localhost:5173/dashboard' 
    }
  });

  if (error) {
    console.error("Error logging in:", error.message);
  }
};
  return (
    <div className="med-root">
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">Med<span>Queue</span></div>
          <div className="nav-actions">
            {/* <button className="btn-login" onClick={handleGoogleLogin}>Login</button> */}
            <button className="btn-login" onClick={() => navigate("/login")}>Login</button>
            <button className="btn-signup" onClick={() => navigate("/signup")}>Sign Up</button>
          </div>
        </div>
      </nav>

      <button className="emergency-fab">EMERGENCY SOS</button>

      <header className="hero">
        <div className="hero-box">
          <span className="badge">Next-Gen Healthcare</span>
          <h1>Smart Logistics For <br/><span>Life-Saving Care</span></h1>
          <p className="ppt-info">
            MedQueue bridges the gap between emergency patients and critical resources. 
            We provide a real-time command center for bed inventory and ambulance dispatch.
          </p>
          <div className="hero-stats">
            <div className="stat"><strong>500+</strong><span>Hospitals</span></div>
            <div className="stat"><strong>12min</strong><span>Avg Response</span></div>
            <div className="stat :"><strong>24/7</strong><span>Support</span></div>
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
