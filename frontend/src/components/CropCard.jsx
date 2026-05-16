import { Link } from 'react-router-dom';

// Card used in dashboards and buyer search results.
export default function CropCard({ crop, actionLabel = 'View', actionTo }) {
  return (
    <div className="card flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-krishi-800">{crop.crop_name}</h3>
          <p className="text-xs text-gray-500">{crop.location}</p>
        </div>
        <span className="badge bg-krishi-100 text-krishi-700">
          {crop.quantity_kg} kg
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-gray-500">Asking price</p>
          <p className="font-medium text-gray-800">₹ {crop.expected_price ?? '—'}</p>
        </div>
        <div>
          <p className="text-gray-500">Harvest</p>
          <p className="font-medium text-gray-800">{crop.harvest_date ?? '—'}</p>
        </div>
      </div>
      {actionTo && (
        <Link to={actionTo} className="btn-primary w-full">
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
