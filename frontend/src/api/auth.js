import api from './client.js';

export const registerUser = (payload) => api.post('/auth/register', payload);
export const loginUser = (payload) => api.post('/auth/login', payload);
