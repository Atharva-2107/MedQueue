// src/hooks/useNearbyHospitals.js
import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { haversine } from "./useGeolocation";

/* ── Deterministic seeded bed counts so same hospital always shows same number ── */
function hashStr(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0;
    return h;
}
function seededInt(seed, min, max) {
    const x = Math.sin(seed + 0.7) * 10000;
    return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}
export function estimatedBeds(name) {
    const h = hashStr(name);
    const total = seededInt(h, 40, 300);
    const available = seededInt(h + 3, 8, Math.floor(total * 0.65));
    return { total, available };
}

/* ── Overpass API — fetches real hospitals from OpenStreetMap ── */
const CACHE = {};
async function fetchOverpass(lat, lng) {
    const key = `${lat.toFixed(2)}_${lng.toFixed(2)}`;
    if (CACHE[key]) return CACHE[key];
    const q = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:10000,${lat},${lng});
      way["amenity"="hospital"](around:10000,${lat},${lng});
      relation["amenity"="hospital"](around:10000,${lat},${lng});
    );
    out center tags;
  `;
    try {
        const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`);
        const data = await res.json();
        const out = (data.elements || [])
            .filter(e => e.tags?.name)
            .map(e => ({
                osm_id: e.id,
                name: e.tags.name,
                address: [e.tags["addr:street"], e.tags["addr:housenumber"], e.tags["addr:city"]].filter(Boolean).join(", ") || e.tags["addr:full"] || "",
                phone: e.tags.phone || e.tags["contact:phone"] || "",
                website: e.tags.website || "",
                emergency: e.tags.emergency === "yes",
                latitude: e.lat ?? e.center?.lat,
                longitude: e.lon ?? e.center?.lon,
            }))
            .filter(h => h.latitude && h.longitude);
        CACHE[key] = out;
        return out;
    } catch {
        return [];
    }
}

/* ── Auto-register OSM hospital in Supabase so bookings can target it ──
   Fixed: no longer uses onConflict (requires unique constraint).
   Instead: SELECT first, INSERT only if not found.
   Also: RLS fixed in SQL (see db_patch.sql Patch 15).
── */
export async function ensureHospitalInDB(osmHospital) {
    // Already in DB — nothing to do
    if (osmHospital.db_id) return osmHospital.db_id;

    const est = estimatedBeds(osmHospital.name);

    // 1. Look for an existing hospital with same name (fuzzy match)
    const { data: byName } = await supabase
        .from("hospitals")
        .select("id")
        .ilike("name", `%${osmHospital.name.replace(/hospital|clinic|care|centre/gi, "").trim()}%`)
        .maybeSingle();

    if (byName?.id) return byName.id;

    // 2. Look for one within 300m (same building/block, different name capitalisation)
    if (osmHospital.latitude) {
        const { data: all } = await supabase
            .from("hospitals")
            .select("id, latitude, longitude")
            .not("latitude", "is", null);

        const nearby = (all || []).find(h =>
            haversine({ lat: h.latitude, lng: h.longitude },
                { lat: osmHospital.latitude, lng: osmHospital.longitude }) < 0.30
        );
        if (nearby) return nearby.id;
    }

    // 3. INSERT the hospital
    const { data: inserted, error: insErr } = await supabase
        .from("hospitals")
        .insert({
            name: osmHospital.name.trim(),
            address: osmHospital.address || "",
            city: osmHospital.address?.includes("Mumbai") ? "Mumbai" : "Mumbai",
            phone: osmHospital.phone || null,
            latitude: osmHospital.latitude,
            longitude: osmHospital.longitude,
            total_beds: est.total,
            available_beds: est.available,
            is_active: true,
        })
        .select("id")
        .single();

    if (insErr) throw new Error("Could not register hospital: " + insErr.message);

    const hospitalId = inserted.id;

    // 4. Generate beds for this hospital
    const typeShares = [
        { type: "General", share: 0.50 },
        { type: "ICU", share: 0.15 },
        { type: "Emergency", share: 0.15 },
        { type: "Pediatric", share: 0.10 },
        { type: "Maternity", share: 0.10 },
    ];
    const beds = [];
    let n = 1;
    for (const { type, share } of typeShares) {
        const count = Math.max(2, Math.round(est.total * share));
        for (let i = 0; i < count; i++) {
            beds.push({
                hospital_id: hospitalId,
                bed_number: `${type[0]}${n++}`,
                bed_type: type,
                ward: `${type} Ward`,
                floor: String(Math.ceil(n / 25)),
                status: n % 5 === 0 ? "occupied" : "available",
            });
        }
    }
    // Insert in batches of 50
    for (let i = 0; i < beds.length; i += 50) {
        await supabase.from("beds").insert(beds.slice(i, i + 50));
    }

    return hospitalId;
}

/* ── Main hook ── */
export function useNearbyHospitals(coords) {
    const [hospitals, setHospitals] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!coords) return;
        let cancelled = false;
        setLoading(true);

        (async () => {
            try {
                const [osm, { data: dbH }, { data: dbBeds }] = await Promise.all([
                    fetchOverpass(coords.lat, coords.lng),
                    supabase.from("hospitals").select("*").eq("is_active", true),
                    supabase.from("beds").select("hospital_id, status"),
                ]);
                if (cancelled) return;

                // Live bed counts from DB
                const availCount = {}, totalCount = {};
                (dbBeds || []).forEach(b => {
                    totalCount[b.hospital_id] = (totalCount[b.hospital_id] || 0) + 1;
                    if (b.status === "available") availCount[b.hospital_id] = (availCount[b.hospital_id] || 0) + 1;
                });

                // Index DB hospitals
                const dbByNameLow = Object.fromEntries((dbH || []).map(h => [h.name?.toLowerCase().trim(), h]));

                // Merge OSM + DB
                const merged = osm.map(o => {
                    const key = o.name.toLowerCase().trim();
                    // Match by name OR within 300m (0.3km) radius
                    const db = dbByNameLow[key] || (dbH || []).find(d =>
                        d.latitude && haversine({ lat: d.latitude, lng: d.longitude }, { lat: o.latitude, lng: o.longitude }) < 0.30
                    );
                    const est = estimatedBeds(o.name);
                    return {
                        ...o,
                        id: db ? db.id : `osm_${o.osm_id}`,
                        db_id: db?.id || null,
                        is_in_db: !!db,
                        available_beds: db ? (availCount[db.id] ?? db.available_beds ?? est.available) : est.available,
                        total_beds: db ? (totalCount[db.id] || db.total_beds || est.total) : est.total,
                        is_estimated: !db,
                        distance_km: haversine(coords, { lat: o.latitude, lng: o.longitude }),
                    };
                });

                // Add DB-only hospitals not in OSM
                (dbH || []).forEach(db => {
                    if (!db.latitude || merged.find(m => m.db_id === db.id)) return;
                    merged.push({
                        id: db.id, db_id: db.id, osm_id: null,
                        name: db.name, address: db.address || "", phone: db.phone || "",
                        website: "", emergency: false,
                        latitude: db.latitude, longitude: db.longitude,
                        available_beds: availCount[db.id] ?? db.available_beds ?? 0,
                        total_beds: totalCount[db.id] || db.total_beds || 0,
                        is_in_db: true, is_estimated: false,
                        distance_km: haversine(coords, { lat: db.latitude, lng: db.longitude }),
                    });
                });

                merged.sort((a, b) => a.distance_km - b.distance_km);
                if (!cancelled) setHospitals(merged);
            } catch (e) {
                console.warn("[useNearbyHospitals]", e);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();

        return () => { cancelled = true; };
    }, [coords?.lat?.toFixed?.(3), coords?.lng?.toFixed?.(3)]);

    return { hospitals, loading };
}
