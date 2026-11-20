import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { listMyBookings } from '../api/bookings.js';
import { CUSTOMER_TABS, filterAndSort, firstNonEmptyTab, withCounts } from '../lib/bookingTabs.js';
import BookingCard from '../components/BookingCard.jsx';
import Tabs from '../components/Tabs.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Button from '../components/Button.jsx';

const EMPTY_TEXT = {
  awaiting: ['Nothing waiting on you', 'Bookings that still need a deposit or a confirmation show up here.'],
  upcoming: ['No upcoming appointments', 'Once a pro confirms your booking it appears here.'],
  completed: ['No completed bookings yet', 'After your appointment you can leave a review.'],
  cancelled: ['Nothing cancelled', 'Cancelled and declined bookings are listed here.'],
};

export default function MyBookings() {
  const { data, loading, error, reload } = useAsync(() => listMyBookings('all'), []);
  const [tab, setTab] = useState(null);

  const bookings = useMemo(() => data?.bookings ?? [], [data]);
  const tabs = useMemo(() => withCounts(CUSTOMER_TABS, bookings), [bookings]);

  // Open on the first tab that has bookings, once.
  useEffect(() => {
    if (data && tab === null) setTab(firstNonEmptyTab(tabs, 'upcoming'));
  }, [data, tab, tabs]);

  if (loading || (data && tab === null)) return <Spinner label="Loading your bookings..." />;
  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-6">
        <ErrorState message={error} onRetry={reload} />
      </main>
    );
  }

  const rows = filterAndSort(bookings, tab, CUSTOMER_TABS);

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">My bookings</h1>
        <Link to="/search">
          <Button variant="secondary">Book a pro</Button>
        </Link>
      </div>

      <div className="mt-4">
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Booking status" />
      </div>

      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            title={bookings.length === 0 ? 'No bookings yet' : EMPTY_TEXT[tab][0]}
            description={bookings.length === 0 ? 'Find a verified pro and book your first appointment.' : EMPTY_TEXT[tab][1]}
            action={
              bookings.length === 0 && (
                <Link to="/search" className="rounded-control bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
                  Find a pro
                </Link>
              )
            }
          />
        ) : (
          <ul className="space-y-3">
            {rows.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="CUSTOMER" to={`/bookings/${b.id}`}>
                {b.status === 'PENDING_DEPOSIT' && (
                  <Link to={`/bookings/${b.id}`} className="rounded-control bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                    Pay deposit
                  </Link>
                )}
                {b.canReview && (
                  <Link to={`/bookings/${b.id}`} className="rounded-control bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
                    Leave a review
                  </Link>
                )}
              </BookingCard>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
