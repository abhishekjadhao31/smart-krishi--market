import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Fix default icon paths for Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function MapPreview({ pickupLat, pickupLon, dropLat, dropLon, partners = [], height = 300 }) {
  const hasPickup = pickupLat !== '' && pickupLat !== undefined && pickupLat !== null && pickupLon !== '' && pickupLon !== undefined && pickupLon !== null;
  const hasDrop = dropLat !== '' && dropLat !== undefined && dropLat !== null && dropLon !== '' && dropLon !== undefined && dropLon !== null;

  const center = (() => {
    if (hasPickup && hasDrop) {
      return [(Number(pickupLat) + Number(dropLat)) / 2, (Number(pickupLon) + Number(dropLon)) / 2];
    }
    if (hasPickup) return [Number(pickupLat), Number(pickupLon)];
    if (hasDrop) return [Number(dropLat), Number(dropLon)];
    return [20.5937, 78.9629]; // India approximate centre
  })();

  const markers = [];
  if (hasPickup) markers.push({ id: 'pickup', lat: Number(pickupLat), lon: Number(pickupLon), label: 'Pickup' });
  if (hasDrop) markers.push({ id: 'drop', lat: Number(dropLat), lon: Number(dropLon), label: 'Drop' });

  partners.forEach((p) => {
    if (p.latitude && p.longitude) markers.push({ id: `p-${p.partnerId || p.id || Math.random()}`, lat: Number(p.latitude), lon: Number(p.longitude), label: p.name || p.partnerName || p.company || `Partner ${p.partnerId || p.id}` });
  });

  return (
    <div className="rounded-2xl overflow-hidden border" style={{ height }}>
      <MapContainer center={center} zoom={6} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lon]}>
            <Popup>
              <div className="text-sm">
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs">{m.lat.toFixed(4)}, {m.lon.toFixed(4)}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
