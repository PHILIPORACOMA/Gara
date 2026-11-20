import { useEffect, useState } from 'react';
import { getMeta } from '../api/publicApi.js';

// Option lists (categories, areas, ...) never change while the app is open: fetch once.
let cached = null;
let inflight = null;

export function useMeta() {
  const [meta, setMeta] = useState(cached);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cached) return;
    inflight ??= getMeta().then((m) => (cached = m));
    inflight
      .then(setMeta)
      .catch(() => {
        inflight = null;
        setError(true);
      });
  }, []);

  return { meta, error };
}
