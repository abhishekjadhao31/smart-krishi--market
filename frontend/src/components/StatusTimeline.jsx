import BookingStatusBadge from './BookingStatusBadge.jsx';

export default function StatusTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="text-sm text-gray-500">No shipment events yet.</p>;
  }

  return (
    <ol className="space-y-4">
      {events.map((event, index) => (
        <li key={event.id ?? `${event.status}-${index}`} className="relative pl-6">
          <span className="absolute left-2 top-2 h-full w-px bg-krishi-100" />
          <span className="absolute left-0 top-2 h-4 w-4 rounded-full border-2 border-krishi-500 bg-white" />
          <div className="flex flex-wrap items-center gap-2">
            <BookingStatusBadge status={event.status} />
            <span className="text-sm font-medium text-krishi-800">
              {event.note || 'Status updated'}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {event.created_by_name ? `by ${event.created_by_name} · ` : ''}
            {event.created_at ? new Date(event.created_at).toLocaleString() : 'just now'}
          </p>
        </li>
      ))}
    </ol>
  );
}
