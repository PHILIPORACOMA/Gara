import { useCallback, useEffect, useRef, useState } from 'react';
import { apiErrorMessage } from '../api/http.js';

// Runs an async loader on mount (and whenever `deps` change) and tracks loading/error state.
//   const { data, loading, error, reload, setData } = useAsync(() => api.getThing(id), [id]);
// A stale response (older request finishing late) never overwrites a newer one.
// `deps` must be plain values (ids, strings, numbers): they are compared by value.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const requestId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader; // always call the latest loader (it closes over the latest state)
  const depsKey = JSON.stringify(deps);

  const run = useCallback(async () => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await loaderRef.current();
      if (id === requestId.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (id === requestId.current) setState({ data: null, loading: false, error: apiErrorMessage(err) });
    }
    // depsKey is deliberate: a new run() (and so a new load) whenever the caller's deps change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  useEffect(() => {
    run();
    return () => {
      requestId.current += 1;
    };
  }, [run]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}
