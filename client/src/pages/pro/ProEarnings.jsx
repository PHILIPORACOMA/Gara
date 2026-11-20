import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import Button from '../../components/Button.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { formatPeso } from '../../lib/money.js';
import { formatDate } from '../../lib/dates.js';

function SummaryCard({ title, totals }) {
  return (
    <section className="rounded-card bg-white p-5 shadow-card" aria-label={title}>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">{title}</h2>
      <p className="mt-2 text-3xl font-bold text-ink-900">{formatPeso(totals.net)}</p>
      <p className="text-sm text-ink-500">you take home from {totals.completedBookings} completed booking{totals.completedBookings === 1 ? '' : 's'}</p>
      <dl className="mt-4 space-y-1.5 border-t border-ink-100 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-ink-600">Gross (services)</dt>
          <dd className="font-medium">{formatPeso(totals.gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-600">Gara commission</dt>
          <dd className="font-medium text-danger">− {formatPeso(totals.commission)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink-600">Travel fees (100% yours)</dt>
          <dd className="font-medium text-success">+ {formatPeso(totals.travelFees)}</dd>
        </div>
        <div className="flex justify-between border-t border-ink-100 pt-1.5 text-base">
          <dt className="font-semibold">Net payout</dt>
          <dd className="font-semibold">{formatPeso(totals.net)}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function ProEarnings() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => proApi.getEarnings(page), [page]);

  if (loading && !data) return <Spinner label="Loading earnings..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold">Earnings</h1>
        <p className="mt-1 text-sm text-ink-600">
          Gara takes its commission from the service price only. The home-service travel fee is never commissioned.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SummaryCard title="This month" totals={data.summary.thisMonth} />
        <SummaryCard title="All time" totals={data.summary.allTime} />
      </div>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="text-xl font-semibold">
          Completed bookings
        </h2>
        {data.rows.length === 0 ? (
          <EmptyState title="No earnings yet" description="When you mark a booking completed, your payout is recorded here." />
        ) : (
          <ul className="space-y-3">
            {data.rows.map((r) => (
              <li key={r.id} className="rounded-card bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink-900">{r.customerName}</p>
                    <p className="text-sm text-ink-600">{r.services.join(', ')}</p>
                    <p className="text-xs text-ink-500">{formatDate(r.startAt)}</p>
                  </div>
                  <p className="shrink-0 text-lg font-semibold text-success">{formatPeso(r.proNet)}</p>
                </div>
                <p className="mt-2 text-xs text-ink-500">
                  Gross {formatPeso(r.gross)} − commission {formatPeso(r.commissionAmount)} ({r.commissionPct}%)
                  {r.travelFee > 0 && ` + travel fee ${formatPeso(r.travelFee)}`}
                </p>
              </li>
            ))}
          </ul>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <span className="text-sm text-ink-600">
              Page {page} of {pages}
            </span>
            <Button variant="secondary" disabled={page >= pages || loading} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
