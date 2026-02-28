// src/hooks/useGeolocation.js
// Watches browser GPS and returns live position.
// If no hardware GPS (desktop/laptop), falls back to Lonavala by default.
// Manual override: user can type a city name → Nominatim geocodes it → stored in sessionStorage.
import { useState, useEffect, useRef } from "react";

// ── Change this to match your demo location ───────────────────
// Lonavala, Maharashtra: 18.7481° N, 73.4072° E
const DEMO_DEFAULT = { lat: 18.7481, lng: 73.4072 };

// ── Try to restore a user-set override from sessionStorage ───
function getSavedOverride() {
    try {
        const s = sessionStorage.getItem("mq_location_override");
        return s ? JSON.parse(s) : null;
    } catch { return null; }
}
function saveOverride(coords) {
    try { sessionStorage.setItem("mq_location_override", JSON.stringify(coords)); } catch { }
}
export function clearLocationOverride() {
    try { sessionStorage.removeItem("mq_location_override"); } catch { }
}

// ── Geocode a text address / city via Nominatim (OSM, free) ──
export async function geocodeCity(query) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query + ", India")}&format=json&limit=3&countrycodes=in`;
    const res = await fetch(url, { headers: { "Accept-Language": "en" } });
    const data = await res.json();
    if (!data?.length) throw new Error("Location not found. Try a more specific name.");
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), label: data[0].display_name };
}

// ── Main hook ─────────────────────────────────────────────────
export function useGeolocation({ watch = true } = {}) {
    const saved = getSavedOverride();
    // Start with any previously saved override, else null (triggers GPS attempt)
    const [coords, setCoords] = useState(saved || null);
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(!saved);
    const watchId = useRef(null);

    // Allow external code to push a new override (from LocationPicker)
    const setOverride = (newCoords) => {
        saveOverride(newCoords);
        setCoords(newCoords);
        setLoading(false);
        setError(null);
    };

    useEffect(() => {
        // If we already have an override, skip the GPS request
        if (getSavedOverride()) return;

        if (!navigator.geolocation) {
            setCoords(DEMO_DEFAULT);
            setError("No GPS hardware — using Lonavala");
            setLoading(false);
            return;
        }

        const success = (pos) => {
            // Only use browser GPS if accuracy < 5000m (if accuracy is huge it's IP-based)
            const acc = pos.coords.accuracy;
            if (acc < 5000) {
                const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc };
                setCoords(c);
            } else {
                // IP-based location, accuracy too low → use demo default
                console.warn(`[GPS] accuracy ${acc}m too low — using Lonavala demo default`);
                setCoords(DEMO_DEFAULT);
                setError("IP-based location inaccurate — showing Lonavala. Use 'Set Location' to fix.");
            }
            setLoading(false);
        };

        const fail = (err) => {
            console.warn("[GPS] denied:", err.message);
            setCoords(DEMO_DEFAULT);        // Default to Lonavala for demo
            setError(err.message);
            setLoading(false);
        };

        const opts = { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 };

        if (watch) {
            watchId.current = navigator.geolocation.watchPosition(success, fail, opts);
        } else {
            navigator.geolocation.getCurrentPosition(success, fail, opts);
        }

        return () => {
            if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
        };
    }, [watch]);

    return { coords, error, loading, setOverride };
}

/* Haversine distance in km between two {lat,lng} pairs */
export function haversine(a, b) {
    if (!a || !b) return Infinity;
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(sin2));
}
