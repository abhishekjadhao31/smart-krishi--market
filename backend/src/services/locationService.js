'use strict';

const axios = require('axios');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const SEARCH_LIMIT = 6;

const COMMON_LOCATIONS = [
  { label: 'Pune, Maharashtra', displayName: 'Pune, Maharashtra, India', latitude: 18.5204, longitude: 73.8567, city: 'Pune', state: 'Maharashtra', type: 'city' },
  { label: 'Mumbai, Maharashtra', displayName: 'Mumbai, Maharashtra, India', latitude: 19.076, longitude: 72.8777, city: 'Mumbai', state: 'Maharashtra', type: 'city' },
  { label: 'Nashik, Maharashtra', displayName: 'Nashik, Maharashtra, India', latitude: 19.9975, longitude: 73.7898, city: 'Nashik', state: 'Maharashtra', type: 'city' },
  { label: 'Nagpur, Maharashtra', displayName: 'Nagpur, Maharashtra, India', latitude: 21.1458, longitude: 79.0882, city: 'Nagpur', state: 'Maharashtra', type: 'city' },
  { label: 'Hyderabad, Telangana', displayName: 'Hyderabad, Telangana, India', latitude: 17.385, longitude: 78.4867, city: 'Hyderabad', state: 'Telangana', type: 'city' },
  { label: 'Bengaluru, Karnataka', displayName: 'Bengaluru, Karnataka, India', latitude: 12.9716, longitude: 77.5946, city: 'Bengaluru', state: 'Karnataka', type: 'city' },
  { label: 'Chennai, Tamil Nadu', displayName: 'Chennai, Tamil Nadu, India', latitude: 13.0827, longitude: 80.2707, city: 'Chennai', state: 'Tamil Nadu', type: 'city' },
  { label: 'Delhi, Delhi', displayName: 'Delhi, India', latitude: 28.7041, longitude: 77.1025, city: 'Delhi', state: 'Delhi', type: 'city' },
  { label: 'Ahmedabad, Gujarat', displayName: 'Ahmedabad, Gujarat, India', latitude: 23.0225, longitude: 72.5714, city: 'Ahmedabad', state: 'Gujarat', type: 'city' },
  { label: 'Jaipur, Rajasthan', displayName: 'Jaipur, Rajasthan, India', latitude: 26.9124, longitude: 75.7873, city: 'Jaipur', state: 'Rajasthan', type: 'city' },
  { label: 'Lucknow, Uttar Pradesh', displayName: 'Lucknow, Uttar Pradesh, India', latitude: 26.8467, longitude: 80.9462, city: 'Lucknow', state: 'Uttar Pradesh', type: 'city' },
  { label: 'Kanpur, Uttar Pradesh', displayName: 'Kanpur, Uttar Pradesh, India', latitude: 26.4499, longitude: 80.3319, city: 'Kanpur', state: 'Uttar Pradesh', type: 'city' },
  { label: 'Indore, Madhya Pradesh', displayName: 'Indore, Madhya Pradesh, India', latitude: 22.7196, longitude: 75.8577, city: 'Indore', state: 'Madhya Pradesh', type: 'city' },
  { label: 'Bhopal, Madhya Pradesh', displayName: 'Bhopal, Madhya Pradesh, India', latitude: 23.2599, longitude: 77.4126, city: 'Bhopal', state: 'Madhya Pradesh', type: 'city' },
  { label: 'Surat, Gujarat', displayName: 'Surat, Gujarat, India', latitude: 21.1702, longitude: 72.8311, city: 'Surat', state: 'Gujarat', type: 'city' },
  { label: 'Kolkata, West Bengal', displayName: 'Kolkata, West Bengal, India', latitude: 22.5726, longitude: 88.3639, city: 'Kolkata', state: 'West Bengal', type: 'city' },
  { label: 'Sangli Market, Maharashtra', displayName: 'Sangli Agricultural Produce Market Committee, Maharashtra, India', latitude: 16.8524, longitude: 74.5815, city: 'Sangli', state: 'Maharashtra', type: 'mandi' },
  { label: 'Lasalgaon Market, Maharashtra', displayName: 'Lasalgaon, Nashik, Maharashtra, India', latitude: 20.1124, longitude: 74.2304, city: 'Lasalgaon', state: 'Maharashtra', type: 'mandi' },
  { label: 'Vashi Market, Navi Mumbai', displayName: 'Vashi, Navi Mumbai, Maharashtra, India', latitude: 19.0748, longitude: 73.0051, city: 'Navi Mumbai', state: 'Maharashtra', type: 'mandi' },
];

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function scoreLocation(location, query) {
  const haystack = `${location.label} ${location.displayName} ${location.city} ${location.state}`.toLowerCase();
  let score = 0;
  if (haystack.startsWith(query)) score += 50;
  if (haystack.includes(query)) score += 20;
  if (location.type === 'mandi') score += 4;
  return score;
}

function dedupeSuggestions(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = `${item.label}|${Number(item.latitude).toFixed(4)}|${Number(item.longitude).toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function searchLocations(query, { limit = SEARCH_LIMIT } = {}) {
  const term = normalizeText(query);
  if (!term) return [];

  const localMatches = COMMON_LOCATIONS
    .filter((loc) => {
      const haystack = `${loc.label} ${loc.displayName} ${loc.city} ${loc.state}`.toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => scoreLocation(b, term) - scoreLocation(a, term))
    .slice(0, limit)
    .map((loc) => ({
      label: loc.label,
      displayName: loc.displayName,
      latitude: loc.latitude,
      longitude: loc.longitude,
      city: loc.city,
      state: loc.state,
      country: 'India',
      type: loc.type,
      source: 'local',
    }));

  let remoteMatches = [];
  try {
    const { data } = await axios.get(`${NOMINATIM_BASE}/search`, {
      params: {
        q: query,
        countrycodes: 'in',
        format: 'jsonv2',
        addressdetails: 1,
        limit,
      },
      headers: {
        'User-Agent': 'SmartKrishiMarket/1.0 (location search)',
      },
      timeout: 5000,
    });

    remoteMatches = (Array.isArray(data) ? data : []).map((item) => ({
      label: item.display_name?.split(',').slice(0, 2).join(', ') || item.display_name,
      displayName: item.display_name,
      latitude: Number(item.lat),
      longitude: Number(item.lon),
      city: item.address?.city || item.address?.town || item.address?.village || item.address?.county || '',
      state: item.address?.state || '',
      country: item.address?.country || 'India',
      type: item.type || 'place',
      source: 'nominatim',
    }));
  } catch (_err) {
    // Ignore remote failures and fall back to local suggestions.
  }

  return dedupeSuggestions([...localMatches, ...remoteMatches]).slice(0, limit);
}

async function reverseGeocode(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const { data } = await axios.get(`${NOMINATIM_BASE}/reverse`, {
      params: {
        lat,
        lon,
        format: 'jsonv2',
        addressdetails: 1,
      },
      headers: {
        'User-Agent': 'SmartKrishiMarket/1.0 (location reverse lookup)',
      },
      timeout: 5000,
    });

    return {
      label: data?.address?.city || data?.address?.town || data?.address?.village || data?.name || data?.display_name?.split(',').slice(0, 2).join(', ') || 'Current location',
      displayName: data?.display_name || 'Current location',
      latitude: lat,
      longitude: lon,
      city: data?.address?.city || data?.address?.town || data?.address?.village || data?.address?.county || '',
      state: data?.address?.state || '',
      country: data?.address?.country || 'India',
      source: 'nominatim',
    };
  } catch (_err) {
    return {
      label: 'Current location',
      displayName: 'Current location',
      latitude: lat,
      longitude: lon,
      city: '',
      state: '',
      country: 'India',
      source: 'browser',
    };
  }
}

async function resolveLocation(input, fallbackLatitude, fallbackLongitude) {
  if (input && typeof input === 'object') {
    const latitude = Number(input.latitude ?? input.lat ?? fallbackLatitude);
    const longitude = Number(input.longitude ?? input.lon ?? input.lng ?? fallbackLongitude);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return {
        label: input.label || input.displayName || 'Selected location',
        displayName: input.displayName || input.label || 'Selected location',
        latitude,
        longitude,
        city: input.city || '',
        state: input.state || '',
        country: input.country || 'India',
        source: input.source || 'client',
      };
    }
  }

  if (typeof input === 'string' && input.trim()) {
    const matches = await searchLocations(input, { limit: 1 });
    if (matches[0]) return matches[0];
  }

  const latitude = Number(fallbackLatitude);
  const longitude = Number(fallbackLongitude);
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return reverseGeocode(latitude, longitude);
  }

  return null;
}

module.exports = {
  searchLocations,
  reverseGeocode,
  resolveLocation,
};