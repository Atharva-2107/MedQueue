// src/components/dashboard/PatientDashboard.jsx
// Full patient dashboard: Home, My Health, Book a Bed, Ambulance/SOS, Hospitals, My Bookings
import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, DashboardHeader, InfoRow, AlertBox,
} from "../shared/UIComponents";

/* ──────────────────────────────────────────
   BookBedModal
────────────────────────────────────────── */
function BookBedModal({ hospital, beds, userId, onClose, onBooked }) {
  const [selectedBed, setSelectedBed] = useState(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const availBeds = beds.filter(b => b.hospital_id === hospital.id && b.status === "available");

  const book = async () => {
    if (!selectedBed) return setErr("Please select an available bed.");
    setSaving(true); setErr("");
    try {
      const { error } = await supabase.from("bookings").insert({
        patient_id: userId,
        hospital_id: hospital.id,
        bed_id: selectedBed.id,
        status: "pending",
        notes: reason || null,
      });
      if (error) throw error;
      onBooked();
      onClose();
    } catch (e) {
      setErr(e.message || "Booking failed. Please try again.");
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h3 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>🛏️ Book a Bed</h3>
            <p style={{ fontSize: 13, color: "#64748b", margin: "4px 0 0" }}>{hospital.name}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer" }}>✕</button>
        </div>

        {err && <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fef2f2", color: "#dc2626", fontSize: 13, marginBottom: 16, border: "1px solid #fecaca" }}>{err}</div>}

        {availBeds.length === 0 ? (
          <div style={{ textAlign: "center", padding: "24px 0", color: "#dc2626" }}>
            <span style={{ fontSize: 32 }}>😔</span>
            <p style={{ marginTop: 8, fontWeight: 700 }}>No beds available at this hospital right now.</p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
              Select a Bed ({availBeds.length} available)
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 16, maxHeight: 200, overflowY: "auto" }}>
              {availBeds.map(bed => (
                <button key={bed.id} onClick={() => setSelectedBed(bed)} style={{
                  padding: "10px 4px", borderRadius: 12, border: `2px solid ${selectedBed?.id === bed.id ? "#10b981" : "#e2e8f0"}`,
                  background: selectedBed?.id === bed.id ? "#ecfdf5" : "#f8fafc",
                  color: selectedBed?.id === bed.id ? "#059669" : "#475569",
                  fontSize: 11, fontWeight: 800, cursor: "pointer", textAlign: "center",
                }}>
                  {bed.bed_number}
                  <br />
                  <span style={{ fontSize: 10, fontWeight: 500 }}>{bed.bed_type}</span>
                </button>
              ))}
            </div>

            {selectedBed && (
              <div style={{ padding: "10px 14px", borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", marginBottom: 16 }}>
                <p style={{ fontSize: 12, color: "#059669", fontWeight: 700, margin: 0 }}>
                  ✅ Selected: Bed {selectedBed.bed_number} — {selectedBed.bed_type}
                  {selectedBed.floor ? `, Floor ${selectedBed.floor}` : ""}
                  {selectedBed.ward ? `, ${selectedBed.ward}` : ""}
                </p>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 6 }}>Reason (optional)</label>
              <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="Brief reason for admission..."
                style={{ width: "100%", padding: "10px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit" }} />
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0", background: "#f8fafc", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
          {availBeds.length > 0 && (
            <button onClick={book} disabled={saving || !selectedBed} style={{
              flex: 2, padding: "12px", borderRadius: 12, border: "none",
              background: saving ? "#94a3b8" : "#10b981", color: "#fff", fontWeight: 900, cursor: "pointer",
              boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
            }}>
              {saving ? "Booking..." : "Confirm Booking"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   SOSModal - sends ping to all available ambulances
────────────────────────────────────────── */
function SOSModal({ userId, onClose }) {
  const [status, setStatus] = useState("idle"); // idle | locating | sending | sent | error
  const [message, setMessage] = useState("");

  const sendSOS = async () => {
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setStatus("sending");
        const { lat, lng } = { lat: pos.coords.latitude, lng: pos.coords.longitude };

        // Insert emergency_request
        await supabase.from("emergency_requests").insert({
          phone: "", // optional - could pull from user profile
          type: "Emergency Ambulance",
          lat, lng,
          status: "pending",
        });

        // Insert a dispatch request visible to all available drivers
        await supabase.from("dispatches").insert({
          patient_id: userId,
          ambulance_id: null, // driver will claim it
          status: "pending",
          pickup_lat: lat,
          pickup_lng: lng,
          pickup_address: `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
          notes: "EMERGENCY SOS — Patient needs immediate ambulance",
        });

        setStatus("sent");
        setMessage(`📍 SOS sent! Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      },
      () => {
        setStatus("error");
        setMessage("Location access denied. Please enable location and try again.");
      },
      { enableHighAccuracy: true }
    );
  };

  useEffect(() => { sendSOS(); }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(220,38,38,0.1)", backdropFilter: "blur(4px)" }}>
      <div style={{ width: "100%", maxWidth: 380, background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 24px 64px rgba(220,38,38,0.2)", textAlign: "center", border: "1px solid #fecaca" }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%", background: "#fef2f2",
          margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 28, animation: status === "locating" || status === "sending" ? "pulse 1s infinite" : "none",
        }}>🆘</div>
        <style>{`@keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.1)} }`}</style>

        {status === "locating" && <>
          <h3 style={{ color: "#dc2626", fontWeight: 900, marginBottom: 8 }}>Getting Your Location...</h3>
          <p style={{ color: "#64748b", fontSize: 13 }}>Please allow location access when prompted.</p>
        </>}
        {status === "sending" && <>
          <h3 style={{ color: "#dc2626", fontWeight: 900, marginBottom: 8 }}>Sending SOS...</h3>
          <p style={{ color: "#64748b", fontSize: 13 }}>Broadcasting to nearest ambulances.</p>
        </>}
        {status === "sent" && <>
          <h3 style={{ color: "#059669", fontWeight: 900, marginBottom: 8 }}>✅ SOS Sent!</h3>
          <p style={{ color: "#475569", fontSize: 13, marginBottom: 8 }}>{message}</p>
          <p style={{ color: "#64748b", fontSize: 12 }}>Available drivers have been notified and can accept your request.</p>
        </>}
        {status === "error" && <>
          <h3 style={{ color: "#dc2626", fontWeight: 900, marginBottom: 8 }}>Location Error</h3>
          <p style={{ color: "#475569", fontSize: 13 }}>{message}</p>
        </>}

        <button onClick={onClose} style={{
          marginTop: 20, width: "100%", padding: "12px", borderRadius: 12, border: "1px solid #e2e8f0",
          background: status === "sent" ? "#10b981" : "#f8fafc",
          color: status === "sent" ? "#fff" : "#64748b", fontWeight: 700, cursor: "pointer",
        }}>
          {status === "sent" ? "Close & Track" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────
   Main PatientDashboard
────────────────────────────────────────── */
export default function PatientDashboard({ section }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [ambulances, setAmbulances] = useState([]);
  const [allBeds, setAllBeds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bookModal, setBookModal] = useState(null); // hospital object
  const [showSOS, setShowSOS] = useState(false);
  const [bookSuccess, setBookSuccess] = useState("");

  const reload = async () => {
    if (!user) return;
    setLoading(true);
    const [p, h, a, b, bk, d] = await Promise.all([
      supabase.from("patient_profiles").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("hospitals").select("*").eq("is_active", true).order("name"),
      supabase.from("ambulances").select("*").eq("status", "available").order("vehicle_number"),
      supabase.from("beds").select("*").eq("status", "available"),
      supabase.from("bookings").select("*, hospitals(name), beds(bed_number, bed_type, ward)").eq("patient_id", user.id).order("booked_at", { ascending: false }).limit(20),
      supabase.from("dispatches").select("*, hospitals(name)").eq("patient_id", user.id).order("requested_at", { ascending: false }).limit(10),
    ]);
    setProfile(p.data);
    setHospitals(h.data || []);
    setAmbulances(a.data || []);
    setAllBeds(b.data || []);
    setBookings(bk.data || []);
    setDispatches(d.data || []);
    setLoading(false);
  };

  useEffect(() => { reload(); }, [user]);

  const firstName = user?.full_name?.split(" ")[0] || "there";
  if (loading) return <LoadingSpinner />;

  /* ════════ HOME ════════ */
  if (section === "home" || !section) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showSOS && <SOSModal userId={user.id} onClose={() => { setShowSOS(false); reload(); }} />}

      <DashboardHeader
        title={`Welcome back, ${firstName} 👋`}
        subtitle={`${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`}
        badge={profile?.blood_group ? `🩸 ${profile.blood_group}` : undefined}
        badgeColor="red"
      />

      {!profile && <AlertBox type="warning">Complete your health profile in "My Health" for emergency support.</AlertBox>}
      {bookSuccess && <AlertBox type="success">{bookSuccess}</AlertBox>}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon="🏥" label="Hospitals Available" value={hospitals.length} color="blue" />
        <StatCard icon="🚑" label="Ambulances Ready" value={ambulances.length} color="emerald" />
        <StatCard icon="🛏️" label="Free Beds City-Wide" value={allBeds.length} color="violet" />
        <StatCard icon="📋" label="My Bookings" value={bookings.length} color="amber" />
      </div>

      {/* SOS Banner */}
      <div style={{
        borderRadius: 16, padding: "20px 24px", border: "1px solid #fecaca",
        background: "linear-gradient(135deg, #fef2f2 0%, #fff 60%)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>🆘</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#dc2626", margin: 0 }}>Emergency? Act Now.</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>Sends your GPS location to nearest ambulance drivers</p>
          </div>
        </div>
        <button onClick={() => setShowSOS(true)} style={{
          padding: "12px 32px", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
          fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 0.5,
          boxShadow: "0 4px 16px rgba(220,38,38,0.35)", whiteSpace: "nowrap",
        }}>
          🚨 SOS — Get Ambulance
        </button>
      </div>

      {/* Hospitals with Book button */}
      <div>
        <SectionTitle>🏥 Hospitals Near You</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hospitals.length === 0
            ? <EmptyState icon="🏥" message="No hospitals found — run the schema.sql to seed hospitals" />
            : hospitals.slice(0, 5).map(h => {
              const hBeds = allBeds.filter(b => b.hospital_id === h.id);
              return (
                <Card key={h.id} style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ display: "flex" }}>
                    <div style={{
                      width: 4, flexShrink: 0,
                      background: (h.available_beds || 0) > 10 ? "#10b981" : (h.available_beds || 0) > 0 ? "#f59e0b" : "#ef4444",
                    }} />
                    <div style={{ flex: 1, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
                        <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}, {h.city}</p>
                        <div style={{ maxWidth: 280 }}>
                          <BedBar label="Available Beds" available={h.available_beds} total={h.total_beds} />
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                        <span style={{
                          padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                          background: hBeds.length > 0 ? "#ecfdf5" : "#fef2f2",
                          color: hBeds.length > 0 ? "#059669" : "#dc2626",
                          border: `1px solid ${hBeds.length > 0 ? "#a7f3d0" : "#fecaca"}`,
                        }}>
                          {hBeds.length} free
                        </span>
                        <button
                          onClick={() => setBookModal(h)}
                          disabled={hBeds.length === 0}
                          style={{
                            padding: "8px 18px", borderRadius: 12, border: "none",
                            background: hBeds.length > 0 ? "#10b981" : "#e2e8f0",
                            color: hBeds.length > 0 ? "#fff" : "#94a3b8",
                            fontSize: 12, fontWeight: 800, cursor: hBeds.length > 0 ? "pointer" : "not-allowed",
                            boxShadow: hBeds.length > 0 ? "0 2px 8px rgba(16,185,129,0.3)" : "none",
                          }}>
                          {hBeds.length > 0 ? "📋 Book Bed" : "Full"}
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      {/* Booking modal */}
      {bookModal && (
        <BookBedModal
          hospital={bookModal} beds={allBeds} userId={user.id}
          onClose={() => setBookModal(null)}
          onBooked={() => { setBookSuccess("✅ Bed booked! Hospital staff will confirm shortly."); reload(); }}
        />
      )}
    </div>
  );

  /* ════════ MY HEALTH ════════ */
  if (section === "health") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🩺 My Health Profile" subtitle="Your medical information on file" />
      {!profile ? (
        <AlertBox type="info">No health profile found. Go through onboarding to set it up.</AlertBox>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
            {[
              ["Blood Group", profile.blood_group || "Not set", "🩸", "red"],
              ["Gender", profile.gender || "Not set", "👤", "blue"],
              ["Date of Birth", profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString("en-IN") : "Not set", "📅", "violet"],
              ["City", profile.city || "Not set", "📍", "cyan"],
            ].map(([k, v, ico, color]) => (
              <StatCard key={k} icon={ico} label={k} value={v} color={color} />
            ))}
          </div>

          {profile.allergies?.length > 0 && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>⚠️ Known Allergies</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.allergies.map(a => (
                  <span key={a} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa" }}>{a}</span>
                ))}
              </div>
            </Card>
          )}

          {profile.chronic_diseases?.length > 0 && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🏥 Chronic Conditions</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.chronic_diseases.map(d => (
                  <span key={d} style={{ padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe" }}>{d}</span>
                ))}
              </div>
            </Card>
          )}

          {profile.emergency_contact_name && (
            <Card style={{ borderColor: "#fecaca" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>🆘 Emergency Contact</p>
              <InfoRow label="Name" value={profile.emergency_contact_name} icon="👤" />
              <InfoRow label="Phone" value={profile.emergency_contact_phone} icon="📞" />
              <InfoRow label="Relation" value={profile.emergency_contact_relation} icon="🤝" />
            </Card>
          )}
          {profile.medical_notes && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>📝 Medical Notes</p>
              <p style={{ fontSize: 13, color: "#475569", lineHeight: 1.6, margin: 0 }}>{profile.medical_notes}</p>
            </Card>
          )}
        </>
      )}
    </div>
  );

  /* ════════ BOOK A BED ════════ */
  if (section === "book") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {bookModal && (
        <BookBedModal hospital={bookModal} beds={allBeds} userId={user.id}
          onClose={() => setBookModal(null)}
          onBooked={() => { setBookSuccess("✅ Bed booked!"); reload(); setBookModal(null); }} />
      )}
      <DashboardHeader title="🛏️ Book a Bed" subtitle="Reserve a bed at any hospital" />
      {bookSuccess && <AlertBox type="success">{bookSuccess}</AlertBox>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {hospitals.length === 0
          ? <EmptyState icon="🏥" message="No hospitals available" />
          : hospitals.map(h => {
            const hBeds = allBeds.filter(b => b.hospital_id === h.id);
            return (
              <Card key={h.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}</p>
                    <BedBar label="Available" available={h.available_beds} total={h.total_beds} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                    <span style={{
                      padding: "4px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                      background: hBeds.length > 0 ? "#ecfdf5" : "#fef2f2",
                      color: hBeds.length > 0 ? "#059669" : "#dc2626",
                      border: `1px solid ${hBeds.length > 0 ? "#a7f3d0" : "#fecaca"}`,
                    }}>{hBeds.length} beds free</span>
                    <button
                      onClick={() => setBookModal(h)}
                      disabled={hBeds.length === 0}
                      style={{
                        padding: "10px 22px", borderRadius: 12, border: "none",
                        background: hBeds.length > 0 ? "#10b981" : "#e2e8f0",
                        color: hBeds.length > 0 ? "#fff" : "#94a3b8",
                        fontWeight: 800, fontSize: 13, cursor: hBeds.length > 0 ? "pointer" : "not-allowed",
                      }}>Book Now</button>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </div>
  );

  /* ════════ AMBULANCE ════════ */
  if (section === "ambulance") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showSOS && <SOSModal userId={user.id} onClose={() => { setShowSOS(false); reload(); }} />}
      <DashboardHeader title="🚑 Ambulance Services" subtitle="Request emergency help or track nearby ambulances" />

      {/* SOS Card */}
      <Card style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
          <div style={{ width: 52, height: 52, borderRadius: 16, background: "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26 }}>🆘</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 900, color: "#dc2626", margin: 0 }}>Emergency Ambulance Request</p>
            <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>Sends your live GPS location to all available ambulance drivers nearby</p>
          </div>
        </div>
        <button onClick={() => setShowSOS(true)} style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
          fontSize: 15, fontWeight: 900, cursor: "pointer", boxShadow: "0 4px 16px rgba(220,38,38,0.3)",
        }}>🚨 Request Emergency Ambulance</button>
      </Card>

      {/* Nearby available ambulances */}
      <div>
        <SectionTitle>🚑 Available Ambulances Nearby ({ambulances.length})</SectionTitle>
        {ambulances.length === 0
          ? <EmptyState icon="🚑" message="No ambulances available right now" />
          : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {ambulances.map(a => (
                <Card key={a.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🚑</div>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{a.vehicle_number || "—"}</p>
                        <p style={{ fontSize: 12, color: "#64748b", margin: "2px 0 0" }}>{a.ambulance_type || "Basic Life Support"}</p>
                        {a.last_location_update && (
                          <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0" }}>Last seen: {new Date(a.last_location_update).toLocaleTimeString("en-IN")}</p>
                        )}
                      </div>
                    </div>
                    <span style={{
                      padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 800,
                      background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0",
                      display: "flex", alignItems: "center", gap: 6,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10b981", display: "inline-block" }} />
                      Available
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </div>

      {/* My dispatch history */}
      {dispatches.length > 0 && (
        <div>
          <SectionTitle>📡 My Dispatch History</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {dispatches.map(d => (
              <Card key={d.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <StatusBadge status={d.status} />
                    <p style={{ fontSize: 12, color: "#475569", margin: "6px 0 0" }}>{d.pickup_address || "GPS Location"}</p>
                    {d.hospitals && <InfoRow label="Hospital" value={d.hospitals.name} icon="🏥" />}
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8" }}>{new Date(d.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ════════ HOSPITALS ════════ */
  if (section === "hospitals") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🏥 All Hospitals" subtitle={`${hospitals.length} hospitals registered`} />
      {hospitals.map(h => (
        <Card key={h.id}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}, {h.city}</p>
              <BedBar label="Available Beds" available={h.available_beds} total={h.total_beds} />
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, margin: 0 }}>Available</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>{h.available_beds || 0}</p>
              <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>of {h.total_beds || 0}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );

  /* ════════ MY BOOKINGS ════════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 My Bookings" subtitle="Your hospital admission history" />
      {bookings.length === 0
        ? <EmptyState icon="🛏️" message="No bookings yet. Book a bed from the Hospitals section." />
        : bookings.map(b => (
          <Card key={b.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{b.hospitals?.name}</p>
                  <StatusBadge status={b.status} />
                </div>
                <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                  {b.beds?.bed_type?.toUpperCase() || "—"} — Bed {b.beds?.bed_number || "—"}
                  {b.beds?.ward ? `, ${b.beds.ward}` : ""}
                </p>
                {b.notes && <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>📋 {b.notes}</p>}
              </div>
              <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "right", flexShrink: 0 }}>
                {new Date(b.booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          </Card>
        ))
      }
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}