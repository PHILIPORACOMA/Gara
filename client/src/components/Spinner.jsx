export default function Spinner({ label = 'Loading...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-500" role="status" aria-live="polite">
      <span className="size-5 animate-spin rounded-full border-2 border-brand-200 border-t-brand-500" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
