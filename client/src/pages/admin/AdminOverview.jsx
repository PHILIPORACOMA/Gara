import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import * as adminApi from '../../api/admin.js';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { formatPeso } from '../../lib/money.js';

const pct = (rate) => (rate == null ? '–' : `${Math.round(rate * 1000) / 10}%`);
const monthName = (iso) => new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', month: 'long', year: 'numeric' }).format(new Date(iso));

function MetricCard({ title, value, hint, tone = 'text-ink-900' }) {
  return (
    <div className="rounded-card bg-white p-4 shadow-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
      <p className={`mt-1 text-3xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
    </div>
  );
}

function Metrics() {
  const { data: m, loading, error, reload } = useAsync(() => adminApi.getMetrics(), []);
  if (loading) return <Spinner label="Loading metrics..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="text-xl font-semibold">
          Key metrics
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard title="Verified pros" value={m.verifiedPros.total} hint={`${m.verifiedPros.active} active in the last 30 days`} />
          <MetricCard title="Completed this month" value={m.completedThisMonth} hint={monthName(m.monthStart)} />
          <MetricCard title="Deposit conversion" value={pct(m.depositConversion.rate)} hint={`${m.depositConversion.verified} of ${m.depositConversion.requests} requests had a verified deposit`} />
          <MetricCard title="Commission this month" value={formatPeso(m.commissionThisMonth.amount)} hint={`from ${m.commissionThisMonth.bookings} completed booking${m.commissionThisMonth.bookings === 1 ? '' : 's'}`} tone="text-success" />
          <MetricCard title="No-show rate" value={pct(m.noShow.rate)} hint={`${m.noShow.noShows} of ${m.noShow.settled} finished bookings`} />
          <MetricCard title="Cancellation rate" value={pct(m.cancellation.rate)} hint={`${m.cancellation.cancelled} of ${m.cancellation.base} paid bookings cancelled or declined`} />
          <MetricCard title="Average rating" value={m.rating.average == null ? '–' : `${m.rating.average.toFixed(2)} / 5`} hint={`${m.rating.count} review${m.rating.count === 1 ? '' : 's'}`} />
          <MetricCard title="Repeat-booking rate" value={pct(m.repeat.rate)} hint={`${m.repeat.repeatCustomers} of ${m.repeat.customers} customers booked again`} />
        </div>
      </section>

      <section aria-labelledby="extras-heading">
        <h2 id="extras-heading" className="text-lg font-semibold text-ink-700">
          Launch targets
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
          <MetricCard title="Completion rate" value={pct(m.extras.completionRate)} hint="Target 92% or more" />
          <MetricCard title="Requests confirmed" value={pct(m.extras.requestToConfirmedRate)} hint="Target 70% or more" />
          <MetricCard title="Avg booking value" value={m.extras.avgBookingValue == null ? '–' : formatPeso(m.extras.avgBookingValue)} hint="Target ₱1,200 or more" />
          <MetricCard title="Pro response time" value={m.extras.medianResponseHours == null ? '–' : `${m.extras.medianResponseHours} h`} hint="Median, target 4 h or less" />
          <MetricCard title="Occasion bookings" value={pct(m.extras.occasionShare)} hint="Share of gross value" />
        </div>
      </section>
    </div>
  );
}

// Work queues, then the key metrics.
export default function AdminOverview() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(async () => {
    const [verifications, deposits, refunds] = await Promise.all([
      adminApi.listVerifications('PENDING'),
      adminApi.listDeposits(),
      adminApi.listAllBookings({ refund: 'needed', pageSize: 1 }),
    ]);
    return { verifications: verifications.length, deposits: deposits.length, refunds: refunds.total };
  }, []);

  const queues = data && [
    ['Pro verifications', data.verifications, 'Professionals waiting to be verified', '/admin/verifications'],
    ['Deposits to verify', data.deposits, 'GCash payments to check', '/admin/deposits'],
    ['Refunds needed', data.refunds, 'Declined bookings to refund by hand', '/admin/bookings'],
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Admin</h1>
        <p className="text-sm text-ink-600">Signed in as {user.name}.</p>
      </div>
      {loading ? (
        <Spinner label="Loading queues..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {queues.map(([title, count, hint, to]) => (
            <Link key={title} to={to} className="rounded-card bg-white p-5 shadow-card hover:bg-ink-50">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{title}</p>
              <p className={`mt-1 text-4xl font-bold ${count > 0 ? 'text-brand-600' : 'text-ink-900'}`}>{count}</p>
              <p className="text-sm text-ink-500">{hint}</p>
            </Link>
          ))}
        </div>
      )}
      <Metrics />
    </div>
  );
}
