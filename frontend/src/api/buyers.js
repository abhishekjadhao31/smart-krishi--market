import api from './client.js';

export const listBuyers = () => api.get('/buyers');
export const searchForBuyer = (payload) => api.post('/buyer/search', payload);
