// src/components/dashboard/StaffDashboard.jsx — Light mode, Supabase-direct
import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../hooks/useAuth";
import { supabase } from "../../supabaseClient";
import {
  StatCard, SectionTitle, EmptyState, LoadingSpinner,
  Card, BedBar, DashboardHeader, InfoRow, StatusBadge, AlertBox,
} from "../shared/UIComponents";

export default function StaffDashboard({ section }) {
  const { user } = useAuth();
  const [hospital, setHospital] = useState(null);
  const [beds, setBeds] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [admitted, setAdmitted] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Find staff's hospital
    let hosp = null;
    if (user.hospital_id) {
      const { data } = await supabase.from("hospitals").select("*").eq("id", user.hospital_id).maybeSingle();
      hosp = data;
    }
    if (!hosp) {
      // If no hospital linked, try first hospital
      const { data } = await supabase.from("hospitals").select("*").limit(1).maybeSingle();
      hosp = data;
    }
    setHospital(hosp);

    if (hosp) {
      const { data: b } = await supabase.from("beds").select("*").eq("hospital_id", hosp.id).order("bed_number");
      setBeds(b || []);

      const { data: bk } = await supabase
        .from("bookings")
        .select("*, beds(bed_number, bed_type, ward)")
        .eq("hospital_id", hosp.id)
        .in("status", ["pending", "confirmed"])
        .order("booked_at", { ascending: false });
      setBookings(bk || []);

      const { data: a } = await supabase
        .from("bookings")
        .select("*, beds(bed_number, bed_type, ward)")
        .eq("hospital_id", hosp.id)
        .eq("status", "admitted")
        .order("admitted_at", { ascending: false });
      setAdmitted(a || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingSpinner />;

  const availBeds = beds.filter(b => b.status === "available").length;
  const occBeds = beds.filter(b => b.status === "occupied").length;
  const icuBeds = beds.filter(b => b.bed_type === "ICU");
  const availIcu = icuBeds.filter(b => b.status === "available").length;

  const bedTypeGroups = {};
  beds.forEach(b => {
    if (!bedTypeGroups[b.bed_type]) bedTypeGroups[b.bed_type] = { total: 0, available: 0, occupied: 0 };
    bedTypeGroups[b.bed_type].total++;
    if (b.status === "available") bedTypeGroups[b.bed_type].available++;
    if (b.status === "occupied") bedTypeGroups[b.bed_type].occupied++;
  });

  const statusStyle = {
    available: { bg: "#ecfdf5", border: "#a7f3d0", text: "#059669" },
    occupied: { bg: "#fef2f2", border: "#fecaca", text: "#dc2626" },
    reserved: { bg: "#fffbeb", border: "#fde68a", text: "#d97706" },
    maintenance: { bg: "#f1f5f9", border: "#e2e8f0", text: "#64748b" },
  };

  /* ════════ HOME ════════ */
  if (section === "home" || !section) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Hospital banner */}
      <div style={{
        borderRadius: 16, padding: 24, border: "1px solid #bfdbfe",
        background: "linear-gradient(135deg, #eff6ff 0%, #ffffff 60%)",
      }}>
        <p style={{ fontSize: 11, fontWeight: 800, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Staff Dashboard</p>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", margin: 0 }}>{hospital?.name || "No Hospital Linked"}</h1>
        {hospital && <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>📍 {hospital.address}, {hospital.city}</p>}
      </div>

      {!hospital && <AlertBox type="warning">No hospital linked to your account. Ask an admin to assign you.</AlertBox>}

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <StatCard icon="🛏️" label="Available Beds" value={availBeds} sub={`of ${beds.length} total`} color="emerald" />
        <StatCard icon="❤️‍🔥" label="ICU Available" value={availIcu} sub={`of ${icuBeds.length}`} color="red" />
        <StatCard icon="⏳" label="Pending Bookings" value={bookings.filter(b => b.status === "pending").length} color="amber" />
        <StatCard icon="🏨" label="Admitted Now" value={admitted.length} color="violet" />
      </div>

      {/* Bed breakdown by type */}
      {Object.keys(bedTypeGroups).length > 0 && (
        <div>
          <SectionTitle>🛏️ Bed Breakdown by Type</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
            {Object.entries(bedTypeGroups).map(([type, g]) => {
              const pct = g.total ? Math.round((g.occupied / g.total) * 100) : 0;
              return (
                <Card key={type}>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", margin: "0 0 12px", textTransform: "capitalize" }}>{type}</p>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 10 }}>
                    <span style={{ fontSize: 28, fontWeight: 900, color: "#0f172a" }}>{g.available}</span>
                    <span style={{ fontSize: 13, color: "#94a3b8" }}>/ {g.total} free</span>
                  </div>
                  <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                    <div style={{
                      height: "100%", borderRadius: 3,
                      width: `${pct}%`,
                      background: pct > 80 ? "#ef4444" : pct > 60 ? "#f59e0b" : "#10b981",
                      transition: "width 0.6s",
                    }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8" }}>
                    <span>{g.occupied} occupied</span>
                    <span style={{ fontWeight: 800, color: pct > 80 ? "#ef4444" : "#10b981" }}>{pct}%</span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  /* ════════ BED MAP ════════ */
  if (section === "bedmap") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🛏️ Bed Management" subtitle={`${beds.length} beds — ${hospital?.name}`} />
      {/* Legend */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {Object.entries(statusStyle).map(([s, st]) => (
          <span key={s} style={{
            padding: "4px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: st.bg, color: st.text, border: `1px solid ${st.border}`, textTransform: "capitalize",
          }}>● {s}</span>
        ))}
      </div>
      {/* Bed grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(56px, 1fr))", gap: 8 }}>
        {beds.map(bed => {
          const st = statusStyle[bed.status] || statusStyle.maintenance;
          return (
            <div key={bed.id} title={`${bed.bed_number} — ${bed.status}${bed.ward ? ` · ${bed.ward}` : ""}`} style={{
              aspectRatio: "1", borderRadius: 12, border: `1px solid ${st.border}`,
              background: st.bg, display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: st.text, cursor: "pointer",
              transition: "transform 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.1)"}
              onMouseLeave={e => e.currentTarget.style.transform = ""}
            >
              {bed.bed_number.replace(/\D/g, "").slice(-3) || bed.bed_number.slice(-2)}
            </div>
          );
        })}
      </div>
      {beds.length === 0 && <EmptyState icon="🛏️" message="No beds configured yet" />}
    </div>
  );

  /* ════════ BOOKINGS ════════ */
  if (section === "bookings") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="📋 Pending Bookings" subtitle={`${bookings.length} pending approvals`} />
      {bookings.length === 0
        ? <EmptyState icon="✅" message="No pending bookings" />
        : bookings.map(b => (
          <Card key={b.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
                  <StatusBadge status={b.status} />
                </div>
                <p style={{ fontSize: 13, color: "#475569", margin: 0 }}>
                  Bed {b.beds?.bed_number} ({b.beds?.bed_type}) — {b.beds?.ward || "N/A"}
                </p>
                <p style={{ fontSize: 11, color: "#94a3b8", margin: "4px 0 0" }}>
                  {new Date(b.booked_at).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════════ ADMITTED ════════ */
  if (section === "admitted") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🏨 Admitted Patients" subtitle={`${admitted.length} currently admitted`} />
      {admitted.length === 0
        ? <EmptyState icon="🏨" message="No patients currently admitted" />
        : admitted.map(b => (
          <Card key={b.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <StatusBadge status="admitted" />
                <InfoRow label="Bed" value={`${b.beds?.bed_number} — ${b.beds?.ward || "N/A"}`} icon="🛏️" />
                {b.attending_doctor && <InfoRow label="Doctor" value={b.attending_doctor} icon="👨‍⚕️" />}
                {b.admitted_at && <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Admitted: {new Date(b.admitted_at).toLocaleString("en-IN")}</p>}
              </div>
            </div>
          </Card>
        ))
      }
    </div>
  );

  /* ════════ OPD ════════ */
  if (section === "opd") return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <DashboardHeader title="🧑‍⚕️ OPD Queue" subtitle="Outpatient department queue management" />
      <Card style={{ borderColor: "#fde68a", background: "#fffbeb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div>
            <p style={{ fontSize: 48, fontWeight: 900, color: "#0f172a", margin: 0 }}>0</p>
            <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>patients waiting</p>
          </div>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <input type="number" placeholder="Update count" min="0" style={{
              width: 100, padding: "10px 12px", borderRadius: 12, border: "1px solid #e2e8f0",
              background: "#fff", fontSize: 13, outline: "none",
            }} />
            <button style={{
              padding: "10px 16px", borderRadius: 12, border: "1px solid #fde68a",
              background: "#fef3c7", color: "#92400e", fontSize: 12, fontWeight: 800, cursor: "pointer",
            }}>Update</button>
          </div>
        </div>
      </Card>
    </div>
  );

  return <EmptyState icon="🏥" message="Select a section from the sidebar" />;
}