const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-sky-100 text-sky-800',
  in_transit: 'bg-emerald-100 text-emerald-800',
  delivered: 'bg-krishi-100 text-krishi-800',
  cancelled: 'bg-red-100 text-red-700',
};

const LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_transit: 'In transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

export default function BookingStatusBadge({ status }) {
  const normalized = status || 'pending';
  return (
    <span className={`badge ${STATUS_STYLES[normalized] || 'bg-gray-100 text-gray-700'}`}>
      {LABELS[normalized] || normalized}
    </span>
  );
}
