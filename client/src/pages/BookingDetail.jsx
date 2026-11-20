import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { formatCountdown, useCountdown } from '../hooks/useCountdown.js';
import * as bookingsApi from '../api/bookings.js';
import { getPublicSettings } from '../api/publicApi.js';
import { apiErrorMessage, apiFieldErrors } from '../api/http.js';
import { TextField } from '../components/Field.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import ConfirmButton from '../components/ConfirmButton.jsx';
import PriceBreakdown from '../components/PriceBreakdown.jsx';
import SecureImage from '../components/SecureImage.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import ReviewForm from '../components/ReviewForm.jsx';
import { BOOKING_MODE_LABELS, OCCASION_LABELS } from '../lib/labels.js';
import { formatPeso } from '../lib/money.js';
import { formatDate, formatDateTime, formatTime } from '../lib/dates.js';
import { checkImageFile, uploadUrl } from '../lib/uploads.js';

const STEPS = [
  { key: 'PENDING_DEPOSIT', label: 'Booked' },
  { key: 'DEPOSIT_SUBMITTED', label: 'Deposit sent' },
  { key: 'DEPOSIT_VERIFIED', label: 'Deposit verified' },
  { key: 'CONFIRMED', label: 'Confirmed' },
  { key: 'COMPLETED', label: 'Completed' },
];

function Timeline({ status }) {
  const index = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-start" aria-label="Booking progress">
      {STEPS.map((s, i) => {
        const done = i <= index;
        return (
          <li key={s.key} className="flex flex-1 flex-col items-center text-center" aria-current={i === index ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <span className={`h-0.5 flex-1 ${i === 0 ? 'bg-transparent' : done ? 'bg-brand-500' : 'bg-ink-200'}`} />
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-brand-500 text-white' : 'bg-ink-200 text-ink-500'}`}>
                {done ? '✓' : i + 1}
              </span>
              <span className={`h-0.5 flex-1 ${i === STEPS.length - 1 ? 'bg-transparent' : i < index ? 'bg-brand-500' : 'bg-ink-200'}`} />
            </div>
            <span className={`mt-1 text-[11px] leading-tight ${done ? 'font-medium text-ink-800' : 'text-ink-500'}`}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function PaymentPanel({ booking, onUpdated }) {
  const settings = useAsync(() => getPublicSettings(), []);
  const left = useCountdown(booking.holdExpiresAt);
  const inputRef = useRef(null);
  const [ref, setRef] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    const problem = checkImageFile(picked);
    setErrors((cur) => ({ ...cur, screenshot: problem }));
    setFile(problem ? null : picked);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = {};
    if (!/^[A-Za-z0-9\s-]{6,40}$/.test(ref.trim())) found.gcashRef = 'Enter the reference number exactly as shown in GCash (6-40 letters or digits)';
    if (!file) found.screenshot = 'Upload a screenshot of your GCash payment';
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      onUpdated(await bookingsApi.submitDeposit(booking.id, { gcashRef: ref.trim(), screenshot: file }));
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const s = settings.data;
  return (
    <section className="rounded-card border-2 border-brand-200 bg-white p-5 shadow-card" aria-labelledby="pay-heading">
      <h2 id="pay-heading" className="text-xl font-semibold">
        Pay your {formatPeso(booking.pricing.depositAmount)} deposit
      </h2>
      {left != null && (
        <p className={`mt-1 text-sm ${left < 600 ? 'font-semibold text-danger' : 'text-ink-600'}`} role="timer">
          {left > 0 ? `Your slot is held for ${formatCountdown(left)}.` : 'The hold has expired. You can still pay if the time is free.'}
        </p>
      )}

      {booking.deposit.rejectNote && (
        <Alert tone="error" className="mt-3">
          Your last deposit was not verified: {booking.deposit.rejectNote}
        </Alert>
      )}

      {settings.loading ? (
        <Spinner label="Loading payment details..." />
      ) : settings.error ? (
        <ErrorState message={settings.error} onRetry={settings.reload} />
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-control bg-ink-50 p-4">
          {s.gcashQrPath ? (
            <img src={uploadUrl(s.gcashQrPath)} alt="Gara GCash QR code" className="size-32 rounded-control bg-white object-contain" />
          ) : (
            <div className="flex size-32 items-center justify-center rounded-control border border-dashed border-ink-300 bg-white p-2 text-center text-xs text-ink-400">QR code coming soon</div>
          )}
          <dl className="text-sm">
            <dt className="text-xs uppercase tracking-wide text-ink-500">Send to GCash number</dt>
            <dd className="text-xl font-semibold tracking-wide text-ink-900">{s.gcashNumber}</dd>
            <dt className="mt-2 text-xs uppercase tracking-wide text-ink-500">Account name</dt>
            <dd className="font-medium text-ink-900">{s.gcashName}</dd>
            <dt className="mt-2 text-xs uppercase tracking-wide text-ink-500">Amount</dt>
            <dd className="font-semibold text-brand-700">{formatPeso(booking.pricing.depositAmount)}</dd>
          </dl>
        </div>
      )}

      <form onSubmit={submit} noValidate className="mt-5 space-y-4">
        <p className="text-sm text-ink-600">After paying in GCash, enter the reference number and upload a screenshot. The Gara team will verify it.</p>
        <Alert tone="error">{formError}</Alert>
        <TextField label="GCash reference number" name="gcashRef" value={ref} onChange={(e) => setRef(e.target.value)} error={errors.gcashRef} placeholder="e.g. 1234 567 890123" autoComplete="off" />
        <div>
          <p className="text-sm font-medium text-ink-700">Payment screenshot</p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {preview && <img src={preview} alt="Selected payment screenshot" className="h-24 rounded-control object-cover" />}
            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" aria-label="Choose payment screenshot" />
            <Button variant="secondary" onClick={() => inputRef.current?.click()}>
              {file ? 'Choose a different image' : 'Choose screenshot'}
            </Button>
          </div>
          {errors.screenshot && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {errors.screenshot}
            </p>
          )}
        </div>
        <Button type="submit" loading={submitting} className="w-full">
          Submit payment details
        </Button>
      </form>
    </section>
  );
}

const NEXT_STEP = {
  DEPOSIT_SUBMITTED: 'We received your payment details. The Gara team is verifying your deposit, which usually takes a short while.',
  DEPOSIT_VERIFIED: 'Your deposit is verified. Now we are waiting for the pro to confirm your appointment.',
  CONFIRMED: 'You are all set! Pay the balance to your pro on the day.',
};

export default function BookingDetail() {
  const { id } = useParams();
  const { data: booking, loading, error, reload, setData } = useAsync(() => bookingsApi.getBooking(id), [id]);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');

  if (loading) return <Spinner label="Loading booking..." />;
  if (error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorState message={error} onRetry={reload} />
        <p className="mt-4 text-center text-sm">
          <Link to="/bookings" className="font-semibold text-brand-600 hover:underline">
            Back to my bookings
          </Link>
        </p>
      </main>
    );
  }

  const cancellable = ['PENDING_DEPOSIT', 'DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED'].includes(booking.status) && new Date(booking.startAt) > new Date();

  const cancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      setData(await bookingsApi.cancelBooking(booking.id));
    } catch (err) {
      setCancelError(apiErrorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Link to="/bookings" className="text-sm font-medium text-brand-600 hover:underline">
        ← My bookings
      </Link>

      <header className="rounded-card bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm text-ink-500">Booking #{booking.id}</p>
            <h1 className="text-2xl font-bold">{booking.professional.displayName}</h1>
          </div>
          <StatusBadge status={booking.status} />
        </div>
        {STEPS.some((s) => s.key === booking.status) && (
          <div className="mt-5">
            <Timeline status={booking.status} />
          </div>
        )}
        {NEXT_STEP[booking.status] && <Alert tone={booking.status === 'CONFIRMED' ? 'success' : 'info'} className="mt-4">{NEXT_STEP[booking.status]}</Alert>}
        {booking.status === 'DECLINED' && (
          <Alert tone="error" className="mt-4">
            {booking.professional.displayName} could not take this booking{booking.declineReason ? ` (${booking.declineReason})` : ''}. Your deposit will be refunded
            {booking.refundResolvedAt ? ' and the refund has been sent.' : '. The Gara team will send it to your GCash.'}
          </Alert>
        )}
        {booking.status === 'NO_SHOW' && <Alert tone="error" className="mt-4">This appointment was marked as a no-show.</Alert>}
        {booking.status === 'CANCELLED' && (
          <Alert tone="info" className="mt-4">
            This booking was cancelled.{booking.depositPaidThenCancelled ? ' Because a deposit was already sent, the Gara team will contact you about it.' : ''}
          </Alert>
        )}
      </header>

      {booking.status === 'PENDING_DEPOSIT' && <PaymentPanel booking={booking} onUpdated={setData} />}

      <section className="rounded-card bg-white p-5 shadow-card">
        <h2 className="text-lg font-semibold">Appointment</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Date and time</dt>
            <dd className="font-medium">
              {formatDate(booking.startAt)}
              <br />
              {formatTime(booking.startAt)} – {formatTime(booking.endAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-500">Where</dt>
            <dd className="font-medium">
              {BOOKING_MODE_LABELS[booking.mode]}
              {booking.mode === 'HOME' && booking.address && (
                <span className="block font-normal text-ink-600">
                  {booking.address}, {booking.area}
                </span>
              )}
            </dd>
          </div>
          {booking.occasion && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Occasion</dt>
              <dd>{OCCASION_LABELS[booking.occasion]}</dd>
            </div>
          )}
          {booking.professional.phone && (
            <div>
              <dt className="text-xs uppercase tracking-wide text-ink-500">Pro's phone</dt>
              <dd>{booking.professional.phone}</dd>
            </div>
          )}
        </dl>
        {booking.notes && <p className="mt-3 text-sm italic text-ink-600">Your notes: “{booking.notes}”</p>}
        <ul className="mt-4 divide-y divide-ink-100 text-sm">
          {booking.items.map((i) => (
            <li key={i.id} className="flex justify-between py-1.5">
              <span>{i.name}</span>
              <span>{formatPeso(i.price)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3">
          <PriceBreakdown pricing={booking.pricing} mode={booking.mode} />
        </div>
      </section>

      {booking.deposit.gcashRef && (
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold">Your deposit</h2>
          <p className="mt-1 text-sm text-ink-600">
            Reference <span className="font-mono font-medium text-ink-900">{booking.deposit.gcashRef}</span>
            {booking.deposit.submittedAt && ` · sent ${formatDateTime(booking.deposit.submittedAt)}`}
            {booking.deposit.verifiedAt && ` · verified ${formatDateTime(booking.deposit.verifiedAt)}`}
          </p>
          {booking.deposit.screenshotPath && <SecureImage path={booking.deposit.screenshotPath} alt="Your GCash payment screenshot" className="mt-3 h-32 w-auto" />}
        </section>
      )}

      {booking.status === 'COMPLETED' && (
        <ReviewForm booking={booking} onReviewed={(review) => setData((b) => ({ ...b, review, canReview: false }))} />
      )}

      {cancellable && (
        <section className="rounded-card bg-white p-5 shadow-card">
          <h2 className="text-lg font-semibold">Need to cancel?</h2>
          <p className="mt-1 text-sm text-ink-600">
            You can cancel until the appointment starts.
            {['DEPOSIT_SUBMITTED', 'DEPOSIT_VERIFIED', 'CONFIRMED'].includes(booking.status) && ' Your deposit has already been sent, so the Gara team will contact you about it.'}
          </p>
          <Alert tone="error" className="mt-3">
            {cancelError}
          </Alert>
          <ConfirmButton className="mt-3" loading={cancelling} onConfirm={cancel} confirmLabel="Tap again to cancel booking">
            Cancel booking
          </ConfirmButton>
        </section>
      )}
    </main>
  );
}
