export default function VerifiedBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-0.5 text-xs font-semibold text-success ${className}`}>
      <svg viewBox="0 0 20 20" className="size-3.5" fill="currentColor" aria-hidden="true">
        <path fillRule="evenodd" d="M10 1.5l2.2 1.6 2.7-.1.9 2.6 2.2 1.6-.8 2.6.8 2.6-2.2 1.6-.9 2.6-2.7-.1L10 18.5l-2.2-1.6-2.7.1-.9-2.6-2.2-1.6.8-2.6-.8-2.6 2.2-1.6.9-2.6 2.7.1L10 1.5zm3.4 6.2a.75.75 0 00-1.1-1l-3.4 3.7-1.2-1.2a.75.75 0 10-1.1 1.1l1.8 1.7a.75.75 0 001.1 0l4-4.3z" clipRule="evenodd" />
      </svg>
      Verified
    </span>
  );
}
