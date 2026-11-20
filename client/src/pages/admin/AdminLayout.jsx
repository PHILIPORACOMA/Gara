import { Outlet } from 'react-router-dom';
import SubNav from '../../components/SubNav.jsx';

const ITEMS = [
  { to: '/admin', label: 'Overview', end: true },
  { to: '/admin/verifications', label: 'Verifications' },
  { to: '/admin/deposits', label: 'Deposits' },
  { to: '/admin/bookings', label: 'Bookings' },
  { to: '/admin/settings', label: 'Settings' },
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
