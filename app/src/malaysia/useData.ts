import { useEffect, useState, useCallback } from 'react';
import type { Envelope } from './domain';
export function useData<T>(endpoint: string, interval = 300_000) {
  const [state, setState] = useState<{
    key: string;
    result: Envelope<T> | null;
    error: string | null;
    loading: boolean;
  }>({ key: '', result: null, error: null, loading: false });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    let busy = false;
    async function load() {
      if (busy) return;
      busy = true;
      setState((previous) => ({
        key: endpoint,
        result: previous.key === endpoint ? previous.result : null,
        error: null,
        loading: true,
      }));
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        const json: Envelope<T> & { error?: string } = await response.json().catch(() => {
          throw new Error(
            `Data service returned an incomplete response (HTTP ${response.status}). Retry the source.`,
          );
        });
        if (!response.ok)
          throw new Error(
            json.error ?? 'Data source unavailable. Retry or use the official source.',
          );
        if (!controller.signal.aborted) {
          setState({ key: endpoint, result: json, error: null, loading: false });
        }
      } catch (e) {
        if (!controller.signal.aborted)
          setState((previous) => ({
            key: endpoint,
            result:
              previous.key === endpoint && previous.result
                ? { ...previous.result, stale: true }
                : null,
            error: e instanceof Error ? e.message : 'Unable to load data',
            loading: false,
          }));
      } finally {
        busy = false;
      }
    }
    void load();
    const timer = setInterval(() => {
      if (!document.hidden) void load();
    }, interval);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [endpoint, interval, revision]);
  return {
    result: state.key === endpoint ? state.result : null,
    error: state.key === endpoint ? state.error : null,
    loading: !!endpoint && (state.key !== endpoint || state.loading),
    refresh,
  };
}
