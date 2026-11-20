const inputClass = (error) =>
  `mt-1 block min-h-11 w-full rounded-control border bg-white px-3.5 py-2.5 text-base text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 sm:text-sm ${
    error ? 'border-danger focus:ring-danger/30' : 'border-ink-200 focus:border-brand-400 focus:ring-brand-200'
  }`;

function Wrapper({ id, label, error, hint, className, children }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-700">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-sm text-danger">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">
            {hint}
          </p>
        )
      )}
    </div>
  );
}

const describedBy = (id, error, hint) => (error ? `${id}-error` : hint ? `${id}-hint` : undefined);

// Text-like input with a label, hint and inline error. Pass any <input> prop through.
export function TextField({ label, error, hint, className = '', id, name, ...input }) {
  const fieldId = id ?? name;
  return (
    <Wrapper id={fieldId} label={label} error={error} hint={hint} className={className}>
      <input
        id={fieldId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={inputClass(error)}
        {...input}
      />
    </Wrapper>
  );
}

export function SelectField({ label, error, hint, className = '', id, name, children, ...select }) {
  const fieldId = id ?? name;
  return (
    <Wrapper id={fieldId} label={label} error={error} hint={hint} className={className}>
      <select
        id={fieldId}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={inputClass(error)}
        {...select}
      >
        {children}
      </select>
    </Wrapper>
  );
}

export function TextAreaField({ label, error, hint, className = '', id, name, ...area }) {
  const fieldId = id ?? name;
  return (
    <Wrapper id={fieldId} label={label} error={error} hint={hint} className={className}>
      <textarea
        id={fieldId}
        name={name}
        rows={4}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(fieldId, error, hint)}
        className={inputClass(error)}
        {...area}
      />
    </Wrapper>
  );
}
