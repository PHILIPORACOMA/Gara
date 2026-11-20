import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import { apiErrorMessage, apiFieldErrors } from '../../api/http.js';
import { SelectField, TextAreaField, TextField } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import Badge from '../../components/Badge.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import EmptyState from '../../components/EmptyState.jsx';
import { CATEGORY_LABELS, formatDuration } from '../../lib/labels.js';
import { formatPeso } from '../../lib/money.js';

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240, 300, 360, 480];

function validate(v) {
  const errors = {};
  if (v.name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
  if (!v.category) errors.category = 'Choose a category';
  const price = Number(v.price);
  if (v.price === '' || Number.isNaN(price) || price < 1) errors.price = 'Enter a price of at least ₱1';
  else if (price > 100000) errors.price = 'Price must be at most ₱100,000';
  return errors;
}

function ServiceForm({ categories, initial, onSaved, onCancel }) {
  const [values, setValues] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? (categories.length === 1 ? categories[0] : ''),
    price: initial ? String(initial.price) : '',
    durationMin: String(initial?.durationMin ?? 60),
    description: initial?.description ?? '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const onChange = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));
  const durations = DURATIONS.includes(Number(values.durationMin)) ? DURATIONS : [...DURATIONS, Number(values.durationMin)].sort((a, b) => a - b);

  const onSubmit = async (e) => {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    const payload = {
      name: values.name.trim(),
      category: values.category,
      price: Number(values.price),
      durationMin: Number(values.durationMin),
      description: values.description.trim(),
    };
    setSaving(true);
    try {
      const saved = initial ? await proApi.updateService(initial.id, payload) : await proApi.createService(payload);
      onSaved(saved);
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-4 rounded-card border border-brand-200 bg-white p-5 shadow-card">
      <h2 className="text-lg font-semibold">{initial ? 'Edit service' : 'Add a service'}</h2>
      <Alert tone="error">{formError}</Alert>
      <TextField label="Service name" name="name" value={values.name} onChange={onChange} error={errors.name} placeholder="e.g. Bridal hairstyle" />
      <SelectField label="Category" name="category" value={values.category} onChange={onChange} error={errors.category}>
        <option value="">Choose...</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Price (₱)" name="price" type="number" inputMode="decimal" min="1" step="1" value={values.price} onChange={onChange} error={errors.price} />
        <SelectField label="Duration" name="durationMin" value={values.durationMin} onChange={onChange} error={errors.durationMin}>
          {durations.map((d) => (
            <option key={d} value={d}>
              {formatDuration(d)}
            </option>
          ))}
        </SelectField>
      </div>
      <TextAreaField label="Description (optional)" name="description" value={values.description} onChange={onChange} error={errors.description} rows={3} maxLength={500} />
      <div className="flex gap-3">
        <Button type="submit" loading={saving}>
          {initial ? 'Save changes' : 'Add service'}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export default function ProServices() {
  const profile = useAsync(() => proApi.getProfile(), []);
  const services = useAsync(() => proApi.listServices(), []);
  const [editing, setEditing] = useState(null); // null | 'new' | service
  const [removingId, setRemovingId] = useState(null);
  const [actionError, setActionError] = useState('');

  if (profile.loading || services.loading) return <Spinner label="Loading your services..." />;
  if (profile.error || services.error) {
    return (
      <ErrorState
        message={profile.error ?? services.error}
        onRetry={() => {
          profile.reload();
          services.reload();
        }}
      />
    );
  }

  const categories = profile.data.profile.categories;
  const list = services.data;

  const remove = async (service) => {
    setRemovingId(service.id);
    setActionError('');
    try {
      await proApi.removeService(service.id);
      services.setData((rows) => rows.filter((s) => s.id !== service.id));
    } catch (err) {
      setActionError(apiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  const onSaved = (saved) => {
    services.setData((rows) => {
      const exists = rows.some((s) => s.id === saved.id);
      const next = exists ? rows.map((s) => (s.id === saved.id ? saved : s)) : [...rows, saved];
      return next.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    });
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Services</h1>
        {categories.length > 0 && !editing && <Button onClick={() => setEditing('new')}>Add service</Button>}
      </div>

      <Alert tone="error">{actionError}</Alert>

      {categories.length === 0 && (
        <EmptyState
          title="Choose your categories first"
          description="Tell us whether you do hair, nails or makeup, then add your services and prices."
          action={
            <Link to="/pro/profile" className="rounded-control bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
              Go to profile
            </Link>
          }
        />
      )}

      {editing && (
        <ServiceForm
          key={editing === 'new' ? 'new' : editing.id}
          categories={categories}
          initial={editing === 'new' ? null : editing}
          onSaved={onSaved}
          onCancel={() => setEditing(null)}
        />
      )}

      {categories.length > 0 && list.length === 0 && !editing && (
        <EmptyState title="No services yet" description="Add the services you offer, with upfront prices. Customers see these before booking." />
      )}

      <ul className="space-y-3">
        {list.map((s) => (
          <li key={s.id} className="rounded-card bg-white p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-ink-900">{s.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
                  <Badge tone="brand">{CATEGORY_LABELS[s.category]}</Badge>
                  <span>{formatDuration(s.durationMin)}</span>
                </p>
                {s.description && <p className="mt-2 text-sm text-ink-600">{s.description}</p>}
              </div>
              <p className="shrink-0 text-lg font-semibold text-brand-700">{formatPeso(s.price)}</p>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" className="!min-h-9 !py-1.5" onClick={() => setEditing(s)}>
                Edit
              </Button>
              <ConfirmButton className="!min-h-9 !py-1.5" loading={removingId === s.id} onConfirm={() => remove(s)} confirmLabel="Tap again to remove">
                Remove
              </ConfirmButton>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
