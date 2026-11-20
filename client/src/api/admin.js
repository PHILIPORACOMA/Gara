import { http } from './http.js';

export const listVerifications = (status = 'PENDING') =>
  http.get('/admin/verifications', { params: { status } }).then((r) => r.data.verifications);
export const approveVerification = (id) => http.post(`/admin/verifications/${id}/approve`).then((r) => r.data.verification);
export const rejectVerification = (id, reason) =>
  http.post(`/admin/verifications/${id}/reject`, { reason }).then((r) => r.data.verification);

export const getMetrics = () => http.get('/admin/metrics').then((r) => r.data.metrics);
export const getSettings = () => http.get('/admin/settings').then((r) => r.data.settings);
export const updateSettings = (payload) => http.put('/admin/settings', payload).then((r) => r.data.settings);
export function uploadQr(file) {
  const form = new FormData();
  form.append('qr', file);
  return http.post('/admin/settings/qr', form).then((r) => r.data.settings);
}

export const listDeposits = () => http.get('/admin/deposits').then((r) => r.data.bookings);
export const verifyDeposit = (id) => http.post(`/admin/bookings/${id}/deposit/verify`).then((r) => r.data.booking);
export const rejectDeposit = (id, note) => http.post(`/admin/bookings/${id}/deposit/reject`, { note }).then((r) => r.data.booking);
export const listAllBookings = (filters) => http.get('/admin/bookings', { params: filters }).then((r) => r.data);
export const resolveRefund = (id) => http.post(`/admin/bookings/${id}/refund-resolved`).then((r) => r.data.booking);

// Private files need the Authorization header, so <img src> cannot load them directly:
// fetch the bytes and hand the browser an object URL.
export async function fetchPrivateImage(path) {
  const res = await http.get(`/files/private/${path}`, { responseType: 'blob' });
  return URL.createObjectURL(res.data);
}
