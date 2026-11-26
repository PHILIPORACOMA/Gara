import { http } from './http.js';

const data = (r) => r.data;

export const getProfile = () => http.get('/pro/profile').then(data);
export const updateProfile = (payload) => http.put('/pro/profile', payload).then(data);

export const listServices = () => http.get('/pro/services').then((r) => r.data.services);
export const createService = (payload) => http.post('/pro/services', payload).then((r) => r.data.service);
export const updateService = (id, payload) => http.put(`/pro/services/${id}`, payload).then((r) => r.data.service);
export const removeService = (id) => http.delete(`/pro/services/${id}`);

export function uploadPortfolio(files) {
  const form = new FormData();
  files.forEach((f) => form.append('images', f));
  return http.post('/pro/portfolio', form).then((r) => r.data.images);
}
export const deletePortfolioImage = (id) => http.delete(`/pro/portfolio/${id}`);

export const getAvailability = () => http.get('/pro/availability').then((r) => r.data.rules);
export const saveAvailability = (rules) => http.put('/pro/availability', { rules }).then((r) => r.data.rules);
export const listBlockedDates = () => http.get('/pro/blocked-dates').then((r) => r.data.blockedDates);
export const addBlockedDate = (payload) => http.post('/pro/blocked-dates', payload).then((r) => r.data.blockedDate);
export const removeBlockedDate = (id) => http.delete(`/pro/blocked-dates/${id}`);

// Profile views and contact taps (last 7 and 30 days).
export const getInsights = () => http.get('/pro/insights').then(data);
export const getDashboard = () => http.get('/pro/dashboard').then(data);
export const listBookings = (tab) => http.get('/pro/bookings', { params: { tab } }).then(data);
export const getCalendar = (month) => http.get('/pro/calendar', { params: { month } }).then(data);
export const getEarnings = (page = 1) => http.get('/pro/earnings', { params: { page } }).then(data);
export const acceptBooking = (id) => http.post(`/pro/bookings/${id}/accept`).then((r) => r.data.booking);
export const declineBooking = (id, reason) => http.post(`/pro/bookings/${id}/decline`, { reason }).then((r) => r.data.booking);
export const completeBooking = (id) => http.post(`/pro/bookings/${id}/complete`).then((r) => r.data.booking);
export const markNoShow = (id) => http.post(`/pro/bookings/${id}/no-show`).then((r) => r.data.booking);

// idFile is optional when an ID is already on file (re-submitting after a rejection).
export function submitVerification(idFile) {
  const form = new FormData();
  if (idFile) form.append('idImage', idFile);
  return http.post('/pro/verification', form).then(data);
}
