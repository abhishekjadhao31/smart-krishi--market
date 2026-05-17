import api from './client.js';

export const createConversation = (payload) => api.post('/conversations', payload);
export const getMyConversations = () => api.get('/my-conversations');
export const getConversationMessages = (conversationId) =>
  api.get(`/conversations/${conversationId}/messages`);
export const sendConversationMessage = (conversationId, text) =>
  api.post(`/conversations/${conversationId}/messages`, { text });
