import React from 'react';

export default function MatchCard({ item, onRequestContact, onNegotiate }) {
  const listing = item.listing || {};
  const scores = item.scores || {};

  return (
    <div className="card">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-lg">{listing.cropName} — {listing.farmerName}</h3>
          <p className="text-sm text-gray-600">{listing.district} • {listing.market || ''}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold text-krishi-700">{scores.totalScore != null ? scores.totalScore.toFixed(1) : '—'}</div>
          <div className="text-xs text-gray-500">match score</div>
        </div>
      </div>

      <div className="mt-2 text-sm text-gray-700">
        <div>Price: {listing.pricePerKg != null ? `₹${listing.pricePerKg}/kg` : '—'}</div>
        <div>Available: {listing.quantityKg != null ? `${listing.quantityKg} kg` : '—'}</div>
        <div>Harvest: {listing.harvestDate || '—'}</div>
      </div>

      <div className="mt-3 flex gap-2 items-center">
        {item.badges && item.badges.map((b) => (
          <span key={b} className="badge">{b}</span>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button className="btn-outline" onClick={() => onRequestContact(listing.id)}>Request contact</button>
        <button className="btn-primary" onClick={() => onNegotiate(listing.id)}>Negotiate</button>
      </div>
    </div>
  );
}
