// src/components/dashboard/PatientDashboard.jsx — Light mode, Supabase-direct
import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import {
  StatCard, StatusBadge, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, DashboardHeader, InfoRow, AlertBox,
} from "../shared/UIComponents";

export default function PatientDashboard({ section }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      // Fetch patient profile
      const { data: p } = await supabase
        .from("patient_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      setProfile(p);

      // Fetch hospitals
      const { data: h } = await supabase
        .from("hospitals")
        .select("*")
        .eq("is_active", true)
        .order("name");
      setHospitals(h || []);

      // Fetch bookings
      const { data: b } = await supabase
        .from("bookings")
        .select("*, hospitals(name), beds(bed_number, bed_type, ward)")
        .eq("patient_id", user.id)
        .order("booked_at", { ascending: false })
        .limit(20);
      setBookings(b || []);

      setLoading(false);
    };
    load();
  }, [user]);

  const firstName = user?.full_name?.split(" ")[0] || "there";

  if (loading) return <LoadingSpinner />;

  /* ════════ HOME ════════ */
  if (section === "home" || !section) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader
        title={`Welcome back, ${firstName} 👋`}
        subtitle={`Your health dashboard — ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}`}
        badge={profile?.blood_group ? `🩸 ${profile.blood_group}` : undefined}
        badgeColor="red"
      />

      {!profile && (
        <AlertBox type="warning">
          Your health profile is incomplete — tap "My Health" to fill it in for emergency support.
        </AlertBox>
      )}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <StatCard icon="🏥" label="Nearby Hospitals" value={hospitals.length} color="blue" />
        <StatCard icon="🛏️" label="Total Bookings" value={bookings.length} color="violet" />
        <StatCard icon="🩸" label="Blood Group" value={profile?.blood_group || "—"} sub={profile?.blood_group ? "On file" : "Not set"} color="red" />
        <StatCard icon="📞" label="Emergency Contact" value={profile?.emergency_contact_name || "—"} sub={profile?.emergency_contact_phone || "Not set"} color="amber" />
      </div>

      {/* Quick Hospitals */}
      <div>
        <SectionTitle>🏥 Hospitals Near You</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {hospitals.length === 0
            ? <EmptyState icon="🏥" message="No hospitals found" />
            : hospitals.slice(0, 5).map(h => (
              <Card key={h.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
                    <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}, {h.city}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 300 }}>
                      <BedBar label="Beds" available={h.available_beds} total={h.total_beds} />
                    </div>
                  </div>
                  <span style={{
                    padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                    background: (h.available_beds || 0) > 5 ? "#ecfdf5" : (h.available_beds || 0) > 0 ? "#fffbeb" : "#fef2f2",
                    color: (h.available_beds || 0) > 5 ? "#059669" : (h.available_beds || 0) > 0 ? "#d97706" : "#dc2626",
                    border: `1px solid ${(h.available_beds || 0) > 5 ? "#a7f3d0" : (h.available_beds || 0) > 0 ? "#fde68a" : "#fecaca"}`,
                  }}>
                    {h.available_beds || 0} beds
                  </span>
                </div>
              </Card>
            ))
          }
        </div>
      </div>
    </div>
  );

  /* ════════ MY HEALTH ════════ */
  if (section === "health") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🩺 My Health Profile" subtitle="Your medical information on file" />

      {!profile ? (
        <AlertBox type="info">No health profile found. Complete your onboarding to see your data here.</AlertBox>
      ) : (
        <>
          {/* Info cards */}
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

          {/* Allergies */}
          {profile.allergies?.length > 0 && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#ea580c", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                ⚠️ Known Allergies
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.allergies.map(a => (
                  <span key={a} style={{
                    padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: "#fff7ed", color: "#c2410c", border: "1px solid #fed7aa",
                  }}>{a}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Chronic diseases */}
          {profile.chronic_diseases?.length > 0 && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                🏥 Chronic Conditions
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {profile.chronic_diseases.map(d => (
                  <span key={d} style={{
                    padding: "4px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe",
                  }}>{d}</span>
                ))}
              </div>
            </Card>
          )}

          {/* Emergency Contact */}
          {profile.emergency_contact_name && (
            <Card style={{ borderColor: "#fecaca" }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                🆘 Emergency Contact
              </p>
              <InfoRow label="Name" value={profile.emergency_contact_name} icon="👤" />
              <InfoRow label="Phone" value={profile.emergency_contact_phone} icon="📞" />
              <InfoRow label="Relation" value={profile.emergency_contact_relation} icon="🤝" />
            </Card>
          )}

          {/* Medical Notes */}
          {profile.medical_notes && (
            <Card>
              <p style={{ fontSize: 12, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                📝 Medical Notes
              </p>
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
      <DashboardHeader title="🛏️ Book a Bed" subtitle="Check availability and reserve a bed" />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {hospitals.length === 0
          ? <EmptyState icon="🏥" message="No hospitals available" />
          : hospitals.map(h => (
            <Card key={h.id}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
                  <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 8px" }}>📍 {h.address}</p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, maxWidth: 300 }}>
                    <BedBar label="General" available={h.available_beds} total={h.total_beds} />
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                  <span style={{
                    padding: "4px 14px", borderRadius: 12, fontSize: 12, fontWeight: 800,
                    background: (h.available_beds || 0) > 0 ? "#ecfdf5" : "#fef2f2",
                    color: (h.available_beds || 0) > 0 ? "#059669" : "#dc2626",
                    border: `1px solid ${(h.available_beds || 0) > 0 ? "#a7f3d0" : "#fecaca"}`,
                  }}>
                    {h.available_beds || 0} available
                  </span>
                  {(h.available_beds || 0) > 0 && (
                    <button style={{
                      padding: "8px 20px", borderRadius: 12, border: "none",
                      background: "#10b981", color: "#fff", fontSize: 12, fontWeight: 800,
                      cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,0.3)",
                    }}>
                      Book Now
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))
        }
      </div>
    </div>
  );

  /* ════════ AMBULANCE ════════ */
  if (section === "ambulance") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🚑 Ambulance Services" subtitle="Request & track emergency ambulances" />
      <Card style={{ borderColor: "#fecaca", background: "#fef2f2" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14, background: "#fee2e2",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24,
          }}>🆘</div>
          <div>
            <p style={{ fontSize: 16, fontWeight: 800, color: "#dc2626", margin: 0 }}>Emergency? Act Now.</p>
            <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>We'll dispatch the nearest ambulance to your location</p>
          </div>
        </div>
        <button style={{
          width: "100%", padding: "14px", borderRadius: 14, border: "none",
          background: "linear-gradient(135deg, #dc2626, #ef4444)", color: "#fff",
          fontSize: 14, fontWeight: 900, cursor: "pointer", letterSpacing: 0.5,
          boxShadow: "0 4px 16px rgba(220,38,38,0.3)",
        }}>
          🚨 Request Emergency Ambulance
        </button>
      </Card>
      <EmptyState icon="🚑" message="No active ambulance dispatches" />
    </div>
  );

  /* ════════ HOSPITALS ════════ */
  if (section === "hospitals") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🏥 All Hospitals" subtitle={`${hospitals.length} hospitals registered`} />
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {hospitals.map(h => (
          <Card key={h.id}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", margin: 0 }}>{h.name}</p>
                <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 10px" }}>📍 {h.address}, {h.city}</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 320 }}>
                  <BedBar label="General Beds" available={h.available_beds} total={h.total_beds} />
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, margin: 0 }}>Available</p>
                <p style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", margin: 0 }}>{h.available_beds || 0}</p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: 0 }}>of {h.total_beds || 0}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  /* ════════ MY BOOKINGS ════════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 My Bookings" subtitle="Your hospital admission history" />
      {bookings.length === 0
        ? <EmptyState icon="🛏️" message="No bookings yet" />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {bookings.map(b => (
              <Card key={b.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <p style={{ fontSize: 14, fontWeight: 800, color: "#0f172a", margin: 0 }}>{b.hospitals?.name}</p>
                      <StatusBadge status={b.status} />
                    </div>
                    <p style={{ fontSize: 12, color: "#64748b", margin: 0 }}>
                      {b.beds?.bed_type?.toUpperCase()} — Bed {b.beds?.bed_number}
                      {b.beds?.ward ? `, ${b.beds.ward}` : ""}
                    </p>
                  </div>
                  <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                    {new Date(b.booked_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )
      }
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}