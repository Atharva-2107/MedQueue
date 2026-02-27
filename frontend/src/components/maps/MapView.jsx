// src/components/maps/MapView.jsx
// Leaflet + OpenStreetMap — free, no API key needed
// Shows: my position, hospitals (colored), ambulances, SOS markers
import React, { useEffect } from "react";
import {
    MapContainer, TileLayer, Marker, Popup, Circle,
    useMap, Polyline,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default Leaflet marker icon (Vite breaks the default icon path)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
    iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

/* Custom SVG icons */
const makeIcon = (color, emoji, size = 36) =>
    L.divIcon({
        className: "",
        html: `<div style="
      width:${size}px; height:${size}px; border-radius:50%;
      background:${color}; border:3px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      font-size:${size * 0.45}px; cursor:pointer;
    ">${emoji}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });

const ICONS = {
    me: makeIcon("#3b82f6", "📍", 44),
    hospital_ok: makeIcon("#10b981", "🏥", 40),
    hospital_low: makeIcon("#f59e0b", "🏥", 40),
    hospital_full: makeIcon("#ef4444", "🏥", 40),
    ambulance: makeIcon("#10b981", "🚑", 38),
    sos: makeIcon("#dc2626", "🆘", 44),
    patient: makeIcon("#8b5cf6", "👤", 38),
};

/* Auto-pan map to the "center" prop */
function PanTo({ center }) {
    const map = useMap();
    useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
    return null;
}

export default function MapView({
    center = { lat: 18.5204, lng: 73.8567 },  // Pune default
    zoom = 13,
    myPosition = null,      // { lat, lng }
    hospitals = [],        // [{ id, name, lat, lng, available_beds, total_beds }]
    ambulances = [],        // [{ id, vehicle_number, lat, lng, status }]
    sosPings = [],        // [{ id, pickup_lat, pickup_lng, pickup_address }]
    patientPos = null,      // { lat, lng } — shown to driver
    routeLine = null,      // [[lat,lng],[lat,lng]] — navigation polyline
    height = "360px",
    onHospitalClick = null,
    onAmbulanceClick = null,
}) {
    const mapCenter = myPosition
        ? [myPosition.lat, myPosition.lng]
        : [center.lat, center.lng];

    return (
        <div style={{ height, width: "100%", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <MapContainer
                center={mapCenter} zoom={zoom}
                style={{ height: "100%", width: "100%" }}
                zoomControl attributionControl={false}
            >
                <PanTo center={myPosition ? [myPosition.lat, myPosition.lng] : null} />
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="© OpenStreetMap contributors"
                />

                {/* My position */}
                {myPosition && (
                    <>
                        <Circle center={[myPosition.lat, myPosition.lng]}
                            radius={myPosition.accuracy || 50}
                            pathOptions={{ color: "#3b82f6", fillColor: "#3b82f620", weight: 1 }}
                        />
                        <Marker position={[myPosition.lat, myPosition.lng]} icon={ICONS.me}>
                            <Popup><strong>📍 Your Location</strong></Popup>
                        </Marker>
                    </>
                )}

                {/* Hospitals */}
                {hospitals.map(h => {
                    if (!h.latitude || !h.longitude) return null;
                    const ratio = h.total_beds ? (h.available_beds || 0) / h.total_beds : 0;
                    const icon = ratio > 0.3 ? ICONS.hospital_ok : ratio > 0 ? ICONS.hospital_low : ICONS.hospital_full;
                    return (
                        <Marker key={h.id} position={[h.latitude, h.longitude]} icon={icon}
                            eventHandlers={{ click: () => onHospitalClick?.(h) }}>
                            <Popup>
                                <div style={{ minWidth: 140 }}>
                                    <strong style={{ fontSize: 13 }}>🏥 {h.name}</strong><br />
                                    <span style={{ color: "#64748b", fontSize: 12 }}>{h.address}</span><br />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: ratio > 0.3 ? "#059669" : ratio > 0 ? "#d97706" : "#dc2626" }}>
                                        {h.available_beds || 0} / {h.total_beds || 0} beds free
                                    </span>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Ambulances */}
                {ambulances.map(a => {
                    if (!a.latitude || !a.longitude) return null;
                    return (
                        <Marker key={a.id} position={[a.latitude, a.longitude]} icon={ICONS.ambulance}
                            eventHandlers={{ click: () => onAmbulanceClick?.(a) }}>
                            <Popup>
                                <div>
                                    <strong>🚑 {a.vehicle_number}</strong><br />
                                    <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>{a.status?.toUpperCase()}</span><br />
                                    <span style={{ fontSize: 11, color: "#64748b" }}>{a.ambulance_type}</span>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* SOS pings — visible to drivers */}
                {sosPings.map(d => {
                    if (!d.pickup_lat || !d.pickup_lng) return null;
                    return (
                        <Marker key={d.id} position={[d.pickup_lat, d.pickup_lng]} icon={ICONS.sos}>
                            <Popup>
                                <div>
                                    <strong style={{ color: "#dc2626" }}>🆘 EMERGENCY SOS</strong><br />
                                    <span style={{ fontSize: 12 }}>{d.pickup_address || "Patient location"}</span>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                {/* Patient position — visible to driver */}
                {patientPos && (
                    <Marker position={[patientPos.lat, patientPos.lng]} icon={ICONS.patient}>
                        <Popup><strong>👤 Patient Location</strong></Popup>
                    </Marker>
                )}

                {/* Navigation route line */}
                {routeLine && routeLine.length >= 2 && (
                    <Polyline positions={routeLine}
                        pathOptions={{ color: "#3b82f6", weight: 4, dashArray: "8 4", opacity: 0.8 }}
                    />
                )}
            </MapContainer>
        </div>
    );
}
