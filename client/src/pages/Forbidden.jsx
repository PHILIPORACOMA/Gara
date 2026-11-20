import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext.jsx';
import { homePathFor } from '../auth/roleHome.js';

export default function Forbidden() {
  const { user } = useAuth();
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-5xl font-bold">403</h1>
      <p className="mt-2 text-ink-600">Your account doesn't have access to this page.</p>
      <Link
        to={user ? homePathFor(user.role) : '/'}
        className="mt-6 inline-block rounded-control bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600"
      >
        Go to my home
      </Link>
    </main>
  );
}
