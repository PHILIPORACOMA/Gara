import { useEffect, useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import { PRO_TABS, filterAndSort, firstNonEmptyTab, withCounts } from '../../lib/bookingTabs.js';
import BookingCard from '../../components/BookingCard.jsx';
import ProBookingActions from '../../components/ProBookingActions.jsx';
import ProCalendar from '../../components/ProCalendar.jsx';
import Tabs from '../../components/Tabs.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';

const EMPTY_TEXT = {
  requests: ['No requests waiting', 'When a customer books you and their deposit is verified, it shows up here for you to accept or decline.'],
  upcoming: ['No upcoming appointments', 'Bookings you have accepted appear here.'],
  awaiting: ['Nothing awaiting payment', 'New bookings wait here until the customer’s deposit is verified.'],
  completed: ['No completed bookings yet', 'Finished appointments and your payout details appear here.'],
  cancelled: ['Nothing cancelled', 'Cancelled, declined and no-show bookings are listed here.'],
};

function ListView() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.listBookings('all'), []);
  const [tab, setTab] = useState(null);

  const bookings = useMemo(() => data?.bookings ?? [], [data]);
  const tabs = useMemo(() => withCounts(PRO_TABS, bookings), [bookings]);

  useEffect(() => {
    if (data && tab === null) setTab(firstNonEmptyTab(tabs, 'requests'));
  }, [data, tab, tabs]);

  if (loading || (data && tab === null)) return <Spinner label="Loading bookings..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const rows = filterAndSort(bookings, tab, PRO_TABS);
  const onChanged = (updated) => setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === updated.id ? updated : b)) }));

  return (
    <div className="space-y-4">
      <Tabs tabs={tabs} value={tab} onChange={setTab} label="Booking status" />
      {rows.length === 0 ? (
        <EmptyState title={EMPTY_TEXT[tab][0]} description={EMPTY_TEXT[tab][1]} />
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <BookingCard key={b.id} booking={b} viewer="PROFESSIONAL">
              <ProBookingActions booking={b} onChanged={onChanged} />
            </BookingCard>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ProBookings() {
  const [view, setView] = useState('list');
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Bookings</h1>
        <div role="group" aria-label="View" className="flex rounded-full bg-white p-1 shadow-card">
          {[
            ['list', 'List'],
            ['calendar', 'Calendar'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => setView(key)}
              className={`min-h-9 rounded-full px-4 text-sm font-medium ${view === key ? 'bg-brand-500 text-white' : 'text-ink-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'list' ? <ListView /> : <ProCalendar />}
    </div>
  );
}
