// Pill tabs with optional counts. tabs = [{ key, label, count? }]
export default function Tabs({ tabs, value, onChange, label }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
            value === t.key ? 'bg-brand-500 text-white' : 'bg-white text-ink-700 shadow-card hover:bg-ink-50'
          }`}
        >
          {t.label}
          {t.count != null && t.count > 0 && (
            <span className={`ml-1.5 rounded-full px-1.5 text-xs ${value === t.key ? 'bg-white/25' : 'bg-brand-100 text-brand-700'}`}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
