// Multi-select shown as toggle chips (categories, areas). `options` is [{ value, label }].
export default function ChipSelect({ label, options, value, onChange, error }) {
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset>
      <legend className="text-sm font-medium text-ink-700">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value.includes(opt.value);
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(opt.value)}
              className={`min-h-10 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                on ? 'border-brand-500 bg-brand-500 text-white' : 'border-ink-200 bg-white text-ink-700 hover:bg-ink-50'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
