import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage } from '../../api/http.js';
import { TextAreaField } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import Badge from '../../components/Badge.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import SecureImage from '../../components/SecureImage.jsx';
import { CATEGORY_LABELS, SERVICE_MODE_LABELS, formatDuration } from '../../lib/labels.js';
import { formatPeso } from '../../lib/money.js';
import { formatDateTime } from '../../lib/dates.js';
import { uploadUrl } from '../../lib/uploads.js';

const TABS = [
  { status: 'PENDING', label: 'Pending' },
  { status: 'APPROVED', label: 'Approved' },
  { status: 'REJECTED', label: 'Rejected' },
];

function ApplicationCard({ app, onDecided }) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [busy, setBusy] = useState(null); // 'approve' | 'reject'
  const [error, setError] = useState('');
  const pending = app.verificationStatus === 'PENDING';

  const approve = async () => {
    setBusy('approve');
    setError('');
    try {
      await adminApi.approveVerification(app.id);
      onDecided(app.id);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(null);
    }
  };

  const reject = async () => {
    if (reason.trim().length < 5) return setReasonError('Give a reason of at least 5 characters so the pro knows what to fix');
    setReasonError('');
    setBusy('reject');
    setError('');
    try {
      await adminApi.rejectVerification(app.id, reason.trim());
      onDecided(app.id);
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(null);
    }
  };

  return (
    <li className="space-y-4 rounded-card bg-white p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">{app.displayName}</h2>
          <p className="text-sm text-ink-600">
            {app.user.name} &middot; {app.user.email}
            {app.user.phone ? ` · ${app.user.phone}` : ''}
          </p>
          {app.submittedAt && <p className="text-xs text-ink-500">Submitted {formatDateTime(app.submittedAt)}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {app.categories.map((c) => (
            <Badge key={c} tone="brand">
              {CATEGORY_LABELS[c]}
            </Badge>
          ))}
        </div>
      </div>

      <dl className="grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">Service mode</dt>
          <dd>{SERVICE_MODE_LABELS[app.serviceMode]}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-500">Areas</dt>
          <dd>{app.areas.join(', ')}</dd>
        </div>
        {app.storeAddress && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Store address</dt>
            <dd>{app.storeAddress}</dd>
          </div>
        )}
        {(app.serviceMode === 'HOME' || app.serviceMode === 'BOTH') && (
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Travel fee</dt>
            <dd>{formatPeso(app.travelFee)}</dd>
          </div>
        )}
      </dl>
      {app.bio && <p className="text-sm text-ink-700">{app.bio}</p>}

      <div>
        <h3 className="text-sm font-semibold text-ink-700">Services</h3>
        <ul className="mt-1 divide-y divide-ink-100 text-sm">
          {app.services.map((s) => (
            <li key={s.id} className="flex justify-between py-1.5">
              <span>
                {s.name} <span className="text-ink-500">({CATEGORY_LABELS[s.category]}, {formatDuration(s.durationMin)})</span>
              </span>
              <span className="font-medium">{formatPeso(s.price)}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-[16rem_1fr]">
        <div>
          <h3 className="text-sm font-semibold text-ink-700">Government ID (private)</h3>
          {app.idImagePath ? (
            <SecureImage path={app.idImagePath} alt={`ID of ${app.displayName}`} className="mt-1 h-40 w-64" />
          ) : (
            <p className="mt-1 text-sm text-danger">No ID on file</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-700">Portfolio ({app.portfolio.length})</h3>
          <ul className="mt-1 flex flex-wrap gap-2">
            {app.portfolio.map((img, i) => (
              <li key={img.id}>
                <a href={uploadUrl(img.path)} target="_blank" rel="noreferrer">
                  <img src={uploadUrl(img.path)} alt={`${app.displayName} portfolio ${i + 1}`} loading="lazy" className="size-20 rounded-control object-cover" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {app.verificationStatus === 'REJECTED' && app.rejectionReason && <Alert tone="error">Rejected: {app.rejectionReason}</Alert>}
      <Alert tone="error">{error}</Alert>

      {pending && !rejecting && (
        <div className="flex flex-wrap gap-3">
          <Button onClick={approve} loading={busy === 'approve'} disabled={busy === 'reject'}>
            Approve and verify
          </Button>
          <Button variant="secondary" onClick={() => setRejecting(true)} disabled={busy !== null}>
            Reject...
          </Button>
        </div>
      )}

      {pending && rejecting && (
        <div className="space-y-3 rounded-control border border-danger/30 bg-danger/5 p-4">
          <TextAreaField
            label="Reason for rejection (sent to the professional)"
            name={`reason-${app.id}`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError}
            rows={3}
            maxLength={300}
            placeholder="e.g. The ID photo is blurry. Please upload a clearer photo."
          />
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

export default function AdminVerifications() {
  const [status, setStatus] = useState('PENDING');
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.listVerifications(status), [status]);

  const onDecided = (id) => setData((rows) => rows.filter((r) => r.id !== id));

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Verifications</h1>

      <div role="tablist" aria-label="Application status" className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            type="button"
            role="tab"
            aria-selected={status === t.status}
            onClick={() => setStatus(t.status)}
            className={`min-h-10 rounded-full px-4 text-sm font-medium ${
              status === t.status ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 shadow-card hover:bg-ink-50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Spinner label="Loading applications..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <EmptyState title={status === 'PENDING' ? 'The queue is clear' : 'Nothing here'} description={status === 'PENDING' ? 'No professionals are waiting for verification.' : undefined} />
      ) : (
        <ul className="space-y-4">
          {data.map((app) => (
            <ApplicationCard key={app.id} app={app} onDecided={onDecided} />
          ))}
        </ul>
      )}
    </div>
  );
}
