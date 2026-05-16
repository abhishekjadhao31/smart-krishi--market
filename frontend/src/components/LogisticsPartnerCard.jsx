export default function LogisticsPartnerCard({ partner, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect?.(partner)}
      className={`card w-full text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'ring-2 ring-krishi-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-krishi-800">{partner.partnerName}</h3>
          <p className="text-sm text-gray-600">{partner.vehicleType.replace(/_/g, ' ')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-krishi-700">₹{Number(partner.estimatedCost).toLocaleString()}</p>
          <p className="text-xs text-gray-500">estimated</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-gray-700 sm:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Score</p>
          <p className="font-medium">{partner.score}/100</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Distance</p>
          <p className="font-medium">{partner.routeDistanceKm ?? partner.distanceFromPickup} km</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Capacity</p>
          <p className="font-medium">{Number(partner.capacity).toLocaleString()} kg</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Availability</p>
          <p className="font-medium">{partner.available ? 'Available' : 'Booked'}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span className="badge bg-krishi-100 text-krishi-700">{partner.suitability}</span>
        {partner.coldStorageSupported && <span className="badge bg-sky-100 text-sky-700">Cold storage</span>}
        <span className="badge bg-gray-100 text-gray-700">{partner.phone}</span>
      </div>
    </button>
  );
}
