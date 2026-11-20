import { useEffect, useState } from 'react';

// Seconds left until `until` (ISO string), ticking every second. null when there is no deadline.
export function useCountdown(until) {
  const target = until ? new Date(until).getTime() : null;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (target == null) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);

  return target == null ? null : Math.max(0, Math.floor((target - now) / 1000));
}

export function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s).padStart(2, '0')}s`;
}
