import { useEffect, useMemo, useState } from 'react';
import LocationPicker from './LocationPicker.jsx';

const emptyForm = (defaults = {}) => ({
  listingId: defaults.listingId || '',
  quantityKg: defaults.quantityKg || '',
  pickupLocation: defaults.pickupLocation || '',
  pickupCoords: defaults.pickupCoords || null,
  dropLocation: defaults.dropLocation || '',
  dropCoords: defaults.dropCoords || null,
  pickupDate: defaults.pickupDate || '',
  deliveryDate: defaults.deliveryDate || '',
  coldStorageRequired: defaults.coldStorageRequired || false,
  notes: defaults.notes || '',
});

export default function TransportBookingModal({
  open,
  listing,
  partner,
  routeEstimate,
  costBreakdown,
  defaultValues,
  onClose,
  onConfirm,
  confirming,
  error,
}) {
  const [form, setForm] = useState(emptyForm(defaultValues));

  useEffect(() => {
    if (open) {
      setForm(emptyForm(defaultValues));
    }
  }, [open, defaultValues]);

  const totalCost = useMemo(() => {
    if (routeEstimate?.estimatedCost != null) return routeEstimate.estimatedCost;
    if (costBreakdown?.['Base (distance × rate)'] != null) {
      const breakdownTotal = Object.values(costBreakdown).reduce((sum, value) => sum + Number(value || 0), 0);
      return breakdownTotal;
    }
    return partner?.estimatedCost || null;
  }, [routeEstimate, costBreakdown, partner]);

  if (!open) return null;

  const handleChange = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleLocationChange = (field, text) => setForm((prev) => ({
    ...prev,
    [field]: text,
    [`${field}Coords`]: null,
  }));

  const handleLocationSelect = (field, location) => setForm((prev) => ({
    ...prev,
    [field]: location?.label || location?.displayName || '',
    [`${field}Coords`]: location
      ? {
          latitude: Number(location.latitude),
          longitude: Number(location.longitude),
          label: location.label || location.displayName || '',
          displayName: location.displayName || location.label || '',
          city: location.city || '',
          state: location.state || '',
          country: location.country || 'India',
          source: location.source || 'search',
        }
      : null,
  }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const pickupLatitude = Number(form.pickupCoords?.latitude);
    const pickupLongitude = Number(form.pickupCoords?.longitude);
    const dropLatitude = Number(form.dropCoords?.latitude);
    const dropLongitude = Number(form.dropCoords?.longitude);
    onConfirm?.({
      ...form,
      quantityKg: Number(form.quantityKg),
      pickupLatitude: Number.isFinite(pickupLatitude) ? pickupLatitude : undefined,
      pickupLongitude: Number.isFinite(pickupLongitude) ? pickupLongitude : undefined,
      dropLatitude: Number.isFinite(dropLatitude) ? dropLatitude : undefined,
      dropLongitude: Number.isFinite(dropLongitude) ? dropLongitude : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-krishi-900">Confirm transport booking</h2>
            <p className="text-sm text-gray-600">
              {partner ? `${partner.partnerName} · ${partner.vehicleType.replace(/_/g, ' ')}` : 'Select a partner to continue'}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="label">Crop listing</label>
            <input className="input" value={listing?.crop_name || ''} disabled />
          </div>
          <div>
            <label className="label">Quantity (kg)</label>
            <input className="input" type="number" value={form.quantityKg} onChange={(e) => handleChange('quantityKg', e.target.value)} min="1" required />
          </div>
          <LocationPicker
            label="Pickup place"
            placeholder="Search the crop pickup location"
            helperText="Where should the truck collect the crop from?"
            value={form.pickupLocation}
            selectedLocation={form.pickupCoords}
            onChange={(text) => handleLocationChange('pickupLocation', text)}
            onSelect={(location) => handleLocationSelect('pickupLocation', location)}
            onUseCurrentLocation={(location) => handleLocationSelect('pickupLocation', location)}
          />
          <LocationPicker
            label="Delivery place"
            placeholder="Search the delivery address"
            helperText="Where should the truck deliver the crop?"
            value={form.dropLocation}
            selectedLocation={form.dropCoords}
            onChange={(text) => handleLocationChange('dropLocation', text)}
            onSelect={(location) => handleLocationSelect('dropLocation', location)}
            onUseCurrentLocation={(location) => handleLocationSelect('dropLocation', location)}
          />
          <div>
            <label className="label">Pickup date</label>
            <input className="input" type="datetime-local" value={form.pickupDate} onChange={(e) => handleChange('pickupDate', e.target.value)} required />
          </div>
          <div>
            <label className="label">Delivery date</label>
            <input className="input" type="datetime-local" value={form.deliveryDate} onChange={(e) => handleChange('deliveryDate', e.target.value)} required />
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <input id="coldStorageRequired" type="checkbox" checked={form.coldStorageRequired} onChange={(e) => handleChange('coldStorageRequired', e.target.checked)} />
            <label htmlFor="coldStorageRequired" className="text-sm text-gray-700">Require cold storage support</label>
          </div>
          <div className="md:col-span-2">
            <label className="label">Notes</label>
            <textarea className="input min-h-28 resize-none" value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Loading instructions, gate numbers, contact preference..." />
          </div>

          <div className="md:col-span-2 grid gap-3 rounded-2xl bg-krishi-50 p-4 sm:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Estimated distance</p>
              <p className="text-lg font-semibold text-krishi-800">{routeEstimate?.distanceKm != null ? `${routeEstimate.distanceKm} km` : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Estimated delivery</p>
              <p className="text-lg font-semibold text-krishi-800">{routeEstimate?.estimatedDeliveryDays != null ? `${routeEstimate.estimatedDeliveryDays} day(s)` : '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500">Estimated cost</p>
              <p className="text-lg font-semibold text-krishi-800">{totalCost != null ? `₹${Number(totalCost).toLocaleString()}` : '—'}</p>
            </div>
          </div>

          {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}

          <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
            <button type="submit" className="btn-primary" disabled={confirming || !partner}>
              {confirming ? 'Booking...' : 'Confirm booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
