import { useMemo, useState } from 'react';
import { useAsync } from '../../hooks/useAsync.js';
import * as proApi from '../../api/pro.js';
import { apiErrorMessage } from '../../api/http.js';
import { TextField } from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import ConfirmButton from '../../components/ConfirmButton.jsx';
import Alert from '../../components/Alert.jsx';
import Spinner from '../../components/Spinner.jsx';
import ErrorState from '../../components/ErrorState.jsx';
import { DAY_LABELS } from '../../lib/labels.js';
import { formatDate, formatMinutes, todayManila } from '../../lib/dates.js';

const DAYS = [1, 2, 3, 4, 5, 6, 7];
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const START_OPTIONS = range(240, 1410, 30); // 4:00 AM ... 11:30 PM
const END_OPTIONS = range(270, 1440, 30); // 4:30 AM ... midnight
const DEFAULT_WINDOW = { startMin: 540, endMin: 1080 }; // 9 AM - 6 PM

const emptyWeek = () => Object.fromEntries(DAYS.map((d) => [d, []]));

function toWeek(rules) {
  const week = emptyWeek();
  rules.forEach((r) => week[r.dayOfWeek].push({ startMin: r.startMin, endMin: r.endMin }));
  DAYS.forEach((d) => week[d].sort((a, b) => a.startMin - b.startMin));
  return week;
}

const toRules = (week) => DAYS.flatMap((d) => week[d].map((w) => ({ dayOfWeek: d, ...w })));

// One message per problem day: end before start, or windows that overlap.
function validateWeek(week) {
  const problems = {};
  DAYS.forEach((d) => {
    const sorted = [...week[d]].sort((a, b) => a.startMin - b.startMin);
    if (sorted.some((w) => w.endMin <= w.startMin)) problems[d] = 'End time must be after start time';
    else if (sorted.some((w, i) => i > 0 && w.startMin < sorted[i - 1].endMin)) problems[d] = 'Time windows cannot overlap';
  });
  return problems;
}

const selectClass = 'min-h-11 rounded-control border border-ink-200 bg-white px-2.5 py-2 text-base focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-200 sm:text-sm';

function WeeklyEditor({ initialRules, onSaved }) {
  const [week, setWeek] = useState(() => toWeek(initialRules));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ tone: 'error', text: '' });
  const problems = useMemo(() => validateWeek(week), [week]);

  const update = (next) => {
    setWeek(next);
    setMessage({ tone: 'error', text: '' });
  };
  const setDay = (d, windows) => update({ ...week, [d]: windows });
  const setWindow = (d, i, patch) => setDay(d, week[d].map((w, idx) => (idx === i ? { ...w, ...patch } : w)));

  const preset = (days) => update(Object.fromEntries(DAYS.map((d) => [d, days.includes(d) ? [{ ...DEFAULT_WINDOW }] : []])));

  const save = async () => {
    if (Object.keys(problems).length) return setMessage({ tone: 'error', text: 'Fix the highlighted days first.' });
    setSaving(true);
    setMessage({ tone: 'error', text: '' });
    try {
      const saved = await proApi.saveAvailability(toRules(week));
      setMessage({ tone: 'success', text: 'Weekly availability saved.' });
      onSaved(saved);
    } catch (err) {
      setMessage({ tone: 'error', text: apiErrorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4 rounded-card bg-white p-5 shadow-card">
      <div>
        <h2 className="text-lg font-semibold">Weekly hours</h2>
        <p className="text-sm text-ink-600">Customers can book you inside these hours (Philippine time).</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" className="!min-h-9 !py-1.5" onClick={() => preset([1, 2, 3, 4, 5])}>
          Mon–Fri, 9 AM–6 PM
        </Button>
        <Button variant="secondary" className="!min-h-9 !py-1.5" onClick={() => preset(DAYS)}>
          Every day, 9 AM–6 PM
        </Button>
        <Button variant="ghost" className="!min-h-9 !py-1.5" onClick={() => preset([])}>
          Clear all
        </Button>
      </div>

      <ul className="divide-y divide-ink-100">
        {DAYS.map((d) => {
          const windows = week[d];
          const on = windows.length > 0;
          return (
            <li key={d} className="py-3">
              <div className="flex items-center justify-between gap-3">
                <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink-800">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => setDay(d, e.target.checked ? [{ ...DEFAULT_WINDOW }] : [])}
                    className="size-5 accent-brand-500"
                  />
                  {DAY_LABELS[d]}
                </label>
                {on ? (
                  <Button variant="ghost" className="!min-h-9 !py-1" onClick={() => setDay(d, [...windows, { startMin: Math.min(windows.at(-1).endMin, 1380), endMin: 1440 }])}>
                    + Add window
                  </Button>
                ) : (
                  <span className="text-sm text-ink-400">Day off</span>
                )}
              </div>
              {windows.map((w, i) => (
                <div key={i} className="mt-2 flex flex-wrap items-center gap-2 pl-8">
                  <select aria-label={`${DAY_LABELS[d]} window ${i + 1} start`} value={w.startMin} onChange={(e) => setWindow(d, i, { startMin: Number(e.target.value) })} className={selectClass}>
                    {START_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-ink-500">to</span>
                  <select aria-label={`${DAY_LABELS[d]} window ${i + 1} end`} value={w.endMin} onChange={(e) => setWindow(d, i, { endMin: Number(e.target.value) })} className={selectClass}>
                    {END_OPTIONS.map((m) => (
                      <option key={m} value={m}>
                        {formatMinutes(m)}
                      </option>
                    ))}
                  </select>
                  {windows.length > 1 && (
                    <button type="button" onClick={() => setDay(d, windows.filter((_, idx) => idx !== i))} className="min-h-11 px-2 text-sm text-danger hover:underline" aria-label={`Remove ${DAY_LABELS[d]} window ${i + 1}`}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
              {problems[d] && (
                <p role="alert" className="mt-1 pl-8 text-sm text-danger">
                  {problems[d]}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <Alert tone={message.tone}>{message.text}</Alert>
      <Button onClick={save} loading={saving}>
        Save weekly hours
      </Button>
    </section>
  );
}

function BlockedDates() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.listBlockedDates(), []);
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [formError, setFormError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!date) return setDateError('Choose a date');
    setDateError('');
    setAdding(true);
    try {
      const created = await proApi.addBlockedDate({ date, reason: reason.trim() });
      setData((rows) => [...rows, created].sort((a, b) => a.date.localeCompare(b.date)));
      setDate('');
      setReason('');
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const remove = async (item) => {
    setRemovingId(item.id);
    setFormError('');
    try {
      await proApi.removeBlockedDate(item.id);
      setData((rows) => rows.filter((r) => r.id !== item.id));
    } catch (err) {
      setFormError(apiErrorMessage(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="space-y-4 rounded-card bg-white p-5 shadow-card">
      <div>
        <h2 className="text-lg font-semibold">Blocked dates</h2>
        <p className="text-sm text-ink-600">Days off, holidays or trips. Customers cannot book you on these dates.</p>
      </div>

      <form onSubmit={add} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <TextField label="Date" name="blockDate" type="date" min={todayManila()} value={date} onChange={(e) => setDate(e.target.value)} error={dateError} />
        <TextField label="Reason (optional)" name="blockReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder="e.g. Family event" />
        <Button type="submit" loading={adding}>
          Block date
        </Button>
      </form>

      <Alert tone="error">{formError}</Alert>

      {loading ? (
        <Spinner label="Loading blocked dates..." />
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <p className="text-sm text-ink-500">No blocked dates.</p>
      ) : (
        <ul className="divide-y divide-ink-100">
          {data.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink-800">{formatDate(`${b.date}T00:00:00+08:00`)}</p>
                {b.reason && <p className="text-xs text-ink-500">{b.reason}</p>}
              </div>
              <ConfirmButton className="!min-h-9 !py-1.5" loading={removingId === b.id} onConfirm={() => remove(b)} confirmLabel="Tap again to unblock">
                Unblock
              </ConfirmButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function ProAvailability() {
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getAvailability(), []);

  if (loading) return <Spinner label="Loading your availability..." />;
  if (error) return <ErrorState message={error} onRetry={reload} />;

  return (
    <div className="space-y-5">
      <h1 className="text-3xl font-bold">Availability</h1>
      <WeeklyEditor initialRules={data} onSaved={(rules) => setData(rules)} />
      <BlockedDates />
    </div>
  );
}
