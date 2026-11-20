import { useRef, useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as adminApi from '../../api/admin.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/http.js';
import { TextField } from '../../components/Field.jsx';
import Alert from '../../components/Alert.jsx';
import Button from '../../components/Button.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { checkImageFile, uploadUrl } from '../../lib/uploads.js';

function validate(v) {
  const e = {};
  const dep = Number(v.depositPct);
  const com = Number(v.commissionPct);
  const hold = Number(v.holdMinutes);
  if (v.depositPct === '' || Number.isNaN(dep) || dep < 1 || dep > 100) e.depositPct = 'Enter a percentage from 1 to 100';
  if (v.commissionPct === '' || Number.isNaN(com) || com < 0 || com > 50) e.commissionPct = 'Enter a percentage from 0 to 50';
  if (v.holdMinutes === '' || !Number.isInteger(hold) || hold < 15 || hold > 1440) e.holdMinutes = 'Enter whole minutes from 15 to 1440';
  if (v.gcashNumber.trim().length < 7) e.gcashNumber = 'Enter the GCash number';
  if (v.gcashName.trim().length < 2) e.gcashName = 'Enter the account name';
  return e;
}

function SettingsForm({ initial, onSaved }) {
  const [values, setValues] = useState({
    depositPct: String(initial.depositPct),
    commissionPct: String(initial.commissionPct),
    holdMinutes: String(initial.holdMinutes),
    gcashNumber: initial.gcashNumber,
    gcashName: initial.gcashName,
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const onChange = (e) => {
    setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
    setSaved(false);
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    setSaved(false);
    if (Object.keys(found).length) return;
    setSaving(true);
    try {
      onSaved(await adminApi.updateSettings({
        depositPct: Number(values.depositPct),
        commissionPct: Number(values.commissionPct),
        holdMinutes: Number(values.holdMinutes),
        gcashNumber: values.gcashNumber.trim(),
        gcashName: values.gcashName.trim(),
      }));
      setSaved(true);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-card bg-white p-5 shadow-card">
      <Alert tone="error">{formError}</Alert>
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Money</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Deposit (%)" name="depositPct" type="number" inputMode="decimal" min="1" max="100" step="0.5" value={values.depositPct} onChange={onChange} error={errors.depositPct} hint="Share of the total paid by GCash to secure a booking" />
          <TextField label="Commission (%)" name="commissionPct" type="number" inputMode="decimal" min="0" max="50" step="0.5" value={values.commissionPct} onChange={onChange} error={errors.commissionPct} hint="Taken from the service price (never the travel fee)" />
          <TextField label="Unpaid hold (minutes)" name="holdMinutes" type="number" inputMode="numeric" min="15" max="1440" step="5" value={values.holdMinutes} onChange={onChange} error={errors.holdMinutes} hint="How long an unpaid booking keeps its slot" />
        </div>
        <p className="text-xs text-ink-500">Changes apply to new bookings only. Existing bookings keep the deposit and commission they were made with.</p>
      </fieldset>
      <fieldset className="space-y-4">
        <legend className="text-lg font-semibold">Gara GCash account</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="GCash number" name="gcashNumber" value={values.gcashNumber} onChange={onChange} error={errors.gcashNumber} inputMode="tel" />
          <TextField label="Account name" name="gcashName" value={values.gcashName} onChange={onChange} error={errors.gcashName} />
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Save settings
        </Button>
        {saved && (
          <span role="status" className="text-sm font-medium text-success">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}

function QrUpload({ qrPath, onChanged }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ tone: 'error', text: '' });

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const problem = checkImageFile(file);
    if (problem) return setMessage({ tone: 'error', text: problem });
    setUploading(true);
    setMessage({ tone: 'error', text: '' });
    try {
      onChanged(await adminApi.uploadQr(file));
      setMessage({ tone: 'success', text: 'QR code updated. Customers see it on the payment screen.' });
    } catch (err) {
      setMessage({ tone: 'error', text: apiErrorMessage(err) });
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold">GCash QR code</h2>
      <p className="mt-1 text-sm text-ink-600">Shown to customers next to the GCash number when they pay their deposit.</p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {qrPath ? (
          <img src={uploadUrl(qrPath)} alt="Current GCash QR code" className="size-36 rounded-control border border-ink-100 bg-white object-contain" />
        ) : (
          <div className="flex size-36 items-center justify-center rounded-control border border-dashed border-ink-300 p-2 text-center text-xs text-ink-400">No QR uploaded (a placeholder is shown)</div>
        )}
        <div>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={pick} className="sr-only" aria-label="Choose QR code image" />
          <Button variant="secondary" onClick={() => inputRef.current?.click()} loading={uploading}>
            {qrPath ? 'Replace QR code' : 'Upload QR code'}
          </Button>
          <p className="mt-2 text-xs text-ink-500">JPG, PNG or WebP, up to 5 MB.</p>
        </div>
      </div>
      <Alert tone={message.tone} className="mt-3">
        {message.text}
      </Alert>
    </section>
  );
}

export default function AdminSettings() {
  const { data, loading, error, reload, setData } = useAsync(() => adminApi.getSettings(), []);
  if (loading) return <Spinner label="Loading settings..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Settings</h1>
      <SettingsForm initial={data} onSaved={(s) => setData(s)} />
      <QrUpload qrPath={data.gcashQrPath} onChanged={(s) => setData(s)} />
    </div>
  );
}
