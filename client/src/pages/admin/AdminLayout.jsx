import { Outlet } from 'react-router-dom';
import SubNav from '../../components/SubNav.jsx';
import { BOOKINGS_ENABLED } from '../../lib/features.js';

const ITEMS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/verifications', label: 'Verifications' },
  ...(BOOKINGS_ENABLED ? [{ to: '/admin/deposits', label: 'Deposits' }] : []),
  ...(BOOKINGS_ENABLED ? [{ to: '/admin/bookings', label: 'Bookings' }] : []),
  ...(BOOKINGS_ENABLED ? [{ to: '/admin/settings', label: 'Settings' }] : []),
];

export default function AdminLayout() {
  return (
    <>
      <SubNav items={ITEMS} label="Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}
