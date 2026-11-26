import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roleHome.js';
import Button from './Button.jsx';
import NotificationBell from './NotificationBell.jsx';
import { BOOKINGS_ENABLED } from '../lib/features.js';

const linkClass = ({ isActive }) =>
  `rounded-control px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-100'}`;

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [location.pathname]);

  const links = [
    { to: '/', label: 'Home', end: true },
    { to: '/search', label: 'Find a pro' },
  ];
  if (user?.role === 'CUSTOMER') {
    if (BOOKINGS_ENABLED) links.push({ to: '/bookings', label: 'My bookings' });
  } else if (user) links.push({ to: homePathFor(user.role), label: 'Dashboard' });

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link to="/" className="font-display text-2xl font-bold text-brand-600">
          Gara
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          {user ? (
            <>
              <NotificationBell />
              <span className="text-sm text-ink-600">{user.name}</span>
              <Button variant="secondary" onClick={handleLogout} className="!min-h-9 !py-1.5">
                Log out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login" className="rounded-control px-3 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100">
                Log in
              </Link>
              <Link
                to="/register"
                className="rounded-control bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center md:hidden">
          {user && <NotificationBell />}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle menu"
          className="flex size-11 items-center justify-center rounded-control text-ink-700 hover:bg-ink-100"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-ink-100 bg-white px-4 pb-4 pt-2 md:hidden">
          <nav className="flex flex-col" aria-label="Mobile">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2">
            {user ? (
              <>
                <p className="px-3 text-sm text-ink-500">Signed in as {user.name}</p>
                <Button variant="secondary" onClick={handleLogout}>
                  Log out
                </Button>
              </>
            ) : (
              <>
                <Link to="/login" className="rounded-control border border-ink-200 px-4 py-2.5 text-center text-sm font-semibold">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="rounded-control bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
