// All scheduling is done in Philippine time (UTC+8, no daylight saving).
export const TIMEZONE = 'Asia/Manila';

// Slot start times are offered on this grid (minutes).
export const SLOT_INTERVAL_MIN = 30;

export const ROLES = ['CUSTOMER', 'PROFESSIONAL', 'ADMIN'];
export const CATEGORIES = ['HAIR', 'NAILS', 'MAKEUP'];
export const SERVICE_MODES = ['HOME', 'STORE', 'BOTH'];
export const BOOKING_MODES = ['HOME', 'STORE'];
export const OCCASIONS = ['WEDDING', 'GRADUATION', 'DEBUT', 'BIRTHDAY', 'PHOTOSHOOT', 'OTHER'];

// Cebu City and nearby areas a professional can serve.
export const AREAS = [
  'Cebu City',
  'Mandaue City',
  'Lapu-Lapu City',
  'Talisay City',
  'Minglanilla',
  'Naga City',
  'Consolacion',
  'Liloan',
  'Cordova',
  'Compostela',
];

// A booking in one of these statuses occupies the pro's calendar.
// (PENDING_DEPOSIT only holds the slot until holdExpiresAt.)
export const ACTIVE_BOOKING_STATUSES = [
  'PENDING_DEPOSIT',
  'DEPOSIT_SUBMITTED',
  'DEPOSIT_VERIFIED',
  'CONFIRMED',
];

export const UPLOAD_LIMITS = {
  imageMaxBytes: 5 * 1024 * 1024,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
};
