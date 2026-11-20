import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import ErrorState from './ErrorState.jsx';
import { useAuth } from '../auth/AuthContext.jsx';

export default function Layout() {
  const { status, retry } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1">
        {status === 'error' ? (
          <div className="mx-auto max-w-md px-4 py-10">
            <ErrorState message="We can't reach Gara right now. Check your connection and try again." onRetry={retry} />
          </div>
        ) : (
          <Outlet />
        )}
      </div>
      <footer className="border-t border-ink-100 bg-white py-6 text-center text-xs text-ink-500">
        Gara &middot; Verified beauty professionals in Cebu
      </footer>
    </div>
  );
}
