import api from './client.js';

export const createNegotiation = (payload) => api.post('/negotiations', payload);
export const listNegotiationsForUser = (userId) => api.get(`/negotiations/user/${userId}`);
export const respondToNegotiation = (id, payload) => api.post(`/negotiations/${id}/respond`, payload);
