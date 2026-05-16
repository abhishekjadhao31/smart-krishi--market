import api from './client.js';

export const createBuyerRequest = (payload) => api.post('/buyer-requests', payload);
export const listBuyerRequests = (params) => api.get('/buyer-requests', { params });
export const getMatchesForBuyer = (buyerId) => api.get(`/buyer-requests/matches/${buyerId}`);
