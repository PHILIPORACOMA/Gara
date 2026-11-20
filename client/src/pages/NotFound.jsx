import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-5xl font-bold">404</h1>
      <p className="mt-2 text-ink-600">We couldn't find that page.</p>
      <Link to="/" className="mt-6 inline-block rounded-control bg-brand-500 px-5 py-2.5 font-medium text-white hover:bg-brand-600">
        Back to home
      </Link>
    </main>
  );
}
