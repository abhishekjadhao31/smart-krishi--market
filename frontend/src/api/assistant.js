import api from './client.js';

export const chatWithAssistant = (payload) => api.post('/assistant/chat', payload);