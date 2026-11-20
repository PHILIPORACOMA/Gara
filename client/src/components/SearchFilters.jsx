import { useState } from 'react';
import { SelectField, TextField } from './Field.jsx';
import Button from './Button.jsx';
import { useMeta } from '../hooks/useMeta.js';
import { CATEGORY_LABELS } from '../lib/labels.js';
import { MAX_ADVANCE_DAYS, addDaysIso, todayManila } from '../lib/dates.js';

export const EMPTY_FILTERS = { category: '', area: '', date: '', minPrice: '', maxPrice: '', homeOnly: false };

function validate(f) {
  const errors = {};
  const min = f.minPrice === '' ? null : Number(f.minPrice);
  const max = f.maxPrice === '' ? null : Number(f.maxPrice);
  if (min != null && (Number.isNaN(min) || min < 0)) errors.minPrice = 'Enter 0 or more';
  if (max != null && (Number.isNaN(max) || max < 0)) errors.maxPrice = 'Enter 0 or more';
  if (!errors.minPrice && !errors.maxPrice && min != null && max != null && min > max) errors.maxPrice = 'Must be at least the minimum';
  if (f.date && (f.date < todayManila() || f.date > addDaysIso(todayManila(), MAX_ADVANCE_DAYS))) {
    errors.date = `Choose a date within the next ${MAX_ADVANCE_DAYS} days`;
  }
  return errors;
}

// Controlled by the URL: `value` comes from the query string, `onApply` writes it back.
export default function SearchFilters({ value, onApply, compact = false }) {
  const { meta } = useMeta();
  const [draft, setDraft] = useState(value);
  const [errors, setErrors] = useState({});

  const set = (name, v) => setDraft((d) => ({ ...d, [name]: v }));
  const onChange = (e) => set(e.target.name, e.target.value);

  const submit = (e) => {
    e.preventDefault();
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length === 0) onApply(draft);
  };

  const clear = () => {
    setDraft(EMPTY_FILTERS);
    setErrors({});
    onApply(EMPTY_FILTERS);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Search filters">
      <fieldset>
        <legend className="text-sm font-medium text-ink-700">What do you need?</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {[['', 'All'], ...Object.entries(CATEGORY_LABELS)].map(([val, label]) => (
            <button
              key={val || 'all'}
              type="button"
              aria-pressed={draft.category === val}
              onClick={() => set('category', val)}
              className={`min-h-10 rounded-full border px-4 text-sm font-medium transition-colors ${
                draft.category === val ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className={compact ? 'grid gap-4 sm:grid-cols-2' : 'space-y-4'}>
        <SelectField label="Area" name="area" value={draft.area} onChange={onChange}>
          <option value="">Anywhere in Cebu</option>
          {meta?.areas.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </SelectField>
        <TextField label="Date" name="date" type="date" min={todayManila()} max={addDaysIso(todayManila(), MAX_ADVANCE_DAYS)} value={draft.date} onChange={onChange} error={errors.date} hint={draft.date ? undefined : 'Only show pros who are free that day'} />
      </div>

      {!compact && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Min price (₱)" name="minPrice" type="number" inputMode="numeric" min="0" value={draft.minPrice} onChange={onChange} error={errors.minPrice} />
          <TextField label="Max price (₱)" name="maxPrice" type="number" inputMode="numeric" min="0" value={draft.maxPrice} onChange={onChange} error={errors.maxPrice} />
        </div>
      )}

      {!compact && (
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink-800">
          <input type="checkbox" checked={draft.homeOnly} onChange={(e) => set('homeOnly', e.target.checked)} className="size-5 accent-brand-500" />
          Home service only
        </label>
      )}

      <div className="flex gap-3">
        <Button type="submit" className="flex-1">
          {compact ? 'Find pros' : 'Apply filters'}
        </Button>
        {!compact && (
          <Button variant="secondary" onClick={clear}>
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
