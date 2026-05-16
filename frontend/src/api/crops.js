import api from './client.js';

export const listCrops = (params) => api.get('/crops', { params });
export const createCrop = (payload) => api.post('/crops', payload);
export const getCrop = (id) => api.get(`/crops/${id}`);
export const predictForCrop = (payload) => api.post('/predict', payload);
