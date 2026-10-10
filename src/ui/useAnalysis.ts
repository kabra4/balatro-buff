import { useEffect, useRef, useState } from 'preact/hooks';
import { EngineClient } from '../engine/client';
import type { Analysis, Settings } from '../engine/types';
import type { EngineStatus } from './SettingsBar';

export const ANALYZE_DEBOUNCE_MS = 300;

export interface AnalysisState {
  analysis: Analysis | null;
  status: EngineStatus;
  error: string | null;
}

/** Live analysis: every settings change re-runs the worker after a debounce; stale results are dropped. */
export function useAnalysis(settings: Settings): AnalysisState {
  const client = useRef<EngineClient | null>(null);
  const latest = useRef(0);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const c = new EngineClient({ onReady: () => setEngineReady(true), onFatal: setError });
    client.current = c;
    return () => c.dispose();
  }, []);

  const key = JSON.stringify(settings);
  useEffect(() => {
    if (!settings.seed) {
      latest.current++;
      setBusy(false);
      return undefined;
    }
    setBusy(true);
    const timer = window.setTimeout(() => {
      const id = ++latest.current;
      client.current?.analyze(settings).then(
        (result) => {
          if (id !== latest.current) return;
          setAnalysis(result);
          setError(null);
          setBusy(false);
        },
        (err: Error) => {
          if (id !== latest.current) return;
          setError(err.message);
          setBusy(false);
        },
      );
    }, ANALYZE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [key]);

  return { analysis, status: statusOf(engineReady, busy, error), error };
}

function statusOf(engineReady: boolean, busy: boolean, error: string | null): EngineStatus {
  if (error) return 'error';
  if (!engineReady) return 'loading';
  return busy ? 'analyzing' : 'ready';
}
