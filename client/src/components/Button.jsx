const VARIANTS = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300',
  secondary: 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 disabled:text-ink-400',
  ghost: 'text-brand-600 hover:bg-brand-50 disabled:text-ink-400',
  danger: 'bg-danger text-white hover:opacity-90 disabled:opacity-50',
};

// min-h-11 keeps a comfortable 44px tap target on phones.
export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-5 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
      {...props}
    >
      {loading && <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
