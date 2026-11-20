import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import Badge from './Badge.jsx';
import { BOOKING_MODE_LABELS, OCCASION_LABELS } from '../lib/labels.js';
import { formatPeso } from '../lib/money.js';
import { formatDate, formatTime } from '../lib/dates.js';

// One booking in a list. `viewer` decides who is shown as "the other person":
//   CUSTOMER -> the professional, PROFESSIONAL and ADMIN -> the customer.
// `to` makes the card a link (customer detail page). `children` holds action buttons.
export default function BookingCard({ booking: b, viewer, to, children }) {
  const who = viewer === 'CUSTOMER' ? b.professional.displayName : b.customer.name;
  const header = (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="font-semibold text-ink-900">{formatDate(b.startAt)}</p>
        <p className="text-sm text-ink-600">
          {formatTime(b.startAt)} – {formatTime(b.endAt)}
        </p>
      </div>
      <StatusBadge status={b.status} />
    </div>
  );

  return (
    <li className="rounded-card bg-white p-4 shadow-card">
      {to ? (
        <Link to={to} className="block focus-visible:outline-2 focus-visible:outline-brand-500">
          {header}
        </Link>
      ) : (
        header
      )}

      <p className="mt-3 text-sm">
        <span className="text-ink-500">{viewer === 'CUSTOMER' ? 'With ' : 'Customer: '}</span>
        <span className="font-medium text-ink-900">{who}</span>
        {viewer === 'ADMIN' && <span className="text-ink-500"> &middot; Pro: {b.professional.displayName}</span>}
      </p>
      <p className="mt-1 text-sm text-ink-700">{b.items.map((i) => i.name).join(', ')}</p>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-ink-500">
        <span>{BOOKING_MODE_LABELS[b.mode]}</span>
        {b.occasion && <Badge tone="brand">{OCCASION_LABELS[b.occasion]}</Badge>}
        {b.refundNeeded && !b.refundResolvedAt && <Badge tone="danger">Refund needed</Badge>}
        {b.refundNeeded && b.refundResolvedAt && <Badge tone="success">Refunded</Badge>}
        {b.depositPaidThenCancelled && <Badge tone="warning">Deposit to settle</Badge>}
      </div>
      {b.mode === 'HOME' && b.address && (
        <p className="mt-1 text-sm text-ink-600">
          {b.address}
          {b.area ? `, ${b.area}` : ''}
        </p>
      )}
      {b.customer.phone && viewer !== 'CUSTOMER' && <p className="mt-1 text-sm text-ink-600">Phone: {b.customer.phone}</p>}
      {b.notes && viewer !== 'CUSTOMER' && <p className="mt-1 text-sm italic text-ink-600">“{b.notes}”</p>}

      <div className="mt-3 flex items-baseline justify-between gap-3 border-t border-ink-100 pt-3 text-sm">
        <span className="text-ink-500">
          Total {formatPeso(b.pricing.total)} &middot; Deposit {formatPeso(b.pricing.depositAmount)}
        </span>
        {b.earning && (
          <span className="font-medium text-success" title="Your payout after Gara's commission">
            You earn {formatPeso(b.earning.proNet)}
          </span>
        )}
      </div>
      {children && <div className="mt-3 flex flex-wrap gap-2">{children}</div>}
    </li>
  );
}
