const TONES = {
  success: 'bg-success/10 text-success',
  error: 'bg-danger/10 text-danger',
  info: 'bg-info/10 text-info',
  warning: 'bg-warning/10 text-warning',
};

// role="alert" for errors (announced at once), role="status" for the rest.
export default function Alert({ tone = 'info', children, className = '' }) {
  if (!children) return null;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-control px-3.5 py-2.5 text-sm ${TONES[tone]} ${className}`}>
      {children}
    </div>
  );
}
