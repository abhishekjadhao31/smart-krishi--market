import api from './client.js';

export const searchMatches = (payload) => api.post('/match/search', payload);
