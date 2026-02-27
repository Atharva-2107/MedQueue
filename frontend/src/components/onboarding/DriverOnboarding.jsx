// src/components/onboarding/DriverOnboarding.jsx
// 3-step driver onboarding: Vehicle Info → License/Documents → GPS Setup
import React, { useState } from "react";
import api from "../../lib/api";
import "./onboarding.css";

const STEPS = [
    { id: 1, title: "Vehicle Info", icon: "🚑" },
    { id: 2, title: "License & Docs", icon: "📄" },
    { id: 3, title: "GPS Setup", icon: "📍" },
];

const VEHICLE_TYPES = ["Basic Life Support", "Advanced Life Support", "Patient Transport", "Neonatal"];
const FUEL_TYPES = ["Petrol", "Diesel", "CNG", "Electric"];

const StepHeader = ({ icon, title, desc }) => (
    <div className="onb-step-header">
        <div className="onb-step-icon" style={{ background: "rgba(251,146,60,0.1)", borderColor: "rgba(251,146,60,0.2)" }}>{icon}</div>
        <h2 className="onb-step-title">{title}</h2>
        <p className="onb-step-desc">{desc}</p>
    </div>
);

const Field = ({ label, children }) => (
    <div className="onb-field">
        <label className="onb-label">{label}</label>
        {children}
    </div>
);

export default function DriverOnboarding({ onComplete, onSkip }) {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [gpsGranted, setGpsGranted] = useState(false);
    const [gpsError, setGpsError] = useState("");
    const [form, setForm] = useState({
        vehicle_number: "", ambulance_type: "",
        fuel_type: "", year_of_manufacture: "",
        license_number: "", license_expiry: "",
        aadhaar_number: "", emergency_phone: "",
        current_lat: null, current_lng: null,
    });

    const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

    const requestGPS = () => {
        setGpsError("");
        if (!navigator.geolocation) {
            setGpsError("Geolocation not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                update("current_lat", pos.coords.latitude);
                update("current_lng", pos.coords.longitude);
                setGpsGranted(true);
            },
            () => setGpsError("Location access denied. Please enable location in browser settings."),
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const handleSubmit = async () => {
        try {
            setSaving(true); setError("");
            await api.post("/onboarding/driver", form);
            onComplete?.();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save profile. Please try again.");
        } finally { setSaving(false); }
    };

    const canNext = () => {
        if (step === 1) return form.vehicle_number && form.ambulance_type;
        if (step === 2) return form.license_number;
        return true;
    };

    return (
        <div className="onb-root">
            <div className="onb-container">

                {/* Header */}
                <div className="onb-header">
                    <div className="onb-brand-badge" style={{ borderColor: "rgba(251,146,60,0.3)", background: "rgba(251,146,60,0.08)", color: "#fb923c" }}>
                        <span>🚑</span> MedQueue — Driver Setup
                    </div>
                    <h1 className="onb-title">Set Up Your Driver Profile</h1>
                    <p className="onb-subtitle">Complete your vehicle and license information to start accepting dispatches</p>
                </div>

                {/* Step Indicators */}
                <div className="onb-steps">
                    {STEPS.map((s, i) => (
                        <React.Fragment key={s.id}>
                            <div className="onb-step-wrap">
                                <div className={`onb-step-circle ${step > s.id ? "done" : step === s.id ? "active" : ""}`}>
                                    {step > s.id ? "✓" : s.icon}
                                </div>
                                <span className={`onb-step-label ${step === s.id ? "active" : ""}`}>{s.title}</span>
                            </div>
                            {i < STEPS.length - 1 && <div className={`onb-step-line ${step > s.id ? "done" : ""}`} />}
                        </React.Fragment>
                    ))}
                </div>

                <div className="onb-card">
                    {error && <div className="onb-error">⚠️ {error}</div>}

                    {/* ── STEP 1: Vehicle Info ── */}
                    {step === 1 && (
                        <div>
                            <StepHeader icon="🚑" title="Vehicle Information" desc="Details about your ambulance" />
                            <Field label="Vehicle Number *">
                                <input type="text" className="onb-input" placeholder="e.g. MH12AB1234"
                                    value={form.vehicle_number} onChange={e => update("vehicle_number", e.target.value.toUpperCase())} />
                            </Field>
                            <Field label="Ambulance Type *">
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    {VEHICLE_TYPES.map(t => (
                                        <button key={t} className={`onb-pill ${form.ambulance_type === t ? "active-orange" : ""}`}
                                            style={{ textAlign: "left", padding: "12px 14px" }}
                                            onClick={() => update("ambulance_type", t)}>{t}</button>
                                    ))}
                                </div>
                            </Field>
                            <div className="onb-grid-2">
                                <Field label="Fuel Type">
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                        {FUEL_TYPES.map(f => (
                                            <button key={f} className={`onb-pill ${form.fuel_type === f ? "active-emerald" : ""}`}
                                                onClick={() => update("fuel_type", f)}>{f}</button>
                                        ))}
                                    </div>
                                </Field>
                                <Field label="Year of Manufacture">
                                    <input type="number" className="onb-input" placeholder="e.g. 2021" min="2000" max="2026"
                                        value={form.year_of_manufacture} onChange={e => update("year_of_manufacture", e.target.value)} />
                                </Field>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: License & Documents ── */}
                    {step === 2 && (
                        <div>
                            <StepHeader icon="📄" title="License & Documents" desc="Verify your credentials for dispatch eligibility" />
                            <Field label="Driving License Number *">
                                <input type="text" className="onb-input" placeholder="e.g. MH1220200001234"
                                    value={form.license_number} onChange={e => update("license_number", e.target.value)} />
                            </Field>
                            <Field label="License Expiry Date">
                                <input type="date" className="onb-input" value={form.license_expiry}
                                    onChange={e => update("license_expiry", e.target.value)} />
                            </Field>
                            <Field label="Aadhaar Number">
                                <input type="text" className="onb-input" placeholder="XXXX XXXX XXXX" maxLength={14}
                                    value={form.aadhaar_number} onChange={e => update("aadhaar_number", e.target.value)} />
                            </Field>
                            <Field label="Emergency Contact Phone">
                                <input type="tel" className="onb-input" placeholder="+91 98765 43210"
                                    value={form.emergency_phone} onChange={e => update("emergency_phone", e.target.value)} />
                            </Field>
                            <div className="onb-alert onb-alert-amber">
                                <p className="onb-alert-title">🔐 Verification</p>
                                <p className="onb-alert-body">Your documents will be verified by the hospital admin before you can receive dispatches. This usually takes 1-2 hours.</p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: GPS Setup ── */}
                    {step === 3 && (
                        <div>
                            <StepHeader icon="📍" title="GPS Location Setup" desc="Required for real-time ambulance tracking and dispatch routing" />

                            {!gpsGranted ? (
                                <div style={{ textAlign: "center", padding: "32px 0" }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: "50%",
                                        background: "rgba(251,146,60,0.1)", border: "2px solid rgba(251,146,60,0.3)",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 36, margin: "0 auto 24px"
                                    }}>📍</div>
                                    <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                                        Enable Location Access
                                    </p>
                                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
                                        The app needs your location to show you on the live ambulance map and route dispatches to you efficiently.
                                    </p>
                                    {gpsError && (
                                        <div className="onb-error" style={{ textAlign: "left", marginBottom: 16 }}>
                                            {gpsError}
                                        </div>
                                    )}
                                    <button onClick={requestGPS}
                                        style={{
                                            background: "#fb923c", color: "#000", border: "none", borderRadius: 14,
                                            padding: "16px 40px", fontWeight: 800, fontSize: 15, cursor: "pointer",
                                            boxShadow: "0 4px 20px rgba(251,146,60,0.35)", marginBottom: 12,
                                        }}>
                                        📍 Allow Location Access
                                    </button>
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "24px 0" }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: "50%",
                                        background: "rgba(52,211,153,0.1)", border: "2px solid #34d399",
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        fontSize: 36, margin: "0 auto 20px",
                                        boxShadow: "0 0 24px rgba(52,211,153,0.2)"
                                    }}>✓</div>
                                    <p style={{ color: "#34d399", fontWeight: 800, fontSize: 18, marginBottom: 8 }}>
                                        Location Access Granted!
                                    </p>
                                    <p style={{ color: "rgba(255,255,255,0.35)", fontSize: 13, marginBottom: 16 }}>
                                        Your current location has been captured.
                                    </p>
                                    <div style={{
                                        background: "rgba(52,211,153,0.05)", border: "1px solid rgba(52,211,153,0.15)",
                                        borderRadius: 12, padding: "12px 20px", display: "inline-block"
                                    }}>
                                        <p style={{ color: "rgba(255,255,255,0.4)", fontSize: 12, fontFamily: "monospace" }}>
                                            {form.current_lat?.toFixed(6)}, {form.current_lng?.toFixed(6)}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="onb-alert onb-alert-blue" style={{ marginTop: 24 }}>
                                <p className="onb-alert-title">📡 Live Tracking</p>
                                <p className="onb-alert-body">
                                    Once you're on duty, your location updates every 5 seconds so patients and hospitals
                                    can see your live ETA on the map.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="onb-nav">
                        {step > 1 && (
                            <button className="onb-btn-back" onClick={() => setStep(s => s - 1)}>← Back</button>
                        )}
                        {step < 3 ? (
                            <button className="onb-btn-next" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                                Continue →
                            </button>
                        ) : (
                            <button className="onb-btn-next" onClick={handleSubmit} disabled={saving}>
                                {saving ? "Saving..." : "🚑 Start Driving"}
                            </button>
                        )}
                    </div>
                    {step === 3 && !gpsGranted && (
                        <button className="onb-btn-skip" onClick={() => (onSkip ?? onComplete)?.()}>
                            Skip GPS for now — enable later
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
