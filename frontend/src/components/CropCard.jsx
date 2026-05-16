import { Link } from 'react-router-dom';

// Card used in dashboards and buyer search results.
// `crop` is expected to be in normalized snake_case shape (see utils/normalize).
export default function CropCard({ crop, actionLabel = 'View', actionTo }) {
  const pricePerKg = crop.price_per_kg ?? crop.expected_price;
  const harvest = crop.harvest_date
    ? new Date(crop.harvest_date).toLocaleDateString()
    : '—';

  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-krishi-800">{crop.crop_name}</h3>
          <p className="text-xs text-gray-500">{crop.location || '—'}</p>
          {crop.variety && (
            <p className="text-xs text-gray-400">Variety: {crop.variety}</p>
          )}
        </div>
        <span className="badge bg-krishi-100 text-krishi-700">
          {Number(crop.quantity_kg).toLocaleString()} kg
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-500">Asking price</p>
          <p className="font-medium text-gray-800">
            {pricePerKg != null ? `₹ ${pricePerKg} / kg` : '—'}
          </p>
        </div>
        <div>
          <p className="text-gray-500">Harvest</p>
          <p className="font-medium text-gray-800">{harvest}</p>
        </div>
      </div>
      {crop.farmer_name && (
        <p className="text-xs text-gray-500">By {crop.farmer_name}</p>
      )}
      {actionTo && (
        <Link to={actionTo} className="btn-primary w-full">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
