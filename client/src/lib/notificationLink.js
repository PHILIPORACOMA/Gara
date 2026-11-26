import { BOOKINGS_ENABLED } from './features.js';

// Where tapping a notification should take each kind of user.
export function notificationLink(n, role) {
  // Discovery version: there are no booking pages to open.
  if (!BOOKINGS_ENABLED) {
    if (role === 'PROFESSIONAL') return n.type.startsWith('VERIFICATION_') ? '/pro/verification' : '/pro';
    if (role === 'ADMIN') return '/admin/verifications';
    return '/';
  }
  if (role === 'CUSTOMER') return n.bookingId ? `/bookings/${n.bookingId}` : '/bookings';
  if (role === 'PROFESSIONAL') {
    if (n.type === 'VERIFICATION_APPROVED' || n.type === 'VERIFICATION_REJECTED') return '/pro/verification';
    return '/pro/bookings';
  }
  // Admin
  if (n.type === 'DEPOSIT_SUBMITTED') return '/admin/deposits';
  return '/admin/bookings';
}
