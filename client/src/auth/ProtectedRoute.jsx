import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Forbidden from '../pages/Forbidden.jsx';

// Wrap routes in <Route element={<ProtectedRoute roles={['ADMIN']} />}>.
// Not logged in -> /login (and back afterwards). Logged in with the wrong role -> 403 page.
// The server enforces the same rules; this only keeps people out of screens they cannot use.
export default function ProtectedRoute({ roles }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <Spinner label="Checking your session..." />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  if (roles && !roles.includes(user.role)) return <Forbidden />;
  return <Outlet />;
}
