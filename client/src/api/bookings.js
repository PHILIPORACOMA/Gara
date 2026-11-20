import { http } from './http.js';

export const quote = (payload) => http.post('/bookings/quote', payload).then((r) => r.data.quote);
export const createBooking = (payload) => http.post('/bookings', payload).then((r) => r.data.booking);
export const listMyBookings = (tab = 'all') => http.get('/bookings', { params: { tab } }).then((r) => r.data);
export const getBooking = (id) => http.get(`/bookings/${id}`).then((r) => r.data.booking);
export const cancelBooking = (id) => http.post(`/bookings/${id}/cancel`).then((r) => r.data.booking);

export const reviewBooking = (id, payload) => http.post(`/bookings/${id}/review`, payload).then((r) => r.data.review);

export function submitDeposit(id, { gcashRef, screenshot }) {
  const form = new FormData();
  form.append('gcashRef', gcashRef);
  form.append('screenshot', screenshot);
  return http.post(`/bookings/${id}/deposit`, form).then((r) => r.data.booking);
}
