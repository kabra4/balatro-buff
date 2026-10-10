import { useEffect, useRef, useState } from 'preact/hooks';
import { EngineClient } from '../engine/client';
import type { Analysis, Settings } from '../engine/types';
import { LiveAnalysis } from './liveAnalysis';
import type { EngineStatus } from './SettingsBar';

export interface AnalysisState {
  analysis: Analysis | null;
  status: EngineStatus;
  error: string | null;
}

/** Live analysis: every settings change re-runs the worker after a debounce; stale results are dropped. */
export function useAnalysis(settings: Settings): AnalysisState {
  const live = useRef<LiveAnalysis | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = new EngineClient({
      onReady: () => {
        setEngineReady(true);
        setError(null);
      },
      onError: setError,
    });
    const runner = new LiveAnalysis((s) => client.analyze(s), {
      onBusy: setBusy,
      onResult: (result) => {
        setAnalysis(result);
        setError(null);
      },
      onError: setError,
    });
    live.current = runner;
    return () => {
      runner.dispose();
      client.dispose();
      live.current = null;
    };
  }, []);

  const key = JSON.stringify(settings);
  useEffect(() => {
    live.current?.update(settings);
  }, [key]);

  return { analysis, status: statusOf(engineReady, busy, error), error };
}

function statusOf(engineReady: boolean, busy: boolean, error: string | null): EngineStatus {
  if (error) return 'error';
  if (!engineReady) return 'loading';
  return busy ? 'analyzing' : 'ready';
}
