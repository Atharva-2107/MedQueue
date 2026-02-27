// src/components/onboarding/PatientOnboarding.jsx
import React, { useState } from "react";
import api from "../../lib/api";

const STEPS = [
  { id: 1, title: "Personal Details",    icon: "👤" },
  { id: 2, title: "Medical Information", icon: "🩺" },
  { id: 3, title: "Emergency Contact",   icon: "🆘" },
  { id: 4, title: "Documents",           icon: "📋" },
];

const BLOOD_GROUPS  = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const GENDERS       = ["male","female","other"];
const COMMON_ALLERGIES = ["Penicillin","Aspirin","Sulfa","Latex","Shellfish","Nuts","Pollen"];
const COMMON_DISEASES  = ["Diabetes","Hypertension","Asthma","Heart Disease","Thyroid","Kidney Disease"];

export default function PatientOnboarding({ onComplete }) {
  const [step,    setStep]    = useState(1);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");
  const [form,    setForm]    = useState({
    date_of_birth: "", gender: "", blood_group: "",
    allergies: [], chronic_diseases: [],
    emergency_contact_name: "", emergency_contact_phone: "",
    aadhar_number: "", insurance_id: "",
    address: "", city: "Pune", medical_notes: "",
  });

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const toggleArray = (field, val) =>
    setForm((p) => ({
      ...p,
      [field]: p[field].includes(val)
        ? p[field].filter((v) => v !== val)
        : [...p[field], val],
    }));

  const handleSubmit = async () => {
    try {
      setSaving(true); setError("");
      await api.post("/dashboard/patient/onboarding", form);
      onComplete?.();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save profile");
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
    <div className="min-h-screen bg-[#080c12] flex items-center justify-center p-4" style={{fontFamily:"'DM Sans',sans-serif"}}>
      {/* Glow bg */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/8 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm font-medium mb-4">
            <span>🏥</span> JeevanSetu — Patient Setup
          </div>
          <h1 className="text-3xl font-black text-white mb-2">Complete Your Health Profile</h1>
          <p className="text-white/40 text-sm">This helps hospitals provide faster, better care during emergencies</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 transition-all duration-300 ${
                  step > s.id  ? "bg-emerald-500 border-emerald-500 scale-90" :
                  step === s.id ? "bg-white/10 border-emerald-400 scale-110 shadow-lg shadow-emerald-500/20" :
                  "bg-white/5 border-white/20"
                }`}>
                  {step > s.id ? "✓" : s.icon}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${step === s.id ? "text-emerald-400" : "text-white/30"}`}>
                  {s.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 transition-all duration-500 ${step > s.id ? "bg-emerald-500" : "bg-white/10"}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Form Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
          )}

          {/* STEP 1: Personal Details */}
          {step === 1 && (
            <div className="space-y-5">
              <StepHeader icon="👤" title="Personal Details" desc="Basic information about you" />

              <Field label="Date of Birth *">
                <input type="date" value={form.date_of_birth}
                  onChange={(e) => update("date_of_birth", e.target.value)}
                  className={inputClass} />
              </Field>

              <Field label="Gender *">
                <div className="grid grid-cols-3 gap-3">
                  {GENDERS.map((g) => (
                    <button key={g} onClick={() => update("gender", g)}
                      className={`py-3 rounded-xl border text-sm font-semibold capitalize transition-all ${
                        form.gender === g
                          ? "border-emerald-400 bg-emerald-500/20 text-emerald-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/30"
                      }`}>
                      {g === "male" ? "♂ Male" : g === "female" ? "♀ Female" : "⚧ Other"}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Blood Group *">
                <div className="grid grid-cols-4 gap-2">
                  {BLOOD_GROUPS.map((bg) => (
                    <button key={bg} onClick={() => update("blood_group", bg)}
                      className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                        form.blood_group === bg
                          ? "border-red-400 bg-red-500/20 text-red-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/30"
                      }`}>
                      {bg}
                    </button>
                  ))}
                </div>
              </Field>

              <div className="grid grid-cols-2 gap-4">
                <Field label="City">
                  <input type="text" placeholder="Pune" value={form.city}
                    onChange={(e) => update("city", e.target.value)}
                    className={inputClass} />
                </Field>
                <Field label="Address">
                  <input type="text" placeholder="Your address" value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                    className={inputClass} />
                </Field>
              </div>
            </div>
          )}

          {/* STEP 2: Medical Info */}
          {step === 2 && (
            <div className="space-y-5">
              <StepHeader icon="🩺" title="Medical Information" desc="Helps doctors treat you faster in emergencies" />

              <Field label="Known Allergies">
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_ALLERGIES.map((a) => (
                    <button key={a} onClick={() => toggleArray("allergies", a)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        form.allergies.includes(a)
                          ? "border-orange-400 bg-orange-500/20 text-orange-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/30"
                      }`}>
                      {a}
                    </button>
                  ))}
                </div>
                <input type="text" placeholder="Other allergies (comma separated)"
                  className={inputClass}
                  onBlur={(e) => {
                    const extras = e.target.value.split(",").map(s => s.trim()).filter(Boolean);
                    extras.forEach(ex => { if (!form.allergies.includes(ex)) toggleArray("allergies", ex); });
                    e.target.value = "";
                  }} />
              </Field>

              <Field label="Chronic Conditions">
                <div className="flex flex-wrap gap-2 mb-2">
                  {COMMON_DISEASES.map((d) => (
                    <button key={d} onClick={() => toggleArray("chronic_diseases", d)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                        form.chronic_diseases.includes(d)
                          ? "border-violet-400 bg-violet-500/20 text-violet-300"
                          : "border-white/10 bg-white/5 text-white/50 hover:border-white/30"
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Additional Medical Notes">
                <textarea rows={3} placeholder="Any other medical conditions, current medications, or important notes..."
                  value={form.medical_notes}
                  onChange={(e) => update("medical_notes", e.target.value)}
                  className={`${inputClass} resize-none`} />
              </Field>
            </div>
          )}

          {/* STEP 3: Emergency Contact */}
          {step === 3 && (
            <div className="space-y-5">
              <StepHeader icon="🆘" title="Emergency Contact" desc="Who should we call if you can't respond?" />

              <Field label="Contact Name *">
                <input type="text" placeholder="Full name of emergency contact"
                  value={form.emergency_contact_name}
                  onChange={(e) => update("emergency_contact_name", e.target.value)}
                  className={inputClass} />
              </Field>

              <Field label="Contact Phone *">
                <input type="tel" placeholder="+91 98765 43210"
                  value={form.emergency_contact_phone}
                  onChange={(e) => update("emergency_contact_phone", e.target.value)}
                  className={inputClass} />
              </Field>

              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-amber-300 text-sm font-medium mb-1">⚡ Why this matters</p>
                <p className="text-white/50 text-xs">During an emergency, hospital staff and ambulance drivers will contact this person if you're unable to communicate.</p>
              </div>
            </div>
          )}

          {/* STEP 4: Documents */}
          {step === 4 && (
            <div className="space-y-5">
              <StepHeader icon="📋" title="Documents (Optional)" desc="Speeds up hospital admission — can be added later" />

              <Field label="Aadhar Number">
                <input type="text" placeholder="XXXX XXXX XXXX"
                  value={form.aadhar_number}
                  onChange={(e) => update("aadhar_number", e.target.value)}
                  className={inputClass} maxLength={14} />
              </Field>

              <Field label="Insurance / CGHS ID">
                <input type="text" placeholder="Insurance policy or CGHS ID"
                  value={form.insurance_id}
                  onChange={(e) => update("insurance_id", e.target.value)}
                  className={inputClass} />
              </Field>

              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <p className="text-blue-300 text-sm font-medium mb-1">🔒 Your data is secure</p>
                <p className="text-white/50 text-xs">Document numbers are encrypted and only shared with verified hospital staff during admitted care. You can update or remove them anytime.</p>
              </div>

              {/* Summary */}
              <div className="pt-4 border-t border-white/10 space-y-2">
                <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-3">Profile Summary</p>
                {[
                  ["Date of Birth", form.date_of_birth],
                  ["Gender", form.gender],
                  ["Blood Group", form.blood_group],
                  ["City", form.city],
                  ["Allergies", form.allergies.join(", ") || "None"],
                  ["Conditions", form.chronic_diseases.join(", ") || "None"],
                  ["Emergency Contact", form.emergency_contact_name],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between text-sm">
                    <span className="text-white/40">{k}</span>
                    <span className="text-white/80 font-medium capitalize">{v || "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button onClick={() => setStep((s) => s - 1)}
                className="flex-1 py-3 rounded-xl border border-white/20 bg-white/5 text-white/70 font-semibold hover:bg-white/10 transition-all">
                ← Back
              </button>
            )}
            {step < 4 ? (
              <button onClick={() => setStep((s) => s + 1)} disabled={!canNext()}
                className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
                  canNext()
                    ? "bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/30"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}>
                Continue →
              </button>
            ) : (
              <button onClick={handleSubmit} disabled={saving}
                className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg shadow-emerald-500/30 transition-all disabled:opacity-50">
                {saving ? "Saving..." : "✓ Complete Setup"}
              </button>
            )}
          </div>

          {step < 4 && (
            <button onClick={() => onComplete?.()}
              className="w-full mt-3 text-xs text-white/30 hover:text-white/50 transition-colors">
              Skip for now — fill in later
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Small helpers
const StepHeader = ({ icon, title, desc }) => (
  <div className="mb-6">
    <div className="text-4xl mb-2">{icon}</div>
    <h2 className="text-xl font-bold text-white">{title}</h2>
    <p className="text-white/40 text-sm">{desc}</p>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">{label}</label>
    {children}
  </div>
);

const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 focus:outline-none focus:border-emerald-400/60 focus:bg-white/8 transition-all";
