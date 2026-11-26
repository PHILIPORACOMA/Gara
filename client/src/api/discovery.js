import { http } from './http.js';

// Drop empty filters so the URL and the request stay clean.
const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false));

export const searchPros = (filters) => http.get('/professionals', { params: clean(filters) }).then((r) => r.data.professionals);
export const getPro = (id) => http.get(`/professionals/${id}`).then((r) => r.data.professional);
export const getProReviews = (id, page = 1) => http.get(`/professionals/${id}/reviews`, { params: { page } }).then((r) => r.data);

// serviceIds: array of ids; mode: 'HOME' | 'STORE'
export const getSlots = (id, { date, mode, serviceIds }) =>
  http.get(`/professionals/${id}/slots`, { params: { date, mode, serviceIds: serviceIds.join(',') } }).then((r) => r.data);

// Signed-in customers only. Logs the tap and returns the Messenger, tel: or sms: link to open.
export const contactPro = (id, channel) => http.post(`/professionals/${id}/contact`, { channel }).then((r) => r.data);
