// src/components/shared/LocationPicker.jsx
// A compact bar shown on the PatientDashboard that lets the user
// type any city/area and override the GPS location via Nominatim geocoding.
// Override is saved in sessionStorage so it persists across tabs/refreshes.
import React, { useState } from "react";
import { geocodeCity, clearLocationOverride } from "../../hooks/useGeolocation";

export default function LocationPicker({ coords, onOverride }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState("");

    const submit = async () => {
        if (!query.trim()) return;
        setLoading(true); setErr("");
        try {
            const result = await geocodeCity(query.trim());
            onOverride({ lat: result.lat, lng: result.lng, label: query.trim() });
            setOpen(false); setQuery("");
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const reset = () => {
        clearLocationOverride();
        onOverride(null); // caller should reload GPS
        setOpen(false);
    };

    const displayLoc = coords?.label || (coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Getting location…");
    const isOverride = !!coords?.label;

    return (
        <div style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>
            {/* Status bar */}
            <div style={{ padding: "9px 14px", borderRadius: 12, background: isOverride ? "#eff6ff" : "#f0fdf4", border: `1px solid ${isOverride ? "#bfdbfe" : "#bbf7d0"}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: 15 }}>{isOverride ? "📌" : "📍"}</span>
                    <div>
                        <p style={{ fontSize: 11, fontWeight: 800, color: isOverride ? "#1e40af" : "#059669", margin: 0, textTransform: "uppercase", letterSpacing: 0.5 }}>
                            {isOverride ? "Location Override Active" : "Live GPS Active"}
                        </p>
                        <p style={{ fontSize: 12, color: "#475569", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 260 }}>{displayLoc}</p>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    {isOverride && (
                        <button onClick={reset} style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #bfdbfe", background: "#fff", color: "#3b82f6", fontWeight: 700, fontSize: 11, cursor: "pointer" }}>
                            Use GPS
                        </button>
                    )}
                    <button onClick={() => { setOpen(o => !o); setErr(""); }} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: isOverride ? "#3b82f6" : "#10b981", color: "#fff", fontWeight: 800, fontSize: 11, cursor: "pointer" }}>
                        {open ? "✕ Close" : "📍 Set Location"}
                    </button>
                </div>
            </div>

            {/* Dropdown picker */}
            {open && (
                <div style={{ marginTop: 8, padding: "16px 18px", borderRadius: 14, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,0.1)" }}>
                    <p style={{ fontSize: 12, fontWeight: 800, color: "#0f172a", margin: "0 0 10px" }}>📍 Type your location for hospitals near you</p>
                    <div style={{ display: "flex", gap: 8 }}>
                        <input
                            type="text"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && submit()}
                            placeholder="e.g. Lonavala, Mumbai, Pune…"
                            autoFocus
                            style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", fontFamily: "inherit", background: "#f8fafc" }}
                        />
                        <button onClick={submit} disabled={loading || !query.trim()} style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: query.trim() ? "#10b981" : "#e2e8f0", color: query.trim() ? "#fff" : "#94a3b8", fontWeight: 800, fontSize: 13, cursor: query.trim() ? "pointer" : "not-allowed" }}>
                            {loading ? "…" : "Set"}
                        </button>
                    </div>

                    {/* Quick picks for common locations */}
                    <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                        {["Lonavala", "Mumbai", "Pune", "Thane", "Nashik", "Nagpur"].map(city => (
                            <button key={city} onClick={() => { setQuery(city); }} style={{ padding: "5px 12px", borderRadius: 20, border: "1px solid #e2e8f0", background: query === city ? "#f0fdf4" : "#f8fafc", color: query === city ? "#059669" : "#64748b", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                                {city}
                            </button>
                        ))}
                    </div>

                    {err && <p style={{ fontSize: 12, color: "#dc2626", margin: "8px 0 0" }}>⚠️ {err}</p>}
                </div>
            )}
        </div>
    );
}
