// Where tapping a notification should take each kind of user.
export function notificationLink(n, role) {
  if (role === 'CUSTOMER') return n.bookingId ? `/bookings/${n.bookingId}` : '/bookings';
  if (role === 'PROFESSIONAL') {
    if (n.type === 'VERIFICATION_APPROVED' || n.type === 'VERIFICATION_REJECTED') return '/pro/verification';
    return '/pro/bookings';
  }
  // Admin
  if (n.type === 'DEPOSIT_SUBMITTED') return '/admin/deposits';
  return '/admin/bookings';
}
