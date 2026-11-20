export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-card border border-dashed border-ink-200 bg-white p-8 text-center">
      <p className="font-display text-lg text-ink-900">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
