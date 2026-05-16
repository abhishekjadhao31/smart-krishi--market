import api from './client.js';

export const getNearbyLogistics = (params) => api.get('/logistics/nearby', { params });
export const createTransportBooking = (payload) => api.post('/logistics/transport-bookings', payload);
export const listTransportBookings = (params) => api.get('/logistics/transport-bookings', { params });
export const getTransportBooking = (id) => api.get(`/logistics/transport-bookings/${id}`);
export const getTransportBookingEvents = (id) => api.get(`/logistics/transport-bookings/${id}/events`);
export const updateTransportBookingStatus = (id, payload) => api.patch(`/logistics/transport-bookings/${id}/status`, payload);
export const searchLocations = (query, params = {}) => api.get('/logistics/locations/search', { params: { q: query, ...params } });
export const reverseLocation = (lat, lon) => api.get('/logistics/locations/reverse', { params: { lat, lon } });
