// Workbook v3: Gara is a discovery and contact platform (no bookings or payments).
// The booking screens stay in the code base but are hidden unless VITE_FEATURE_BOOKINGS=true,
// which must match FEATURE_BOOKINGS on the server. Git tag booking-mvp has the full version.
export const BOOKINGS_ENABLED = import.meta.env.VITE_FEATURE_BOOKINGS === 'true';
