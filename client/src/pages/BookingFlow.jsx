import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAsync } from '../hooks/useAsync.js';
import { getPro, getSlots } from '../api/discovery.js';
import * as bookingsApi from '../api/bookings.js';
import { apiErrorMessage, apiFieldErrors } from '../api/http.js';
import { SelectField, TextAreaField, TextField } from '../components/Field.jsx';
import Alert from '../components/Alert.jsx';
import Button from '../components/Button.jsx';
import PriceBreakdown from '../components/PriceBreakdown.jsx';
import Spinner from '../components/Spinner.jsx';
import ErrorState from '../components/ErrorState.jsx';
import VerifiedBadge from '../components/VerifiedBadge.jsx';
import { CATEGORY_LABELS, OCCASION_LABELS, formatDuration } from '../lib/labels.js';
import { formatPeso } from '../lib/money.js';
import { MAX_ADVANCE_DAYS, addDaysIso, formatDate, formatTime, todayManila } from '../lib/dates.js';

function Section({ number, title, children }) {
  return (
    <section className="rounded-card bg-white p-5 shadow-card">
      <h2 className="flex items-center gap-3 text-lg font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white" aria-hidden="true">
          {number}
        </span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function BookingFlow() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const proState = useAsync(() => getPro(id), [id]);
  const pro = proState.data;

  const [selected, setSelected] = useState([]);
  const [mode, setMode] = useState('');
  const [date, setDate] = useState(searchParams.get('date') ?? '');
  const [slot, setSlot] = useState('');
  const [address, setAddress] = useState('');
  const [area, setArea] = useState('');
  const [occasion, setOccasion] = useState('');
  const [notes, setNotes] = useState('');

  const [quote, setQuote] = useState({ state: 'idle' });
  const [slots, setSlots] = useState({ state: 'idle' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A pro who offers only one mode needs no choice.
  useEffect(() => {
    if (pro?.serviceMode === 'HOME') setMode('HOME');
    if (pro?.serviceMode === 'STORE') setMode('STORE');
  }, [pro?.serviceMode]);

  const toggleService = (sid) => {
    setSelected((cur) => (cur.includes(sid) ? cur.filter((x) => x !== sid) : [...cur, sid]));
    setSlot('');
  };

  // Price breakdown from the server (the same math that is applied when booking).
  useEffect(() => {
    if (!pro || selected.length === 0 || !mode) {
      setQuote({ state: 'idle' });
      return undefined;
    }
    let active = true;
    setQuote((q) => ({ ...q, state: 'loading' }));
    bookingsApi
      .quote({ professionalId: pro.id, serviceIds: selected, mode })
      .then((data) => active && setQuote({ state: 'ready', data }))
      .catch((err) => active && setQuote({ state: 'error', message: apiErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [pro, selected, mode]);

  // Open times from the server: opening hours minus blocked dates minus other bookings,
  // for the TOTAL duration of the chosen services.
  const loadSlots = useCallback(() => {
    if (!pro || selected.length === 0 || !mode || !date) {
      setSlots({ state: 'idle' });
      return () => {};
    }
    let active = true;
    setSlots({ state: 'loading' });
    getSlots(pro.id, { date, mode, serviceIds: selected })
      .then((data) => {
        if (!active) return;
        setSlots({ state: 'ready', data });
        setSlot((cur) => (data.slots.some((s) => s.startAt === cur) ? cur : ''));
      })
      .catch((err) => active && setSlots({ state: 'error', message: apiErrorMessage(err) }));
    return () => {
      active = false;
    };
  }, [pro, selected, mode, date]);

  useEffect(() => loadSlots(), [loadSlots]);

  const chosen = useMemo(() => (pro ? pro.services.filter((s) => selected.includes(s.id)) : []), [pro, selected]);
  const totalMinutes = chosen.reduce((sum, s) => sum + s.durationMin, 0);

  if (proState.loading) return <Spinner label="Loading..." />;
  if (proState.error) {
    return (
      <main className="mx-auto max-w-md px-4 py-10">
        <ErrorState message={proState.error} onRetry={proState.reload} />
      </main>
    );
  }

  const groups = pro.categories.map((c) => ({ category: c, services: pro.services.filter((s) => s.category === c) })).filter((g) => g.services.length);
  const offersHome = pro.serviceMode !== 'STORE';
  const offersStore = pro.serviceMode !== 'HOME';

  const validate = () => {
    const e = {};
    if (selected.length === 0) e.services = 'Choose at least one service';
    if (!mode) e.mode = 'Choose home service or in-store';
    if (mode === 'HOME') {
      if (address.trim().length < 8) e.address = 'Enter your full address (house/unit, street, barangay)';
      if (!area) e.area = 'Choose your area';
    }
    if (!date) e.date = 'Choose a date';
    else if (!slot) e.slot = 'Choose a time';
    return e;
  };

  const confirm = async (ev) => {
    ev.preventDefault();
    const found = validate();
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;

    setSubmitting(true);
    try {
      const booking = await bookingsApi.createBooking({
        professionalId: pro.id,
        serviceIds: selected,
        mode,
        startAt: slot,
        address: mode === 'HOME' ? address.trim() : '',
        area: mode === 'HOME' ? area : '',
        occasion,
        notes: notes.trim(),
      });
      navigate(`/bookings/${booking.id}`, { replace: true });
    } catch (err) {
      setErrors(apiFieldErrors(err));
      setFormError(apiErrorMessage(err));
      if (err?.response?.data?.error?.code === 'SLOT_TAKEN') {
        setSlot('');
        loadSlots();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link to={`/pros/${pro.id}`} className="text-sm font-medium text-brand-600 hover:underline">
        ← Back to profile
      </Link>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <h1 className="text-3xl font-bold">Book {pro.displayName}</h1>
        <VerifiedBadge />
      </div>

      <form onSubmit={confirm} noValidate className="mt-5 space-y-4">
        <Alert tone="error">{formError}</Alert>

        <Section number="1" title="Choose services">
          {groups.map((g) => (
            <div key={g.category} className="mb-3 last:mb-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-500">{CATEGORY_LABELS[g.category]}</h3>
              <ul className="mt-1 space-y-2">
                {g.services.map((s) => (
                  <li key={s.id}>
                    <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-control border p-3 transition-colors ${selected.includes(s.id) ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'}`}>
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleService(s.id)} className="size-5 shrink-0 accent-brand-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink-900">{s.name}</span>
                        <span className="block text-xs text-ink-500">{formatDuration(s.durationMin)}</span>
                      </span>
                      <span className="shrink-0 font-semibold text-brand-700">{formatPeso(s.price)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {errors.services && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errors.services}
            </p>
          )}
          {selected.length > 0 && (
            <p className="mt-3 text-sm text-ink-600">
              {selected.length} selected &middot; {formatDuration(totalMinutes)} in total
            </p>
          )}
        </Section>

        <Section number="2" title="Where?">
          {offersHome && offersStore ? (
            <fieldset>
              <legend className="sr-only">Service location</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  ['HOME', 'Home service', pro.travelFee > 0 ? `${formatPeso(pro.travelFee)} travel fee` : 'No travel fee'],
                  ['STORE', 'In-store', pro.storeAddress ?? 'At the studio'],
                ].map(([val, label, hint]) => (
                  <label key={val} className={`cursor-pointer rounded-control border p-3 text-sm transition-colors ${mode === val ? 'border-brand-500 bg-brand-50' : 'border-ink-200 hover:bg-ink-50'}`}>
                    <input type="radio" name="mode" value={val} checked={mode === val} onChange={() => { setMode(val); setSlot(''); }} className="sr-only" />
                    <span className="block font-semibold text-ink-900">{label}</span>
                    <span className="block text-xs text-ink-500">{hint}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="text-sm text-ink-700">
              {offersHome ? `Home service only${pro.travelFee > 0 ? ` · ${formatPeso(pro.travelFee)} travel fee` : ''}` : `In-store only · ${pro.storeAddress ?? ''}`}
            </p>
          )}
          {errors.mode && (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errors.mode}
            </p>
          )}

          {mode === 'HOME' && (
            <div className="mt-4 space-y-4">
              <TextAreaField label="Your address" name="address" value={address} onChange={(e) => setAddress(e.target.value)} error={errors.address} rows={2} maxLength={300} placeholder="House/unit no., street, barangay" autoComplete="street-address" />
              <SelectField label="Area" name="area" value={area} onChange={(e) => setArea(e.target.value)} error={errors.area}>
                <option value="">Choose your area...</option>
                {pro.areas.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </SelectField>
            </div>
          )}
        </Section>

        <Section number="3" title="When?">
          <TextField label="Date" name="date" type="date" min={todayManila()} max={addDaysIso(todayManila(), MAX_ADVANCE_DAYS)} value={date} onChange={(e) => { setDate(e.target.value); setSlot(''); }} error={errors.date} />

          <div className="mt-4" aria-live="polite">
            {selected.length === 0 || !mode ? (
              <p className="text-sm text-ink-500">Choose your services and location to see open times.</p>
            ) : !date ? (
              <p className="text-sm text-ink-500">Pick a date to see open times.</p>
            ) : slots.state === 'loading' ? (
              <Spinner label="Checking availability..." />
            ) : slots.state === 'error' ? (
              <ErrorState message={slots.message} onRetry={loadSlots} />
            ) : slots.state === 'ready' && slots.data.slots.length === 0 ? (
              <p className="rounded-control bg-ink-50 p-3 text-sm text-ink-600">No open times on {formatDate(`${date}T00:00:00+08:00`)} for {formatDuration(slots.data.durationMin)} of services. Try another date.</p>
            ) : slots.state === 'ready' ? (
              <fieldset>
                <legend className="text-sm font-medium text-ink-700">Open times (Philippine time)</legend>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.data.slots.map((s) => (
                    <button
                      key={s.startAt}
                      type="button"
                      aria-pressed={slot === s.startAt}
                      onClick={() => setSlot(s.startAt)}
                      className={`min-h-11 rounded-control border px-2 text-sm font-medium transition-colors ${slot === s.startAt ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-800 hover:bg-ink-50'}`}
                    >
                      {formatTime(s.startAt)}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}
            {errors.slot && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {errors.slot}
              </p>
            )}
            {slot && slots.state === 'ready' && (
              <p className="mt-3 text-sm text-ink-700">
                Your appointment: <strong>{formatDate(slot)}</strong>, {formatTime(slot)} – {formatTime(slots.data.slots.find((s) => s.startAt === slot).endAt)}
              </p>
            )}
          </div>
        </Section>

        <Section number="4" title="Anything we should know? (optional)">
          <SelectField label="Occasion" name="occasion" value={occasion} onChange={(e) => setOccasion(e.target.value)}>
            <option value="">Regular appointment</option>
            {Object.entries(OCCASION_LABELS).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextAreaField className="mt-4" label="Notes for your pro" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} error={errors.notes} rows={3} maxLength={500} placeholder="Inspiration, allergies, number of people..." />
        </Section>

        <Section number="5" title="Review and confirm">
          {quote.state === 'ready' ? (
            <>
              <ul className="mb-3 divide-y divide-ink-100 text-sm">
                {quote.data.items.map((i) => (
                  <li key={i.id} className="flex justify-between py-1.5">
                    <span>{i.name}</span>
                    <span>{formatPeso(i.price)}</span>
                  </li>
                ))}
              </ul>
              <PriceBreakdown pricing={quote.data.pricing} mode={mode} />
              <p className="mt-3 text-xs text-ink-500">
                You pay the deposit by GCash on the next screen. Your slot is held for {Math.round(quote.data.holdMinutes / 60 * 10) / 10} hours while you do. The balance is paid to {pro.displayName} on the day.
              </p>
            </>
          ) : quote.state === 'loading' ? (
            <Spinner label="Calculating price..." />
          ) : quote.state === 'error' ? (
            <Alert tone="error">{quote.message}</Alert>
          ) : (
            <p className="text-sm text-ink-500">Choose your services and location to see the full price before you confirm.</p>
          )}
          <Button type="submit" loading={submitting} disabled={quote.state === 'loading'} className="mt-4 w-full">
            Confirm booking
          </Button>
        </Section>
      </form>
    </main>
  );
}
