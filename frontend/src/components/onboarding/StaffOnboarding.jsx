// src/components/onboarding/StaffOnboarding.jsx
// 2-step hospital staff onboarding: Hospital Details → Role & Department
import React, { useState, useEffect } from "react";
import api from "../../lib/api";
import "./onboarding.css";

const STEPS = [
    { id: 1, title: "Your Hospital", icon: "🏥" },
    { id: 2, title: "Role & Dept", icon: "👩‍⚕️" },
];

const DEPARTMENTS = ["Emergency", "ICU", "General Ward", "Pediatrics", "Surgery", "Orthopaedics", "Cardiology", "Neurology", "Radiology", "Laboratory", "Administration"];
const ROLES_IN_HOSPITAL = ["Nurse", "Doctor", "Receptionist", "Ward Boy", "Lab Technician", "Pharmacist", "Admin Staff", "Other"];
const SHIFTS = ["Morning (6am–2pm)", "Afternoon (2pm–10pm)", "Night (10pm–6am)", "Rotating"];

const StepHeader = ({ icon, title, desc }) => (
    <div className="onb-step-header">
        <div className="onb-step-icon" style={{ background: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.2)" }}>{icon}</div>
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

export default function StaffOnboarding({ onComplete, onSkip }) {
    const [step, setStep] = useState(1);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [hospitals, setHospitals] = useState([]);
    const [form, setForm] = useState({
        hospital_id: "", department: "", job_role: "",
        shift: "", employee_id: "", emergency_phone: "",
    });

    const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

    useEffect(() => {
        api.get("/beds/availability").then(r => setHospitals(r.data.hospitals || [])).catch(() => { });
    }, []);

    const handleSubmit = async () => {
        try {
            setSaving(true); setError("");
            await api.post("/onboarding/staff", form);
            onComplete?.();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to save profile. Please try again.");
        } finally { setSaving(false); }
    };

    const canNext = () => {
        if (step === 1) return form.hospital_id;
        return form.department && form.job_role;
    };

    return (
        <div className="onb-root">
            <div className="onb-container">

                {/* Header */}
                <div className="onb-header">
                    <div className="onb-brand-badge" style={{ borderColor: "rgba(96,165,250,0.3)", background: "rgba(96,165,250,0.08)", color: "#60a5fa" }}>
                        <span>🏥</span> MedQueue — Staff Setup
                    </div>
                    <h1 className="onb-title">Set Up Your Staff Profile</h1>
                    <p className="onb-subtitle">Link your account to your hospital and department</p>
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

                    {/* ── STEP 1: Hospital Selection ── */}
                    {step === 1 && (
                        <div>
                            <StepHeader icon="🏥" title="Select Your Hospital" desc="Find and link your hospital account" />
                            <Field label="Your Hospital *">
                                {hospitals.length > 0 ? (
                                    <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                                        {hospitals.map(h => (
                                            <button key={h.id}
                                                onClick={() => update("hospital_id", h.id)}
                                                style={{
                                                    padding: "14px 18px", borderRadius: 14, textAlign: "left", cursor: "pointer",
                                                    background: form.hospital_id === h.id ? "rgba(96,165,250,0.12)" : "rgba(255,255,255,0.04)",
                                                    border: form.hospital_id === h.id ? "1px solid rgba(96,165,250,0.4)" : "1px solid rgba(255,255,255,0.08)",
                                                    transition: "all 0.18s", display: "flex", flexDirection: "column", gap: 4,
                                                }}>
                                                <span style={{ color: form.hospital_id === h.id ? "#60a5fa" : "#fff", fontWeight: 700, fontSize: 14 }}>
                                                    {form.hospital_id === h.id ? "✓ " : ""}{h.name}
                                                </span>
                                                <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>📍 {h.city} · {h.available_beds}/{h.total_beds} beds available</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ padding: "24px", textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>
                                        Loading hospitals... If none appear, enter your hospital ID below.
                                    </div>
                                )}
                                <input type="text" className="onb-input" placeholder="Or paste hospital ID directly..."
                                    style={{ marginTop: 10 }}
                                    value={hospitals.find(h => h.id === form.hospital_id) ? "" : form.hospital_id}
                                    onChange={e => update("hospital_id", e.target.value)} />
                            </Field>
                            <div className="onb-alert onb-alert-blue">
                                <p className="onb-alert-title">🏥 Hospital Verification</p>
                                <p className="onb-alert-body">
                                    Your hospital admin will verify your account before you can manage beds and bookings.
                                    This typically takes 1-2 hours.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Role & Department ── */}
                    {step === 2 && (
                        <div>
                            <StepHeader icon="👩‍⚕️" title="Your Role & Department" desc="We'll customize your dashboard based on this" />
                            <Field label="Department *">
                                <div className="onb-tag-wrap">
                                    {DEPARTMENTS.map(d => (
                                        <button key={d} className={`onb-tag ${form.department === d ? "active-violet" : ""}`}
                                            onClick={() => update("department", d)}>{d}</button>
                                    ))}
                                </div>
                            </Field>
                            <Field label="Your Role *">
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                                    {ROLES_IN_HOSPITAL.map(r => (
                                        <button key={r} className={`onb-pill ${form.job_role === r ? "active-emerald" : ""}`}
                                            onClick={() => update("job_role", r)}>{r}</button>
                                    ))}
                                </div>
                            </Field>
                            <div className="onb-grid-2">
                                <Field label="Shift">
                                    {SHIFTS.map(s => (
                                        <button key={s} className={`onb-pill ${form.shift === s ? "active-emerald" : ""}`}
                                            style={{ marginBottom: 8, width: "100%", textAlign: "left", padding: "10px 12px", fontSize: 12 }}
                                            onClick={() => update("shift", s)}>{s}</button>
                                    ))}
                                </Field>
                                <div>
                                    <Field label="Employee ID">
                                        <input type="text" className="onb-input" placeholder="Your hospital employee ID"
                                            value={form.employee_id} onChange={e => update("employee_id", e.target.value)} />
                                    </Field>
                                    <Field label="Emergency Phone">
                                        <input type="tel" className="onb-input" placeholder="+91 98765 43210"
                                            value={form.emergency_phone} onChange={e => update("emergency_phone", e.target.value)} />
                                    </Field>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Navigation */}
                    <div className="onb-nav">
                        {step > 1 && (
                            <button className="onb-btn-back" onClick={() => setStep(s => s - 1)}>← Back</button>
                        )}
                        {step < 2 ? (
                            <button className="onb-btn-next" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                                Continue →
                            </button>
                        ) : (
                            <button className="onb-btn-next" onClick={handleSubmit} disabled={saving || !canNext()}>
                                {saving ? "Saving..." : "🏥 Complete Setup"}
                            </button>
                        )}
                    </div>
                    <button className="onb-btn-skip" onClick={() => (onSkip ?? onComplete)?.()}>
                        Skip for now — fill in later
                    </button>
                </div>
            </div>
        </div>
    );
}
