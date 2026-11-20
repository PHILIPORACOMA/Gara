export const CATEGORY_LABELS = { HAIR: 'Hair', NAILS: 'Nails', MAKEUP: 'Makeup' };

export const SERVICE_MODE_LABELS = {
  HOME: 'Home service',
  STORE: 'In-store',
  BOTH: 'Home service and in-store',
};

export const VERIFICATION_LABELS = {
  UNSUBMITTED: 'Not submitted',
  PENDING: 'Pending review',
  APPROVED: 'Verified',
  REJECTED: 'Needs changes',
};

export const VERIFICATION_TONES = {
  UNSUBMITTED: 'neutral',
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'danger',
};

export const BOOKING_STATUS = {
  PENDING_DEPOSIT: { label: 'Awaiting deposit', tone: 'warning' },
  DEPOSIT_SUBMITTED: { label: 'Deposit under review', tone: 'info' },
  DEPOSIT_VERIFIED: { label: 'Waiting for pro', tone: 'info' },
  CONFIRMED: { label: 'Confirmed', tone: 'success' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral' },
  DECLINED: { label: 'Declined', tone: 'danger' },
  NO_SHOW: { label: 'No-show', tone: 'danger' },
};

export const OCCASION_LABELS = {
  WEDDING: 'Wedding',
  GRADUATION: 'Graduation',
  DEBUT: 'Debut',
  BIRTHDAY: 'Birthday',
  PHOTOSHOOT: 'Photoshoot',
  OTHER: 'Other event',
};

export const BOOKING_MODE_LABELS = { HOME: 'Home service', STORE: 'In-store' };

export const DAY_LABELS = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday', 7: 'Sunday' };

// 90 -> "1 hr 30 min"
export function formatDuration(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h} hr ${m} min`;
  if (h) return `${h} hr`;
  return `${m} min`;
}
