import { Outlet } from 'react-router-dom';
import SubNav from '../../components/SubNav.jsx';

const ITEMS = [
  { to: '/pro', label: 'Overview', end: true },
  { to: '/pro/bookings', label: 'Bookings' },
  { to: '/pro/earnings', label: 'Earnings' },
  { to: '/pro/profile', label: 'Profile' },
  { to: '/pro/services', label: 'Services' },
  { to: '/pro/portfolio', label: 'Portfolio' },
  { to: '/pro/availability', label: 'Availability' },
  { to: '/pro/verification', label: 'Verification' },
];

export default function ProLayout() {
  return (
    <>
      <SubNav items={ITEMS} label="Professional" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Outlet />
      </main>
    </>
  );
}
