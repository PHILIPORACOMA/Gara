import { Link, useNavigate } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { searchPros } from '../api/discovery.js';
import { paramsFromFilters } from '../lib/filters.js';
import { useAuth } from '../auth/AuthContext.jsx';
import SearchFilters, { EMPTY_FILTERS } from '../components/SearchFilters.jsx';
import ProCard from '../components/ProCard.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';

const STEPS = [
  { title: 'Search by service, area and date', text: 'See only pros who serve your area and are free on the day you need.' },
  { title: 'Compare verified pros', text: 'ID-verified profiles with real portfolios, upfront prices, home-service fees and availability.' },
  { title: 'Contact them in one tap', text: 'Message on Messenger, call or text the pro directly and agree on the details.' },
];

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const top = useAsync(() => searchPros({}), []);

  const onSearch = (filters) => navigate(`/search?${paramsFromFilters(filters)}`);

  return (
    <main>
      <section className="bg-gradient-to-b from-brand-50 to-ink-50 px-4 pb-10 pt-10 sm:pt-16">
        <div className="mx-auto max-w-5xl">
          <h1 className="max-w-xl text-4xl font-bold leading-tight sm:text-5xl">Beauty pros you can trust, booked in minutes.</h1>
          <p className="mt-3 max-w-xl text-ink-600">
            Hairstylists, nail technicians and makeup artists in Cebu. Verified profiles, upfront prices, availability, and one-tap contact.
          </p>
          <div className="mt-6 max-w-2xl rounded-card bg-white p-5 shadow-card">
            <SearchFilters value={EMPTY_FILTERS} onApply={onSearch} compact />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Top-rated pros</h2>
          <Link to="/search" className="text-sm font-semibold text-brand-600 hover:underline">
            See all
          </Link>
        </div>
        <div className="mt-4">
          {top.loading ? (
            <Spinner label="Loading pros..." />
          ) : top.error ? (
            <ErrorState message={top.error} onRetry={top.reload} />
          ) : top.data.length === 0 ? (
            <p className="rounded-card border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-600">
              Verified pros are joining soon. Check back shortly.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {top.data.slice(0, 4).map((pro) => (
                <ProCard key={pro.id} pro={pro} />
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="bg-white px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold">How Gara works</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-card bg-ink-50 p-5">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 font-display text-lg font-bold text-white" aria-hidden="true">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-ink-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {!user && (
        <section className="px-4 py-10">
          <div className="mx-auto max-w-5xl rounded-card bg-brand-600 p-6 text-white sm:p-8">
            <h2 className="text-2xl font-bold !text-white">Are you a hairstylist, nail tech or makeup artist?</h2>
            <p className="mt-2 max-w-xl text-brand-50">
              Get verified, show your work, prices and availability, and get found by new clients. Free to join.
            </p>
            <Link to="/register?role=professional" className="mt-4 inline-block rounded-control bg-white px-5 py-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              Join as a pro
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
