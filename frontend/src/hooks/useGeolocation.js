// src/hooks/useGeolocation.js
// Watches the browser's GPS and returns live position.
// Falls back to Pune city center (18.5204, 73.8567) if denied.
import { useState, useEffect, useRef } from "react";

const PUNE_DEFAULT = { lat: 18.5204, lng: 73.8567 };

export function useGeolocation({ watch = true } = {}) {
    const [coords, setCoords] = useState(null);     // { lat, lng, accuracy }
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(true);
    const watchId = useRef(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setCoords(PUNE_DEFAULT);
            setError("Geolocation not supported");
            setLoading(false);
            return;
        }

        const success = (pos) => {
            setCoords({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
            });
            setLoading(false);
        };

        const fail = (err) => {
            console.warn("[GPS]", err.message);
            setCoords(PUNE_DEFAULT);   // fall back gracefully
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

    return { coords, error, loading };
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
