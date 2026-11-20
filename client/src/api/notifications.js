import { http } from './http.js';

export const listNotifications = (limit = 30) => http.get('/notifications', { params: { limit } }).then((r) => r.data);
export const getUnreadCount = () => http.get('/notifications/unread-count').then((r) => r.data.unreadCount);
export const markRead = (id) => http.post(`/notifications/${id}/read`);
export const markAllRead = () => http.post('/notifications/read-all');
