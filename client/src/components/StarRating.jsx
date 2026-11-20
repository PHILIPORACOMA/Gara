import { useId } from 'react';

// Read-only star display. value is 0-5 (decimals allowed).
export default function StarRating({ value = 0, count, size = 'size-4' }) {
  const uid = useId();
  const rounded = Math.round(value * 10) / 10;
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={count === 0 ? 'No reviews yet' : `Rated ${rounded} out of 5${count != null ? ` from ${count} reviews` : ''}`}>
      <span className="flex" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => {
          const fill = Math.max(0, Math.min(1, value - (i - 1)));
          return (
            <svg key={i} viewBox="0 0 20 20" className={size}>
              <defs>
                <linearGradient id={`${uid}-${i}`}>
                  <stop offset={`${fill * 100}%`} stopColor="var(--color-accent-500)" />
                  <stop offset={`${fill * 100}%`} stopColor="var(--color-ink-200)" />
                </linearGradient>
              </defs>
              <path
                fill={`url(#${uid}-${i})`}
                d="M10 1.5l2.6 5.3 5.9.9-4.25 4.15 1 5.85L10 14.9l-5.25 2.8 1-5.85L1.5 7.7l5.9-.9z"
              />
            </svg>
          );
        })}
      </span>
      {count === 0 ? (
        <span className="text-xs text-ink-500">New</span>
      ) : (
        <span className="text-sm text-ink-600">
          <span className="font-semibold text-ink-800">{rounded.toFixed(1)}</span>
          {count != null && <span> ({count})</span>}
        </span>
      )}
    </span>
  );
}
