import { useState } from 'react';
import { useAsync } from '../hooks/useAsync.js';
import * as proApi from '../api/pro.js';
import BookingCard from './BookingCard.jsx';
import ProBookingActions from './ProBookingActions.jsx';
import Button from './Button.jsx';
import Spinner from './Spinner.jsx';
import ErrorState from './ErrorState.jsx';
import { formatTime, toManilaIsoDate, todayManila } from '../lib/dates.js';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Pure calendar math (no time zones involved): 'YYYY-MM' -> grid cells.
function buildMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const firstWeekday = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = Array.from({ length: firstWeekday }, () => null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${month}-${String(d).padStart(2, '0')}`);
  return { title: `${MONTH_NAMES[m - 1]} ${y}`, cells };
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

const CHIP_TONE = {
  DEPOSIT_VERIFIED: 'bg-warning/20 text-warning',
  CONFIRMED: 'bg-brand-100 text-brand-800',
  COMPLETED: 'bg-success/15 text-success',
  NO_SHOW: 'bg-danger/10 text-danger',
};

export default function ProCalendar() {
  const [month, setMonth] = useState(todayManila().slice(0, 7));
  const [selectedDay, setSelectedDay] = useState(todayManila());
  const { data, loading, error, reload, setData } = useAsync(() => proApi.getCalendar(month), [month]);

  const { title, cells } = buildMonth(month);
  const byDay = {};
  (data?.bookings ?? []).forEach((b) => {
    (byDay[toManilaIsoDate(b.startAt)] ??= []).push(b);
  });
  const dayBookings = byDay[selectedDay] ?? [];

  const onChanged = (updated) => setData((d) => ({ ...d, bookings: d.bookings.map((b) => (b.id === updated.id ? updated : b)) }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Previous month">
          ‹
        </Button>
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <Button variant="secondary" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Next month">
          ›
        </Button>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="rounded-card bg-white p-2 shadow-card sm:p-3" aria-busy={loading}>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-ink-500">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`blank-${i}`} />;
              const items = byDay[iso] ?? [];
              const selected = iso === selectedDay;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelectedDay(iso)}
                  aria-label={`${iso}, ${items.length} booking${items.length === 1 ? '' : 's'}`}
                  aria-pressed={selected}
                  className={`flex min-h-16 flex-col items-stretch rounded-control border p-1 text-left text-xs transition-colors sm:min-h-20 ${
                    selected ? 'border-brand-500 bg-brand-50' : 'border-transparent hover:bg-ink-50'
                  } ${iso === todayManila() ? 'font-bold text-brand-700' : 'text-ink-700'}`}
                >
                  <span>{Number(iso.slice(8))}</span>
                  {items.slice(0, 2).map((b) => (
                    <span key={b.id} className={`mt-0.5 truncate rounded px-1 text-[10px] ${CHIP_TONE[b.status] ?? 'bg-ink-100'}`}>
                      {formatTime(b.startAt)}
                    </span>
                  ))}
                  {items.length > 2 && <span className="mt-0.5 text-[10px] text-ink-500">+{items.length - 2} more</span>}
                </button>
              );
            })}
          </div>
          {loading && <Spinner label="Loading..." />}
        </div>
      )}

      <section aria-live="polite">
        <h3 className="font-semibold text-ink-800">{selectedDay === todayManila() ? 'Today' : selectedDay}</h3>
        {dayBookings.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No bookings on this day.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {dayBookings.map((b) => (
              <BookingCard key={b.id} booking={b} viewer="PROFESSIONAL">
                <ProBookingActions booking={b} onChanged={onChanged} />
              </BookingCard>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
