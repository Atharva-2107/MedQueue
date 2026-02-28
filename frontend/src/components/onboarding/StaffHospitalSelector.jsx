// src/components/onboarding/StaffHospitalSelector.jsx
// Shown when a hospital_staff/admin user has no hospital_id linked yet.
// Uses GPS + Overpass API to find nearby hospitals, staff picks their hospital.
// On confirm → calls link_staff_hospital RPC (SECURITY DEFINER, bypasses RLS recursion)
// → refreshes user context so hospital_id is immediately available
import React, { useState, useEffect } from "react";
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { haversine } from "../../hooks/useGeolocation";
import { ensureHospitalInDB } from "../../hooks/useNearbyHospitals";

const OVERPASS = "https://overpass-api.de/api/interpreter";

async function fetchNearbyHospitals(lat, lng) {
    const q = `[out:json][timeout:20];
    (node["amenity"="hospital"](around:15000,${lat},${lng});
     way["amenity"="hospital"](around:15000,${lat},${lng});
     relation["amenity"="hospital"](around:15000,${lat},${lng}););
    out center tags;`;
    const res = await fetch(`${OVERPASS}?data=${encodeURIComponent(q)}`);
    const data = await res.json();
    return (data.elements || [])
        .filter(e => e.tags?.name)
        .map(e => ({
            osm_id: e.id,
            name: e.tags.name,
            address: [e.tags["addr:street"], e.tags["addr:housenumber"], e.tags["addr:city"]].filter(Boolean).join(", ") || e.tags["addr:full"] || "",
            latitude: e.lat ?? e.center?.lat,
            longitude: e.lon ?? e.center?.lon,
        }))
        .filter(h => h.latitude && h.longitude);
}

export default function StaffHospitalSelector({ userId, onLinked }) {
    const { loadUserProfile } = useAuth();
    const [phase, setPhase] = useState("locating");
    const [coords, setCoords] = useState(null);
    const [merged, setMerged] = useState([]);
    const [search, setSearch] = useState("");
    const [selected, setSelected] = useState(null);
    const [err, setErr] = useState("");

    /* Step 1 — get GPS */
    useEffect(() => {
        navigator.geolocation.getCurrentPosition(
            pos => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => setCoords({ lat: 18.7481, lng: 73.4072 }), // Lonavala default
            { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
        );
    }, []);

    /* Step 2 — when we have coords, fetch Overpass + DB hospitals */
    useEffect(() => {
        if (!coords) return;
        (async () => {
            try {
                const [osmH, { data: dbH }] = await Promise.all([
                    fetchNearbyHospitals(coords.lat, coords.lng).catch(() => []),
                    supabase.from("hospitals").select("id,name,address,latitude,longitude").eq("is_active", true),
                ]);

                // Merge: DB hospitals first (in MedQueue), then OSM-only nearby
                const dbByName = Object.fromEntries((dbH || []).map(h => [h.name?.toLowerCase().trim(), h]));
                const cleanName = (n) => (n || "").toLowerCase().replace(/hospital|clinic|care|centre/gi, "").trim();

                const mergedList = (dbH || [])
                    .map(db => ({
                        id: db.id,
                        db_id: db.id,
                        name: db.name,
                        address: db.address || "",
                        latitude: db.latitude,
                        longitude: db.longitude,
                        in_db: true,
                        distance_km: db.latitude ? haversine(coords, { lat: db.latitude, lng: db.longitude }) : 999,
                    }))
                    .concat(
                        osmH
                            .filter(o => {
                                // 1. Check exact/fuzzy name match
                                const fuzzyMatch = (dbH || []).find(db => cleanName(db.name).includes(cleanName(o.name)) || cleanName(o.name).includes(cleanName(db.name)));
                                // 2. Check radius (under 300m = same hospital)
                                const nearbyMatch = (dbH || []).find(db => db.latitude && haversine({ lat: db.latitude, lng: db.longitude }, { lat: o.latitude, lng: o.longitude }) < 0.30);

                                return !fuzzyMatch && !nearbyMatch;
                            })
                            .map(o => ({
                                id: `osm_${o.osm_id}`,
                                db_id: null,
                                name: o.name,
                                address: o.address,
                                latitude: o.latitude,
                                longitude: o.longitude,
                                in_db: false,
                                distance_km: haversine(coords, { lat: o.latitude, lng: o.longitude }),
                            }))
                    )
                    .sort((a, b) => a.distance_km - b.distance_km);

                setMerged(mergedList);
                setPhase("picking");
            } catch (e) {
                setErr("Could not fetch hospitals: " + e.message);
                setPhase("error");
            }
        })();
    }, [coords]);

    /* Step 3 — link hospital to this staff user */
    const confirm = async () => {
        if (!selected) return;
        setPhase("saving");
        try {
            let hospId = selected.db_id;

            // If OSM-only hospital, register it using the shared exact logic
            if (!hospId) {
                hospId = await ensureHospitalInDB(selected);
            }

            // Direct update of the user's row. We forcefully sync the true role from auth metadata
            // to automatically fix the database if the signup trigger gave them the 'patient' role by mistake.
            const { data: { user: au } } = await supabase.auth.getUser();
            const realRole = au?.user_metadata?.user_role || "hospital_staff";

            const { error: updErr } = await supabase.from("users").update({
                hospital_id: hospId,
                role: realRole
            }).eq("id", userId);

            if (updErr) throw new Error(updErr.message);

            // Refresh user context so hospital_id is set immediately
            // This prevents the selector from showing again on the same session
            await loadUserProfile();

            setPhase("done");
            setTimeout(() => onLinked(hospId), 1000);
        } catch (e) {
            setErr(e.message);
            setPhase("error");
        }
    };

    const filtered = merged.filter(h =>
        !search || h.name.toLowerCase().includes(search.toLowerCase()) || h.address.toLowerCase().includes(search.toLowerCase())
    );

    /* ── Render ── */
    return (
        <div style={{ minHeight: "100vh", background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'DM Sans',system-ui,sans-serif" }}>
            <div style={{ width: "100%", maxWidth: 560, background: "#fff", borderRadius: 24, boxShadow: "0 8px 40px rgba(0,0,0,0.10)", overflow: "hidden" }}>

                {/* Header */}
                <div style={{ padding: "28px 32px 20px", borderBottom: "1px solid #f1f5f9", background: "linear-gradient(135deg,#f0fdf4,#fff)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
                        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>🏥</div>
                        <div>
                            <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0f172a", margin: 0 }}>Link Your Hospital</h2>
                            <p style={{ fontSize: 13, color: "#64748b", margin: 0 }}>Select the hospital you work at to receive patient bookings</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: "24px 32px 28px" }}>

                    {(phase === "locating") && (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>📍</div>
                            <p style={{ fontWeight: 700, color: "#0f172a" }}>Getting your location…</p>
                            <p style={{ fontSize: 12, color: "#94a3b8" }}>Allow location access for best results</p>
                        </div>
                    )}

                    {(phase === "saving") && (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                            <p style={{ fontWeight: 700, color: "#0f172a" }}>Linking hospital…</p>
                        </div>
                    )}

                    {(phase === "done") && (
                        <div style={{ textAlign: "center", padding: "40px 0" }}>
                            <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                            <p style={{ fontWeight: 900, color: "#059669", fontSize: 17 }}>Hospital Linked!</p>
                            <p style={{ fontSize: 13, color: "#475569" }}>Loading your dashboard…</p>
                        </div>
                    )}

                    {(phase === "error") && (
                        <div style={{ textAlign: "center", padding: "24px 0" }}>
                            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
                            <p style={{ fontWeight: 700, color: "#dc2626" }}>{err}</p>
                            <button onClick={() => setPhase("locating")} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 12, border: "none", background: "#10b981", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Retry</button>
                        </div>
                    )}

                    {(phase === "picking") && (
                        <>
                            {err && <div style={{ padding: "10px 14px", borderRadius: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 14 }}>{err}</div>}

                            {/* GPS status */}
                            {coords && (
                                <div style={{ padding: "8px 14px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                                    <span>📍 Live GPS Active</span>
                                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>{coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}</span>
                                </div>
                            )}

                            {/* Search */}
                            <input
                                type="text"
                                placeholder="🔍 Search hospital by name or area…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                style={{ width: "100%", padding: "11px 14px", borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13, outline: "none", marginBottom: 14, boxSizing: "border-box", fontFamily: "inherit", background: "#f8fafc" }}
                                autoFocus
                            />

                            <p style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
                                {filtered.length} hospitals found nearby
                            </p>

                            {/* Hospital list */}
                            <div style={{ maxHeight: 340, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                                {filtered.slice(0, 20).map(h => {
                                    const sel = selected?.id === h.id;
                                    const dist = h.distance_km < 1 ? `${Math.round(h.distance_km * 1000)}m` : `${h.distance_km.toFixed(1)}km`;
                                    return (
                                        <button key={h.id} onClick={() => setSelected(h)} style={{
                                            padding: "12px 16px", borderRadius: 14, textAlign: "left", cursor: "pointer",
                                            border: `2px solid ${sel ? "#10b981" : "#e2e8f0"}`,
                                            background: sel ? "#f0fdf4" : "#fff",
                                            transition: "all 0.15s",
                                        }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <p style={{ fontSize: 14, fontWeight: 800, color: sel ? "#059669" : "#0f172a", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.name}</p>
                                                    {h.address && <p style={{ fontSize: 11, color: "#94a3b8", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {h.address}</p>}
                                                </div>
                                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 10, flexShrink: 0 }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6" }}>📏 {dist}</span>
                                                    {h.in_db
                                                        ? <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 800, background: "#ecfdf5", color: "#059669", border: "1px solid #a7f3d0" }}>In MedQueue</span>
                                                        : <span style={{ padding: "2px 8px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: "#f1f5f9", color: "#94a3b8" }}>Register</span>}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Selected preview */}
                            {selected && (
                                <div style={{ marginTop: 16, padding: "12px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #a7f3d0" }}>
                                    <p style={{ fontSize: 12, color: "#059669", fontWeight: 800, margin: 0 }}>
                                        ✅ {selected.name}
                                        {selected.in_db ? " — already in MedQueue" : " — will be registered"}
                                    </p>
                                </div>
                            )}

                            <button onClick={confirm} disabled={!selected} style={{
                                width: "100%", marginTop: 16, padding: "14px", borderRadius: 14, border: "none",
                                background: selected ? "#10b981" : "#e2e8f0",
                                color: selected ? "#fff" : "#94a3b8",
                                fontWeight: 900, fontSize: 15, cursor: selected ? "pointer" : "not-allowed",
                                fontFamily: "inherit", boxShadow: selected ? "0 4px 16px rgba(16,185,129,0.3)" : "none",
                            }}>
                                🏥 Confirm — This Is My Hospital
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
