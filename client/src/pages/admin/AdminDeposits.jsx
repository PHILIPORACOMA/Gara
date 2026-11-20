import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../api/http.js';
import { TextAreaField } from '../../components/Field.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import SecureImage from '../../components/SecureImage.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { BOOKING_MODE_LABELS } from '../../lib/labels.js';
import { formatPeso } from '../../lib/money.js';
import { formatDate, formatDateTime, formatTime } from '../../lib/dates.js';

function DepositCard({ booking: b, onDecided }) {
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  const verify = async () => {
    setBusy('verify');
    setError('');
    try {
      await adminApi.verifyDeposit(b.id);
      onDecided(b.id);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(null);
    }
  };

  const reject = async () => {
    if (note.trim().length < 5) return setNoteError('Tell the customer what was wrong (at least 5 characters)');
    setNoteError('');
    setBusy('reject');
    setError('');
    try {
      await adminApi.rejectDeposit(b.id, note.trim());
      onDecided(b.id);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <li className="space-y-4 rounded-card bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm text-ink-500">Booking #{b.id}</p>
          <h2 className="text-xl font-semibold">{b.customer.name}</h2>
          <p className="text-sm text-ink-600">
            {b.customer.email}
            {b.customer.phone ? ` · ${b.customer.phone}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-ink-500">Expected deposit</p>
          <p className="text-2xl font-bold text-brand-700">{formatPeso(b.pricing.depositAmount)}</p>
        </div>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">Booking</dt>
          <dd>
            {b.professional.displayName}: {b.items.map((i) => i.name).join(', ')}
            <br />
            {formatDate(b.startAt)}, {formatTime(b.startAt)} &middot; {BOOKING_MODE_LABELS[b.mode]}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">Total / balance on the day</dt>
          <dd>
            {formatPeso(b.pricing.total)} / {formatPeso(b.pricing.balanceDue)}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">GCash reference entered</dt>
          <dd className="font-mono text-base font-semibold text-ink-900">{b.deposit.gcashRef}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">Submitted</dt>
          <dd>{b.deposit.submittedAt ? formatDateTime(b.deposit.submittedAt) : '-'}</dd>
        </div>
      </dl>

      <div>
        <h3 className="text-sm font-semibold text-ink-700">Payment screenshot</h3>
        {b.deposit.screenshotPath ? (
          <SecureImage path={b.deposit.screenshotPath} alt={`GCash screenshot for booking ${b.id}`} className="mt-1 max-h-72 w-auto" />
        ) : (
          <p className="mt-1 text-sm text-danger">No screenshot</p>
        )}
        <p className="mt-2 text-xs text-ink-500">Check that the amount, the reference number and the receiving account match before verifying.</p>
      </div>

      <Alert tone="error">{error}</Alert>

      {!rejecting ? (
        <div className="flex flex-wrap gap-3">
          <Button onClick={verify} loading={busy === 'verify'} disabled={busy === 'reject'}>
            Verify deposit
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
            Reject...
          </Button>
        </div>
      ) : (
        <div className="space-y-3 rounded-control border border-danger/30 bg-danger/5 p-4">
          <TextAreaField label="What was wrong? (sent to the customer)" name={`note-${b.id}`} value={note} onChange={(e) => setNote(e.target.value)} error={noteError} rows={2} maxLength={200} placeholder="e.g. The reference number does not match a payment to our account." />
          <div className="flex gap-3">
            <Button variant="danger" onClick={reject} loading={busy === 'reject'}>
              Confirm rejection
            </Button>
            <Button variant="secondary" onClick={() => setRejecting(false)} disabled={busy !== null}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

export default function AdminDeposits() {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.listDeposits(), []);
  const onDecided = (id) => setData((rows) => rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Deposits to verify</h1>
      <p className="text-sm text-ink-600">Customers pay Gara's GCash by hand. Verify the payment, then the booking goes to the professional.</p>
      {loading ? (
        <Spinner label="Loading deposits..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title="No deposits waiting" description="New GCash deposits will appear here, oldest first." />
      ) : (
        <ul className="space-y-4">
          {data.map((b) => (
            <DepositCard key={b.id} booking={b} onDecided={onDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}
