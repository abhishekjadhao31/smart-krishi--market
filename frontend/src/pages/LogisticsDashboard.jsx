import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Loader from '../components/Loader.jsx';
import AnalyticsCard from '../components/AnalyticsCard.jsx';
import LogisticsPartnerCard from '../components/LogisticsPartnerCard.jsx';
import BookingStatusBadge from '../components/BookingStatusBadge.jsx';
import StatusTimeline from '../components/StatusTimeline.jsx';
import TransportBookingModal from '../components/TransportBookingModal.jsx';
import MapPreview from '../components/MapPreview.jsx';
import LocationPicker from '../components/LocationPicker.jsx';
import { listCrops } from '../api/crops.js';
import {
  createTransportBooking,
  getNearbyLogistics,
  getTransportBooking,
  getTransportBookingEvents,
  listTransportBookings,
  updateTransportBookingStatus,
} from '../api/logistics.js';
import { extractCropList } from '../utils/normalize.js';

const statusOptions = ['pending', 'confirmed', 'in_transit', 'delivered', 'cancelled'];

const formatDateTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
};

export default function LogisticsDashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const prefillCropId = searchParams.get('cropId');

  const [crops, setCrops] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [finding, setFinding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pageError, setPageError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedCropId, setSelectedCropId] = useState(prefillCropId || '');
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingEvents, setBookingEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [statusForm, setStatusForm] = useState({ status: 'confirmed', note: '' });
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingModalError, setBookingModalError] = useState('');
  const [routeEstimate, setRouteEstimate] = useState(null);
  const [routePreview, setRoutePreview] = useState(null);
  const [costBreakdown, setCostBreakdown] = useState(null);
  const [shipForm, setShipForm] = useState({
    qty: '',
    pickupLocation: '',
    pickupCoords: null,
    dropLocation: '',
    dropCoords: null,
    coldStorage: false,
    radius: 100,
    pickupDate: '',
    deliveryDate: '',
    notes: '',
  });

  const selectedCrop = useMemo(
    () => crops.find((crop) => String(crop.id) === String(selectedCropId)) || null,
    [crops, selectedCropId]
  );

  const loadInitialData = async () => {
    setLoading(true);
    setPageError('');
    try {
      const [cropRes, bookingRes] = await Promise.allSettled([
        listCrops(user?.role === 'farmer' ? { mine: true } : {}),
        listTransportBookings(),
      ]);

      if (cropRes.status === 'fulfilled') {
        const nextCrops = extractCropList(cropRes.value.data);
        setCrops(nextCrops);
        if (!selectedCropId && nextCrops[0]) {
          setSelectedCropId(String(nextCrops[0].id));
        }
      }

      if (bookingRes.status === 'fulfilled') {
        setBookings(bookingRes.value.data?.data || bookingRes.value.data?.rows || bookingRes.value.data || []);
      }
    } catch (err) {
      setPageError(err.response?.data?.message || err.message || 'Failed to load logistics dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role]);

  useEffect(() => {
    if (!prefillCropId) return;
    setSelectedCropId(prefillCropId);
  }, [prefillCropId]);

  useEffect(() => {
    if (!selectedCrop) return;
    const cropLocation = selectedCrop.location || [selectedCrop.market, selectedCrop.district, selectedCrop.state].filter(Boolean).join(', ');
    const cropCoords = selectedCrop.latitude != null && selectedCrop.longitude != null
      ? { latitude: selectedCrop.latitude, longitude: selectedCrop.longitude, label: cropLocation, displayName: cropLocation, source: 'crop' }
      : null;
    setShipForm((prev) => ({
      ...prev,
      qty: selectedCrop.quantity_kg || prev.qty,
      pickupLocation: prev.pickupLocation || cropLocation,
      pickupCoords: prev.pickupCoords || cropCoords,
    }));
  }, [selectedCrop]);

  const handleShipChange = (field, value) => {
    setShipForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLocationChange = (field, text) => {
    setShipForm((prev) => ({
      ...prev,
      [field]: text,
      [`${field}Coords`]: null,
    }));
    setRoutePreview(null);
  };

  const handleLocationSelect = (field, location) => {
    setShipForm((prev) => ({
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
    setRoutePreview(null);
  };

  const estimateLogistics = async (e) => {
    e.preventDefault();
    if (!selectedCrop) {
      setPageError('Select a crop listing before estimating transport.');
      return;
    }

    setFinding(true);
    setPageError('');
    setSuccess('');
    try {
      const { data } = await getNearbyLogistics({
        pickupLocation: shipForm.pickupLocation,
        dropLocation: shipForm.dropLocation,
        pickupLat: shipForm.pickupCoords?.latitude,
        pickupLon: shipForm.pickupCoords?.longitude,
        dropLat: shipForm.dropCoords?.latitude,
        dropLon: shipForm.dropCoords?.longitude,
        qty: Number(shipForm.qty || selectedCrop.quantity_kg || 0),
        cold: shipForm.coldStorage,
        radius: Number(shipForm.radius),
      });
      setPartners(data?.data || data || []);
      setRoutePreview(data?.route || null);
      setSelectedPartner(null);
      if ((data?.data || data || []).length === 0) {
        setSuccess('No partners matched the current route. Try widening the radius or lowering the quantity.');
      }
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to estimate logistics.');
      setPartners([]);
    } finally {
      setFinding(false);
    }
  };

  const openConfirmModal = (partner) => {
    setSelectedPartner(partner);
    setRouteEstimate({
      distanceKm: partner.routeDistanceKm ?? partner.distanceFromPickup,
      estimatedDeliveryDays: Math.max(1, Math.ceil((partner.routeDistanceKm ?? partner.distanceFromPickup) / 300)),
      estimatedCost: partner.estimatedCost,
      partnerName: partner.partnerName,
      vehicleType: partner.vehicleType,
    });
    setCostBreakdown(partner.costBreakdown || null);
    setBookingModalError('');
    setBookingModalOpen(true);
  };

  const handleCreateBooking = async (payload) => {
    if (!selectedCrop || !selectedPartner) return;
    setConfirming(true);
    setBookingModalError('');
    try {
      const { data } = await createTransportBooking({
        listingId: selectedCrop.id,
        buyerId: user?.role === 'buyer' ? user.id : null,
        farmerId: selectedCrop.farmer_id,
        logisticsId: selectedPartner.partnerId,
        pickupLocation: payload.pickupLocation,
        dropLocation: payload.dropLocation,
        pickupLatitude: payload.pickupLatitude,
        pickupLongitude: payload.pickupLongitude,
        dropLatitude: payload.dropLatitude,
        dropLongitude: payload.dropLongitude,
        pickupDate: payload.pickupDate,
        deliveryDate: payload.deliveryDate,
        coldStorageRequired: payload.coldStorageRequired,
        notes: payload.notes,
      });
      setBookingModalOpen(false);
      setSelectedPartner(null);
      setSuccess(`Booking created successfully. Tracking ID ${data?.data?.id || data?.id || 'assigned'}.`);
      await loadInitialData();
    } catch (err) {
      setBookingModalError(err.response?.data?.message || 'Failed to create booking');
    } finally {
      setConfirming(false);
    }
  };

  const openBookingDetails = async (booking) => {
    setSelectedBooking(booking);
    setEventsLoading(true);
    setPageError('');
    try {
      const [bookingRes, eventsRes] = await Promise.all([
        getTransportBooking(booking.id),
        getTransportBookingEvents(booking.id),
      ]);
      setSelectedBooking(bookingRes.data?.data || bookingRes.data || booking);
      setBookingEvents(eventsRes.data?.data || eventsRes.data || []);
      setStatusForm({ status: booking.status, note: '' });
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to load booking details');
    } finally {
      setEventsLoading(false);
    }
  };

  const changeBookingStatus = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setEventsLoading(true);
    try {
      await updateTransportBookingStatus(selectedBooking.id, statusForm);
      setSuccess('Shipment status updated.');
      await loadInitialData();
      await openBookingDetails(selectedBooking);
    } catch (err) {
      setPageError(err.response?.data?.message || 'Failed to update shipment status');
    } finally {
      setEventsLoading(false);
    }
  };

  if (loading) {
    return <Loader label="Loading logistics dashboard..." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="badge bg-krishi-100 text-krishi-700">Transport workflow</p>
          <h1 className="mt-2 text-2xl font-bold text-krishi-900">Logistics dashboard</h1>
          <p className="text-sm text-gray-600">
            Plan shipment routes, compare available trucks, confirm bookings, and track status updates for farmers and buyers.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/buyer" className="btn-outline">Buyer dashboard</Link>
          <Link to="/farmer" className="btn-outline">Farmer dashboard</Link>
        </div>
      </div>

      {pageError && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{pageError}</div>}
      {success && <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">{success}</div>}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AnalyticsCard label="Available listings" value={crops.length} hint="pick a crop to move" />
        <AnalyticsCard label="Matched trucks" value={partners.length} hint="from current route" accent="soil" />
        <AnalyticsCard label="Tracked shipments" value={bookings.length} hint="live status flow" accent="amber" />
        <AnalyticsCard label="Your role" value={user?.role || 'guest'} hint="workflow access" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-6">
          <section className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-krishi-800">Shipment planner</h2>
                <p className="text-sm text-gray-600">Estimate distance and cost before booking a partner.</p>
              </div>
              <span className="badge bg-krishi-100 text-krishi-700">Responsive route optimizer</span>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <div>
                <label className="label">Crop listing</label>
                <select className="input" value={selectedCropId} onChange={(e) => setSelectedCropId(e.target.value)}>
                  {crops.map((crop) => (
                    <option key={crop.id} value={crop.id}>
                      {crop.crop_name} · {crop.quantity_kg} kg
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Quantity (kg)</label>
                <input className="input" type="number" min="1" value={shipForm.qty} onChange={(e) => handleShipChange('qty', e.target.value)} />
              </div>
              <div>
                <label className="label">Search radius (km)</label>
                <input className="input" type="number" min="1" value={shipForm.radius} onChange={(e) => handleShipChange('radius', e.target.value)} />
              </div>
              <div className="md:col-span-2 xl:col-span-3 grid gap-3 md:grid-cols-2">
                <LocationPicker
                  label="Pickup place"
                  placeholder="Search crop area, village, town or mandi"
                  helperText="Where is the crop ready for pickup?"
                  value={shipForm.pickupLocation}
                  selectedLocation={shipForm.pickupCoords}
                  onChange={(text) => handleLocationChange('pickupLocation', text)}
                  onSelect={(location) => handleLocationSelect('pickupLocation', location)}
                  onUseCurrentLocation={(location) => handleLocationSelect('pickupLocation', location)}
                />
                <LocationPicker
                  label="Delivery place"
                  placeholder="Search buyer location, market or warehouse"
                  helperText="Where should the truck deliver the crop?"
                  value={shipForm.dropLocation}
                  selectedLocation={shipForm.dropCoords}
                  onChange={(text) => handleLocationChange('dropLocation', text)}
                  onSelect={(location) => handleLocationSelect('dropLocation', location)}
                  onUseCurrentLocation={(location) => handleLocationSelect('dropLocation', location)}
                />
              </div>
              <div>
                <label className="label">Pickup date</label>
                <input className="input" type="datetime-local" value={shipForm.pickupDate} onChange={(e) => handleShipChange('pickupDate', e.target.value)} />
              </div>
              <div>
                <label className="label">Delivery date</label>
                <input className="input" type="datetime-local" value={shipForm.deliveryDate} onChange={(e) => handleShipChange('deliveryDate', e.target.value)} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={shipForm.coldStorage} onChange={(e) => handleShipChange('coldStorage', e.target.checked)} />
                Cold storage required
              </label>
              <button className="btn-primary" type="button" onClick={estimateLogistics} disabled={finding}>
                {finding ? 'Estimating...' : 'Estimate transport'}
              </button>
            </div>
          </section>

          <section className="card">
            <h2 className="text-lg font-semibold text-krishi-800">Map preview</h2>
            <p className="text-sm text-gray-600">Visual preview of pickup, drop and nearby partners.</p>
            <div className="mt-3">
              <MapPreview
                pickupLat={routePreview?.pickupLocation?.latitude ?? shipForm.pickupCoords?.latitude}
                pickupLon={routePreview?.pickupLocation?.longitude ?? shipForm.pickupCoords?.longitude}
                dropLat={routePreview?.dropLocation?.latitude ?? shipForm.dropCoords?.latitude}
                dropLon={routePreview?.dropLocation?.longitude ?? shipForm.dropCoords?.longitude}
                partners={partners}
                height={320}
              />
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-krishi-800">Available trucks and drivers</h2>
                <p className="text-sm text-gray-600">Ranked by score, capacity, proximity, and route cost.</p>
              </div>
            </div>

            {partners.length === 0 ? (
              <div className="card text-sm text-gray-600">
                No partners loaded yet. Fill the route form and run an estimate to see nearby trucks.
              </div>
            ) : (
              <div className="space-y-3">
                {partners.map((partner) => (
                  <LogisticsPartnerCard
                    key={partner.partnerId}
                    partner={partner}
                    selected={selectedPartner?.partnerId === partner.partnerId}
                    onSelect={openConfirmModal}
                  />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-krishi-800">Shipment tracker</h2>
                <p className="text-sm text-gray-600">Monitor booking state from pending to delivered.</p>
              </div>
              <BookingStatusBadge status={selectedBooking?.status || 'pending'} />
            </div>

            {selectedBooking ? (
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl bg-krishi-50 p-4 text-sm text-gray-700">
                  <p className="font-semibold text-krishi-800">{selectedBooking.listingName}</p>
                  <p>Farmer: {selectedBooking.farmerName || '—'}</p>
                  <p>Logistics: {selectedBooking.logisticsName || '—'}</p>
                  <p>Estimated cost: ₹{Number(selectedBooking.estimatedCost || 0).toLocaleString()}</p>
                  <p>Route: {Number(selectedBooking.distanceKm || 0).toFixed(1)} km</p>
                  <p>Pickup: {formatDateTime(selectedBooking.pickupDate)}</p>
                  <p>Delivery: {formatDateTime(selectedBooking.deliveryDate)}</p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-gray-700">Timeline</h3>
                  {eventsLoading ? <Loader label="Loading timeline..." /> : <StatusTimeline events={bookingEvents} />}
                </div>

                {user?.role !== 'buyer' && (
                  <form onSubmit={changeBookingStatus} className="space-y-3 border-t border-krishi-100 pt-4">
                    <div>
                      <label className="label">Update status</label>
                      <select className="input" value={statusForm.status} onChange={(e) => setStatusForm((prev) => ({ ...prev, status: e.target.value }))}>
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Note</label>
                      <textarea className="input min-h-24 resize-none" value={statusForm.note} onChange={(e) => setStatusForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Add loading, transit, or delivery note..." />
                    </div>
                    <button className="btn-primary w-full" type="submit" disabled={eventsLoading}>
                      Save status update
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-gray-500">Select a booking from the list below to inspect its tracking history.</p>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-krishi-800">Recent shipments</h2>
                <p className="text-sm text-gray-600">Farmer, logistics, and buyer workflow in one view.</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {bookings.length === 0 ? (
                <p className="text-sm text-gray-500">No transport bookings yet.</p>
              ) : (
                bookings.map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => openBookingDetails(booking)}
                    className={`w-full rounded-2xl border p-4 text-left transition hover:border-krishi-300 hover:bg-krishi-50 ${selectedBooking?.id === booking.id ? 'border-krishi-400 bg-krishi-50' : 'border-gray-100 bg-white'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-krishi-800">{booking.listingName}</h3>
                        <p className="text-xs text-gray-500">#{booking.id} · {booking.logisticsName}</p>
                      </div>
                      <BookingStatusBadge status={booking.status} />
                    </div>
                    <div className="mt-2 text-sm text-gray-600">
                      <p>Farmer: {booking.farmerName || '—'}</p>
                      <p>Buyer: {booking.buyerName || '—'}</p>
                      <p>Route: {Number(booking.distanceKm || 0).toFixed(1)} km · ₹{Number(booking.estimatedCost || 0).toLocaleString()}</p>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">Last update: {formatDateTime(booking.lastEventAt || booking.updatedAt)}</p>
                  </button>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>

      <TransportBookingModal
        open={bookingModalOpen}
        listing={selectedCrop}
        partner={selectedPartner}
        routeEstimate={routeEstimate}
        costBreakdown={costBreakdown}
        defaultValues={{
          listingId: selectedCrop?.id,
          quantityKg: shipForm.qty,
          pickupLocation: shipForm.pickupLocation,
          dropLocation: shipForm.dropLocation,
          pickupCoords: shipForm.pickupCoords,
          dropCoords: shipForm.dropCoords,
          pickupDate: shipForm.pickupDate,
          deliveryDate: shipForm.deliveryDate,
          coldStorageRequired: shipForm.coldStorage,
          notes: shipForm.notes,
        }}
        onClose={() => setBookingModalOpen(false)}
        onConfirm={handleCreateBooking}
        confirming={confirming}
        error={bookingModalError}
      />
    </div>
  );
}
