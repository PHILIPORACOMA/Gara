import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { searchPros } from '../api/discovery.js';
import { filtersFromParams, paramsFromFilters } from '../lib/filters.js';
import { formatDate } from '../lib/dates.js';
import SearchFilters from '../components/SearchFilters.jsx';
import ProCard from '../components/ProCard.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const filters = filtersFromParams(searchParams);
  const key = searchParams.toString();

  const { data, loading, error, reload } = useAsync(() => searchPros(filters), [key]);

  const apply = (next) => {
    setSearchParams(paramsFromFilters(next));
    setShowFilters(false);
  };

  const activeCount = Object.entries(filters).filter(([, v]) => v !== '' && v !== false).length;
  const profileQuery = filters.date ? `?date=${filters.date}` : '';

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Find your pro</h1>
          <p className="mt-1 text-sm text-ink-600" aria-live="polite">
            {loading ? 'Searching...' : error ? '' : `${data.length} verified ${data.length === 1 ? 'pro' : 'pros'}${filters.date ? ` free on ${formatDate(`${filters.date}T00:00:00+08:00`)}` : ''}`}
          </p>
        </div>
        <Button variant="secondary" className="md:hidden" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
          Filters{activeCount > 0 ? ` (${activeCount})` : ''}
        </Button>
      </div>

      <div className="mt-5 grid gap-6 md:grid-cols-[17rem_1fr]">
        <aside className={`${showFilters ? 'block' : 'hidden'} h-fit rounded-card bg-white p-5 shadow-card md:block`}>
          <SearchFilters key={key} value={filters} onApply={apply} />
        </aside>

        <section aria-label="Results">
          {loading ? (
            <Spinner label="Finding pros..." />
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : data.length === 0 ? (
            <EmptyState
              title="No pros match yet"
              description="Try another date or area, widen your price range, or remove a filter."
              action={
                activeCount > 0 && (
                  <Button variant="secondary" onClick={() => apply({})}>
                    Clear all filters
                  </Button>
                )
              }
            />
          ) : (
            <ul className="space-y-3">
              {data.map((pro) => (
                <ProCard key={pro.id} pro={pro} query={profileQuery} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
