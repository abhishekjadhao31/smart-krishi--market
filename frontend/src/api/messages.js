import api from './client.js';

export const sendMessage = (payload) => api.post('/messages', payload);
export const getInbox = (params = {}) => api.get('/messages/inbox', { params });
export const getSent = (params = {}) => api.get('/messages/sent', { params });
export const markAsRead = (messageId) => api.put(`/messages/${messageId}/read`);
export const getUnreadCount = () => api.get('/messages/unread-count');
