// Everything the user sees is in Philippine time, whatever the device timezone is.
export const TIMEZONE = 'Asia/Manila';

const dateFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIMEZONE,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const timeFmt = new Intl.DateTimeFormat('en-PH', {
  timeZone: TIMEZONE,
  hour: 'numeric',
  minute: '2-digit',
});
// en-CA formats as YYYY-MM-DD
const isoFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export const formatDate = (d) => dateFmt.format(new Date(d));
export const formatTime = (d) => timeFmt.format(new Date(d));
export const formatDateTime = (d) => `${formatDate(d)}, ${formatTime(d)}`;

// "YYYY-MM-DD" of an instant as seen in Manila.
export const toManilaIsoDate = (d = new Date()) => isoFmt.format(new Date(d));
export const todayManila = () => toManilaIsoDate(new Date());

// "2026-11-20" + 3 -> "2026-11-23" (calendar math on a Manila date)
export function addDaysIso(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00+08:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return toManilaIsoDate(d);
}

// Customers can book up to this many days ahead (same limit as the server).
export const MAX_ADVANCE_DAYS = 90;

// minutes from midnight -> "9:00 AM"
export function formatMinutes(min) {
  if (min >= 1440) return '12:00 AM'; // end of day
  const h = Math.floor(min / 60);
  const m = min % 60;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}
