import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import { useMeta } from '../../hooks/useMeta.js';
import * as proApi from '../../api/pro.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/http.js';
import { SelectField, TextAreaField, TextField } from '../../components/Field.jsx';
import ChipSelect from '../../components/ChipSelect.jsx';
import Button from '../../components/Button.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { CATEGORY_LABELS, SERVICE_MODE_LABELS } from '../../lib/labels.js';

function validate(v) {
  const errors = {};
  if (v.displayName.trim().length < 2) errors.displayName = 'Display name must be at least 2 characters';
  if (v.categories.length === 0) errors.categories = 'Choose at least one category';
  if (v.areas.length === 0) errors.areas = 'Choose at least one area';
  const store = v.serviceMode === 'STORE' || v.serviceMode === 'BOTH';
  const home = v.serviceMode === 'HOME' || v.serviceMode === 'BOTH';
  if (store && !v.storeAddress.trim()) errors.storeAddress = 'Enter your in-store address';
  if (home) {
    const fee = Number(v.travelFee);
    if (v.travelFee === '' || Number.isNaN(fee) || fee < 0) errors.travelFee = 'Enter a valid amount (0 or more)';
    else if (fee > 5000) errors.travelFee = 'Travel fee must be at most 5,000';
  }
  const messenger = v.messengerUrl.trim();
  const phone = v.contactPhone.replace(/[\s()-]/g, '');
  // Same rules as the server (validators/pro.validators.js).
  if (messenger && !/^(https?:\/\/)?(www\.|m\.)?(m\.me|messenger\.com|facebook\.com|fb\.com)\/\S+$/i.test(messenger)) {
    errors.messengerUrl = 'Paste your Messenger link (m.me/yourpage) or your Facebook page link';
  }
  if (phone && !/^(\+?63|0)9\d{9}$/.test(phone)) errors.contactPhone = 'Enter a Philippine mobile number, like 0917 123 4567';
  if (!messenger && !phone) errors.contactPhone = 'Add a Messenger link or a mobile number so customers can reach you';
  return errors;
}

function ProfileForm({ profile, meta, onSaved }) {
  const [values, setValues] = useState({
    displayName: profile.displayName ?? '',
    bio: profile.bio ?? '',
    categories: profile.categories,
    areas: profile.areas,
    serviceMode: profile.serviceMode,
    storeAddress: profile.storeAddress ?? '',
    travelFee: String(profile.travelFee ?? 0),
    messengerUrl: profile.messengerUrl ?? '',
    // Stored as +639171234567; shown the way people write it.
    contactPhone: profile.contactPhone ? profile.contactPhone.replace(/^\+63/, '0') : '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (name, value) => {
    setValues((v) => ({ ...v, [name]: value }));
    setSaved(false);
  };
  const onChange = (e) => set(e.target.name, e.target.value);

  const store = values.serviceMode === 'STORE' || values.serviceMode === 'BOTH';
  const home = values.serviceMode === 'HOME' || values.serviceMode === 'BOTH';

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    setSaved(false);
    if (Object.keys(found).length) return;

    setSaving(true);
    try {
      const result = await proApi.updateProfile({
        displayName: values.displayName.trim(),
        bio: values.bio.trim(),
        categories: values.categories,
        areas: values.areas,
        serviceMode: values.serviceMode,
        storeAddress: store ? values.storeAddress.trim() : '',
        travelFee: home ? Number(values.travelFee) : 0,
        messengerUrl: values.messengerUrl.trim(),
        contactPhone: values.contactPhone.trim(),
      });
      setSaved(true);
      onSaved(result);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5 rounded-card bg-white p-5 shadow-card">
      <Alert tone="error">{formError}</Alert>

      <TextField label="Display name" name="displayName" value={values.displayName} onChange={onChange} error={errors.displayName} hint="Shown to customers on your profile" />
      <TextAreaField label="Bio (optional)" name="bio" value={values.bio} onChange={onChange} error={errors.bio} hint="Tell customers about your experience and style" maxLength={1000} />

      <ChipSelect
        label="What do you offer?"
        options={meta.categories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))}
        value={values.categories}
        onChange={(v) => set('categories', v)}
        error={errors.categories}
      />
      <ChipSelect
        label="Areas you serve"
        options={meta.areas.map((a) => ({ value: a, label: a }))}
        value={values.areas}
        onChange={(v) => set('areas', v)}
        error={errors.areas}
      />

      <SelectField label="Service mode" name="serviceMode" value={values.serviceMode} onChange={onChange}>
        {meta.serviceModes.map((m) => (
          <option key={m} value={m}>
            {SERVICE_MODE_LABELS[m]}
          </option>
        ))}
      </SelectField>

      {store && (
        <TextField label="In-store address" name="storeAddress" value={values.storeAddress} onChange={onChange} error={errors.storeAddress} autoComplete="street-address" />
      )}
      {home && (
        <TextField
          label="Home-service travel fee (₱)"
          name="travelFee"
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={values.travelFee}
          onChange={onChange}
          error={errors.travelFee}
          hint="A fixed fee for home service, shown on your profile so customers know it upfront."
        />
      )}

      <fieldset className="space-y-4 rounded-control border border-ink-200 p-4">
        <legend className="px-1 text-sm font-semibold text-ink-800">How customers reach you</legend>
        <p className="text-xs text-ink-500">Add at least one. Customers tap Messenger, Call or SMS on your profile. Your link and number are only shown to signed-in customers.</p>
        <TextField label="Messenger link" name="messengerUrl" value={values.messengerUrl} onChange={onChange} error={errors.messengerUrl} placeholder="m.me/yourpage" inputMode="url" autoComplete="url" hint="Your m.me link or Facebook page link" />
        <TextField label="Mobile number (for Call and SMS)" name="contactPhone" type="tel" value={values.contactPhone} onChange={onChange} error={errors.contactPhone} placeholder="0917 123 4567" inputMode="tel" autoComplete="tel" />
      </fieldset>

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Save profile
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

export default function ProProfile() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getProfile(), []);
  const { meta, error: metaError } = useMeta();

  if (loading || (!meta && !metaError)) return <Spinner label="Loading your profile..." />;
  if (error || metaError) return <ErrorState message={error ?? 'Could not load form options.'} onRetry={reload} />;

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Profile</h1>
      <ProfileForm profile={data.profile} meta={meta} onSaved={(result) => setData(result)} />
    </div>
  );
}
