// Status tabs for "My bookings". The API returns every booking; tabs filter them locally,
// so switching tabs is instant. Keep in sync with CUSTOMER_TABS / PRO_TABS on the server.
export const CUSTOMER_TABS = [
  { key: 'awaiting', label: 'Awaiting', statuses: ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED'] },
  { key: 'upcoming', label: 'Upcoming', statuses: ['CONFIRMED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED', 'DECLINED', 'NO_SHOW'] },
];

export const PRO_TABS = [
  { key: 'requests', label: 'Requests', statuses: ['DEPOSIT_VERIFIED'] },
  { key: 'upcoming', label: 'Upcoming', statuses: ['CONFIRMED'] },
  { key: 'awaiting', label: 'Awaiting payment', statuses: ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED'] },
  { key: 'completed', label: 'Completed', statuses: ['COMPLETED'] },
  { key: 'cancelled', label: 'Cancelled', statuses: ['CANCELLED', 'DECLINED', 'NO_SHOW'] },
];

export const withCounts = (tabs, bookings) =>
  tabs.map((t) => ({ ...t, count: bookings.filter((b) => t.statuses.includes(b.status)).length }));

// Open on the first tab that has something in it, else the fallback.
export const firstNonEmptyTab = (tabs, fallback) => tabs.find((t) => t.count > 0)?.key ?? fallback;

// Upcoming/awaiting read best soonest-first, finished ones newest-first.
export function filterAndSort(bookings, tab, tabs) {
  const def = tabs.find((t) => t.key === tab);
  const rows = bookings.filter((b) => def.statuses.includes(b.status));
  const newestFirst = ['completed', 'cancelled'].includes(tab);
  return rows.sort((a, b) => (newestFirst ? new Date(b.startAt) - new Date(a.startAt) : new Date(a.startAt) - new Date(b.startAt)));
}
