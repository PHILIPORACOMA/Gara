import { formatPeso } from '../lib/money.js';

// subtotal + travel fee = total; then the deposit due now and the balance due on the day.
export default function PriceBreakdown({ pricing, mode }) {
  const row = 'flex items-baseline justify-between gap-4 py-1.5 text-sm';
  return (
    <dl className="rounded-control bg-ink-50 p-4">
      <div className={row}>
        <dt className="text-ink-600">Services</dt>
        <dd className="font-medium">{formatPeso(pricing.subtotal)}</dd>
      </div>
      {mode === 'HOME' && (
        <div className={row}>
          <dt className="text-ink-600">Home-service travel fee</dt>
          <dd className="font-medium">{formatPeso(pricing.travelFee)}</dd>
        </div>
      )}
      <div className={`${row} border-t border-ink-200 text-base`}>
        <dt className="font-semibold text-ink-900">Total</dt>
        <dd className="font-semibold text-ink-900">{formatPeso(pricing.total)}</dd>
      </div>
      <div className={`${row} mt-1 border-t border-dashed border-ink-200`}>
        <dt className="text-ink-700">
          Deposit now by GCash <span className="text-ink-500">({pricing.depositPct}%)</span>
        </dt>
        <dd className="font-semibold text-brand-700">{formatPeso(pricing.depositAmount)}</dd>
      </div>
      <div className={row}>
        <dt className="text-ink-700">Balance due on the day</dt>
        <dd className="font-medium">{formatPeso(pricing.balanceDue)}</dd>
      </div>
    </dl>
  );
}
