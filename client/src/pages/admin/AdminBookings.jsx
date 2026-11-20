import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../api/http.js';
import { SelectField, TextField } from '../../components/Field.jsx';
import Alert from '../../components/Alert.jsx';
import BookingCard from '../../components/BookingCard.jsx';
import Button from '../../components/Button.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { BOOKING_STATUS } from '../../lib/labels.js';

const EMPTY = { status: '', refund: '', from: '', to: '' };

export default function AdminBookings() {
  const [filters, setFilters] = useState(EMPTY);
  const [applied, setApplied] = useState(EMPTY);
  const [page, setPage] = useState(1);
  const [actionError, setActionError] = useState('');
  const [resolvingId, setResolvingId] = useState(null);

  const { data, loading, error, reload, setData } = useAsync(
    () => adminApi.listAllBookings({ ...Object.fromEntries(Object.entries(applied).filter(([, v]) => v)), page }),
    [applied, page],
  );

  const onChange = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  const apply = (e) => {
    e.preventDefault();
    setPage(1);
    setApplied(filters);
  };
  const clear = () => {
    setFilters(EMPTY);
    setApplied(EMPTY);
    setPage(1);
  };

  const resolve = async (b) => {
    setResolvingId(b.id);
    setActionError('');
    try {
      const updated = await adminApi.resolveRefund(b.id);
      setData((d) => ({ ...d, bookings: d.bookings.map((x) => (x.id === updated.id ? updated : x)) }));
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setResolvingId(null);
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">All bookings</h1>

      <form onSubmit={apply} className="grid gap-3 rounded-card bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5 lg:items-end" aria-label="Filters">
        <SelectField label="Status" name="status" value={filters.status} onChange={onChange}>
          <option value="">Any</option>
          {Object.entries(BOOKING_STATUS).map(([val, s]) => (
            <option key={val} value={val}>
              {s.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Refunds" name="refund" value={filters.refund} onChange={onChange}>
          <option value="">Any</option>
          <option value="needed">Refund needed</option>
          <option value="resolved">Refunded</option>
        </SelectField>
        <TextField label="From" name="from" type="date" value={filters.from} onChange={onChange} />
        <TextField label="To" name="to" type="date" value={filters.to} onChange={onChange} />
        <div className="flex gap-2">
          <Button type="submit" className="flex-1">
            Filter
          </Button>
          <Button variant="secondary" onClick={clear}>
            Clear
          </Button>
        </div>
      </form>

      <Alert tone="error">{actionError}</Alert>

      {loading && !data ? (
        <Spinner label="Loading bookings..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.bookings.length === 0 ? (
        <EmptyState title="No bookings match" description="Try removing a filter." />
      ) : (
        <>
          <p className="text-sm text-ink-600" aria-live="polite">
            {data.total} booking{data.total === 1 ? '' : 's'}
          </p>
          <ul className="grid gap-3 lg:grid-cols-2" aria-busy={loading}>
            {data.bookings.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="ADMIN">
                {b.refundNeeded && !b.refundResolvedAt && (
                  <ConfirmButton loading={resolvingId === b.id} onConfirm={() => resolve(b)} confirmLabel="Tap again: refund sent">
                    Mark refund done
                  </ConfirmButton>
                )}
              </BookingCard>
            ))}
          </ul>
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
        </>
      )}
    </div>
  );
}
