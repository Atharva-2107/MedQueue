// src/components/onboarding/PatientOnboarding.jsx
// Saves directly to Supabase — no backend API dependency
import React, { useState } from "react";
import { supabase } from "../../supabaseClient";
import "./onboarding.css";

const STEPS = [
  { id: 1, title: "Personal Details", icon: "👤" },
  { id: 2, title: "Medical Info", icon: "🩺" },
  { id: 3, title: "Emergency Contact", icon: "🆘" },
  { id: 4, title: "Documents", icon: "📋" },
];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = [{ id: "male", label: "♂ Male" }, { id: "female", label: "♀ Female" }, { id: "other", label: "⚧ Other" }];
const COMMON_ALLERGIES = ["Penicillin", "Aspirin", "Sulfa", "Latex", "Shellfish", "Nuts", "Pollen", "Dust"];
const COMMON_DISEASES = ["Diabetes", "Hypertension", "Asthma", "Heart Disease", "Thyroid", "Kidney Disease", "Anemia"];
const RELATIONS = ["Spouse", "Parent", "Sibling", "Child", "Friend", "Guardian", "Other"];

const StepHeader = ({ icon, title, desc }) => (
  <div className="onb-step-header">
    <div className="onb-step-icon">{icon}</div>
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

export default function PatientOnboarding({ onComplete, onSkip }) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date_of_birth: "", gender: "", blood_group: "",
    allergies: [], chronic_diseases: [], medical_notes: "",
    emergency_contact_name: "", emergency_contact_phone: "",
    emergency_contact_relation: "",
    aadhar_number: "", insurance_id: "",
    address: "", city: "Pune",
  });

  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const toggleArray = (f, v) => setForm(p => ({
    ...p,
    [f]: p[f].includes(v) ? p[f].filter(x => x !== v) : [...p[f], v],
  }));

  const handleSubmit = async () => {
    setSaving(true); setError("");
    try {
      // Get current auth session — always fresh
      const { data: { session }, error: sessErr } = await supabase.auth.getSession();
      if (sessErr || !session?.user) throw new Error("Not logged in. Please sign in and try again.");

      const userId = session.user.id;

      // Upsert patient_profiles (creates row if not found, updates if exists)
      const { error: upsertErr } = await supabase.from("patient_profiles").upsert({
        user_id: userId,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        blood_group: form.blood_group || null,
        allergies: form.allergies.length ? form.allergies : null,
        chronic_diseases: form.chronic_diseases.length ? form.chronic_diseases : null,
        medical_notes: form.medical_notes || null,
        emergency_contact_name: form.emergency_contact_name || null,
        emergency_contact_phone: form.emergency_contact_phone || null,
        emergency_contact_relation: form.emergency_contact_relation || null,
        aadhar_number: form.aadhar_number || null,
        insurance_id: form.insurance_id || null,
        address: form.address || null,
        city: form.city || "Pune",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      if (upsertErr) throw new Error(upsertErr.message);

      // Also mark this user's profile as onboarded (users table updated_at)
      await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("id", userId);

      onComplete?.();
    } catch (err) {
      setError(err.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const canNext = () => {
    if (step === 1) return form.date_of_birth && form.gender && form.blood_group;
    if (step === 3) return form.emergency_contact_name && form.emergency_contact_phone;
    return true;
  };

  return (
    <div className="onb-root">
      <div className="onb-container">

        {/* Header */}
        <div className="onb-header">
          <div className="onb-brand-badge"><span>✚</span> MedQueue — Patient Setup</div>
          <h1 className="onb-title">Complete Your Health Profile</h1>
          <p className="onb-subtitle">This helps hospitals provide faster, better care during emergencies</p>
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

        {/* Card */}
        <div className="onb-card">
          {error && <div className="onb-error">⚠️ {error}</div>}

          {/* STEP 1 */}
          {step === 1 && (
            <div>
              <StepHeader icon="👤" title="Personal Details" desc="Basic information about you" />
              <Field label="Date of Birth *">
                <input type="date" className="onb-input" value={form.date_of_birth} onChange={e => update("date_of_birth", e.target.value)} />
              </Field>
              <Field label="Gender *">
                <div className="onb-pill-grid-3">
                  {GENDERS.map(g => (
                    <button key={g.id} className={`onb-pill ${form.gender === g.id ? "active-emerald" : ""}`} onClick={() => update("gender", g.id)}>{g.label}</button>
                  ))}
                </div>
              </Field>
              <Field label="Blood Group *">
                <div className="onb-pill-grid-4">
                  {BLOOD_GROUPS.map(bg => (
                    <button key={bg} className={`onb-pill ${form.blood_group === bg ? "active-red" : ""}`} onClick={() => update("blood_group", bg)}>{bg}</button>
                  ))}
                </div>
              </Field>
              <div className="onb-grid-2">
                <Field label="City">
                  <input type="text" className="onb-input" placeholder="Mumbai" value={form.city} onChange={e => update("city", e.target.value)} />
                </Field>
                <Field label="Address">
                  <input type="text" className="onb-input" placeholder="Your address" value={form.address} onChange={e => update("address", e.target.value)} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div>
              <StepHeader icon="🩺" title="Medical Information" desc="Helps doctors treat you faster in emergencies" />
              <Field label="Known Allergies">
                <div className="onb-tag-wrap">
                  {COMMON_ALLERGIES.map(a => (
                    <button key={a} className={`onb-tag ${form.allergies.includes(a) ? "active-orange" : ""}`} onClick={() => toggleArray("allergies", a)}>{a}</button>
                  ))}
                </div>
                <input type="text" className="onb-input" placeholder="Other allergy — press Enter"
                  onKeyDown={e => { if (e.key === "Enter" && e.target.value.trim()) { toggleArray("allergies", e.target.value.trim()); e.target.value = ""; } }} />
              </Field>
              <Field label="Chronic Conditions">
                <div className="onb-tag-wrap">
                  {COMMON_DISEASES.map(d => (
                    <button key={d} className={`onb-tag ${form.chronic_diseases.includes(d) ? "active-violet" : ""}`} onClick={() => toggleArray("chronic_diseases", d)}>{d}</button>
                  ))}
                </div>
              </Field>
              {(form.allergies.length > 0 || form.chronic_diseases.length > 0) && (
                <div className="onb-alert onb-alert-amber" style={{ marginBottom: 16 }}>
                  <p className="onb-alert-title">📋 Selected</p>
                  {form.allergies.length > 0 && <p className="onb-alert-body">Allergies: {form.allergies.join(", ")}</p>}
                  {form.chronic_diseases.length > 0 && <p className="onb-alert-body">Conditions: {form.chronic_diseases.join(", ")}</p>}
                </div>
              )}
              <Field label="Additional Medical Notes">
                <textarea className="onb-textarea" rows={3} placeholder="Current medications, ongoing treatments…"
                  value={form.medical_notes} onChange={e => update("medical_notes", e.target.value)} />
              </Field>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div>
              <StepHeader icon="🆘" title="Emergency Contact" desc="Who should we call if you can't respond?" />
              <Field label="Contact Name *">
                <input type="text" className="onb-input" placeholder="Full name" value={form.emergency_contact_name} onChange={e => update("emergency_contact_name", e.target.value)} />
              </Field>
              <Field label="Contact Phone *">
                <input type="tel" className="onb-input" placeholder="+91 98765 43210" value={form.emergency_contact_phone} onChange={e => update("emergency_contact_phone", e.target.value)} />
              </Field>
              <Field label="Relationship">
                <div className="onb-pill-grid-3" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
                  {RELATIONS.map(r => (
                    <button key={r} className={`onb-pill ${form.emergency_contact_relation === r ? "active-emerald" : ""}`} onClick={() => update("emergency_contact_relation", r)}>{r}</button>
                  ))}
                </div>
              </Field>
              <div className="onb-alert onb-alert-amber">
                <p className="onb-alert-title">⚡ Why this matters</p>
                <p className="onb-alert-body">During an emergency, hospital staff will contact this person if you're unable to communicate.</p>
              </div>
            </div>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <div>
              <StepHeader icon="📋" title="Documents (Optional)" desc="Speeds up hospital admission — can be added later" />
              <Field label="Aadhar Number">
                <input type="text" className="onb-input" placeholder="XXXX XXXX XXXX" maxLength={14}
                  value={form.aadhar_number} onChange={e => update("aadhar_number", e.target.value)} />
              </Field>
              <Field label="Insurance / CGHS ID">
                <input type="text" className="onb-input" placeholder="Insurance policy or CGHS ID"
                  value={form.insurance_id} onChange={e => update("insurance_id", e.target.value)} />
              </Field>
              <div className="onb-alert onb-alert-blue" style={{ marginBottom: 24 }}>
                <p className="onb-alert-title">🔒 Your data is secure</p>
                <p className="onb-alert-body">Document numbers are only shared with verified hospital staff. You can update them anytime.</p>
              </div>
              {/* Summary */}
              <div className="onb-summary">
                <p className="onb-summary-title">✅ Profile Summary</p>
                {[
                  ["Date of Birth", form.date_of_birth],
                  ["Gender", form.gender],
                  ["Blood Group", form.blood_group],
                  ["City", form.city],
                  ["Allergies", form.allergies.join(", ") || "None"],
                  ["Conditions", form.chronic_diseases.join(", ") || "None"],
                  ["Emergency Contact", form.emergency_contact_name + (form.emergency_contact_relation ? ` (${form.emergency_contact_relation})` : "")],
                  ["Emergency Phone", form.emergency_contact_phone],
                ].map(([k, v]) => (
                  <div key={k} className="onb-summary-row">
                    <span className="onb-summary-key">{k}</span>
                    <span className="onb-summary-val">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="onb-nav">
            {step > 1 && (
              <button className="onb-btn-back" onClick={() => setStep(s => s - 1)}>← Back</button>
            )}
            {step < 4 ? (
              <button className="onb-btn-next" onClick={() => setStep(s => s + 1)} disabled={!canNext()}>
                Continue →
              </button>
            ) : (
              <button className="onb-btn-next" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving…" : "✓ Complete Setup"}
              </button>
            )}
          </div>
          {step < 4 && (
            <button className="onb-btn-skip" onClick={() => (onSkip ?? onComplete)?.()}>
              Skip for now — fill in later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
