import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import Badge from '../../components/Badge.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import ProBookingActions from '../../components/ProBookingActions.jsx';
import { formatPeso } from '../../lib/money.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import Alert from '../../components/Alert.jsx';
import { VERIFICATION_LABELS, VERIFICATION_TONES } from '../../lib/labels.js';

function StatusBanner({ profile }) {
  switch (profile.verificationStatus) {
    case 'APPROVED':
      return <Alert tone="success">You are verified. Your profile shows the Verified badge and appears in search.</Alert>;
    case 'PENDING':
      return <Alert tone="warning">Your application is being reviewed by the Gara team. We will notify you once it is done.</Alert>;
    case 'REJECTED':
      return (
        <Alert tone="error">
          We could not verify you yet: {profile.rejectionReason}.{' '}
          <Link to="/pro/verification" className="font-semibold underline">
            Fix and resubmit
          </Link>
        </Alert>
      );
    default:
      return (
        <Alert tone="info">
          Finish the checklist below, then submit for verification. Only verified professionals appear in search.
        </Alert>
      );
  }
}

// Verified pros: what needs doing, what is coming up, and what they earned.
function ApprovedDashboard() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getDashboard(), []);
  if (loading) return <Spinner label="Loading your bookings..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { counts, upcoming, earnings } = data;
  const onChanged = (updated) =>
    setData((d) => ({ ...d, upcoming: d.upcoming.map((b) => (b.id === updated.id ? updated : b)) }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Requests', counts.requests, 'Waiting for your reply', '/pro/bookings'],
          ['Upcoming', counts.upcoming, 'Confirmed appointments', '/pro/bookings'],
          ['This month', formatPeso(earnings.thisMonth.net), 'Net earnings', '/pro/earnings'],
          ['All time', formatPeso(earnings.allTime.net), `${earnings.allTime.completedBookings} completed`, '/pro/earnings'],
        ].map(([title, value, hint, to]) => (
          <Link key={title} to={to} className="rounded-card bg-white p-4 shadow-card hover:bg-ink-50">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
            <p className="mt-1 text-2xl font-bold text-ink-900">{value}</p>
            <p className="text-xs text-ink-500">{hint}</p>
          </Link>
        ))}
      </div>

      <section aria-labelledby="next-heading">
        <div className="flex items-baseline justify-between">
          <h2 id="next-heading" className="text-xl font-semibold">
            Next up
          </h2>
          <Link to="/pro/bookings" className="text-sm font-semibold text-brand-600 hover:underline">
            All bookings
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-3 rounded-card border border-dashed border-ink-200 bg-white p-6 text-center text-sm text-ink-600">
            No upcoming bookings yet. Keep your availability up to date so customers can book you.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="PROFESSIONAL">
                <ProBookingActions booking={b} onChanged={onChanged} />
              </BookingCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function ProOverview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => proApi.getProfile(), []);

  if (loading) return <Spinner label="Loading your dashboard..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const { profile, checklist } = data;
  const doneCount = checklist.items.filter((i) => i.done).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Hi, {profile.displayName || user.name}</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-600">
          Verification status:
          <Badge tone={VERIFICATION_TONES[profile.verificationStatus]}>{VERIFICATION_LABELS[profile.verificationStatus]}</Badge>
        </p>
      </div>

      <StatusBanner profile={profile} />

      {profile.verificationStatus === 'APPROVED' && <ApprovedDashboard />}

      {profile.verificationStatus !== 'APPROVED' && (
        <section className="rounded-card bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold">Verification checklist</h2>
            <span className="text-sm text-ink-500">
              {doneCount} of {checklist.items.length} done
            </span>
          </div>
          <ul className="mt-3 divide-y divide-ink-100">
            {checklist.items.map((item) => (
              <li key={item.key}>
                <Link to={item.link} className="flex min-h-12 items-center gap-3 py-2.5 hover:bg-ink-50">
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      item.done ? 'bg-success text-white' : 'border border-ink-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={`text-sm ${item.done ? 'text-ink-500 line-through' : 'text-ink-800'}`}>{item.label}</span>
                  <span className="sr-only">{item.done ? '(done)' : '(to do)'}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
