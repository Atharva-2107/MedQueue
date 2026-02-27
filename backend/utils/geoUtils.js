// utils/geoUtils.js
// ─────────────────────────────────────────────────────────────────
//  Haversine distance + ETA calculator
//  Used for "nearest ambulance" and dispatch ETA estimates.
//  Does NOT require PostGIS — pure JS fallback.
// ─────────────────────────────────────────────────────────────────

const EARTH_RADIUS_KM = 6371;

/**
 * Calculate straight-line distance between two coordinates (km)
 * Uses the Haversine formula.
 */
const getDistanceKm = (lat1, lon1, lat2, lon2) => {
  if (lat2 == null || lon2 == null) return Infinity;

  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
};

/**
 * Estimate ETA in minutes based on distance.
 * Assumes average urban speed of 30 km/h for ambulances in city traffic.
 * Add 2 min base for dispatch response.
 */
const calculateETA = (distanceKm, avgSpeedKmh = 30) => {
  const travelMinutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.ceil(travelMinutes + 2); // +2 min base overhead
};

/**
 * Sort a list of items with lat/lng by distance from a point
 * and return only those within maxKm radius.
 */
const filterAndSortByDistance = (items, userLat, userLng, maxKm = 20) => {
  return items
    .map((item) => ({
      ...item,
      distance_km: parseFloat(getDistanceKm(userLat, userLng, item.latitude, item.longitude).toFixed(2)),
    }))
    .filter((item) => item.distance_km <= maxKm)
    .sort((a, b) => a.distance_km - b.distance_km);
};

module.exports = { getDistanceKm, calculateETA, filterAndSortByDistance };