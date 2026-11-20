import { useState } from 'react';
import * as proApi from '../api/pro.js';
import { apiErrorMessage } from '../api/http.js';
import Alert from './Alert.jsx';
import Button from './Button.jsx';
import ConfirmButton from './ConfirmButton.jsx';
import { TextField } from './Field.jsx';

// The buttons a professional can press on a booking, depending on its status.
// `onChanged(updatedBooking)` receives the booking returned by the server.
export default function ProBookingActions({ booking, onChanged }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');

  const run = async (name, fn) => {
    setBusy(name);
    setError('');
    try {
      onChanged(await fn());
      setDeclining(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (booking.status === 'DEPOSIT_VERIFIED') {
    return (
      <div className="w-full space-y-3">
        <Alert tone="error">{error}</Alert>
        {!declining ? (
          <div className="flex flex-wrap gap-2">
            <Button loading={busy === 'accept'} disabled={busy !== null} onClick={() => run('accept', () => proApi.acceptBooking(booking.id))}>
              Accept
            </Button>
            <Button variant="secondary" disabled={busy !== null} onClick={() => setDeclining(true)}>
              Decline...
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-control border border-danger/30 bg-danger/5 p-3">
            <p className="text-sm text-ink-700">The customer's deposit will be refunded by the Gara team.</p>
            <TextField label="Reason (optional, shown to the customer)" name={`decline-${booking.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={200} />
            <div className="flex gap-2">
              <Button variant="danger" loading={busy === 'decline'} onClick={() => run('decline', () => proApi.declineBooking(booking.id, reason.trim()))}>
                Confirm decline
              </Button>
              <Button variant="secondary" disabled={busy !== null} onClick={() => setDeclining(false)}>
                Back
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (booking.status === 'CONFIRMED') {
    if (!booking.canComplete) {
      return <p className="text-xs text-ink-500">You can mark this booking completed or no-show once the appointment has started.</p>;
    }
    return (
      <div className="w-full space-y-3">
        <Alert tone="error">{error}</Alert>
        <div className="flex flex-wrap gap-2">
          <ConfirmButton variant="primary" loading={busy === 'complete'} onConfirm={() => run('complete', () => proApi.completeBooking(booking.id))} confirmLabel="Tap again: mark completed">
            Mark completed
          </ConfirmButton>
          <ConfirmButton loading={busy === 'noshow'} onConfirm={() => run('noshow', () => proApi.markNoShow(booking.id))} confirmLabel="Tap again: customer no-show">
            No-show
          </ConfirmButton>
        </div>
      </div>
    );
  }

  return null;
}
