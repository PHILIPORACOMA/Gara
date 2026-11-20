import { useEffect, useState } from 'react';
import Button from './Button.jsx';

// Two-step button for destructive actions: the first tap asks "Sure?", the second one acts.
// It resets after 4 seconds. (Avoids window.confirm, which is jarring on phones.)
export default function ConfirmButton({ children, confirmLabel = 'Tap again to confirm', onConfirm, loading, ...props }) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      {...props}
      loading={loading}
      variant={armed ? 'danger' : (props.variant ?? 'secondary')}
      onClick={() => {
        if (!armed) setArmed(true);
        else {
          setArmed(false);
          onConfirm();
        }
      }}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
