/** Worker-side request handling, kept free of worker globals so it can be unit-tested. */
import type { ImmolateModule } from './loader';
import type { AnalyzeRequest, WorkerResponse } from './protocol';
import type { Analysis, Settings } from './types';

export interface WorkerHandlerDeps {
  /** Memoized engine load that forgets failures, so each call after a failure retries. */
  load: () => Promise<ImmolateModule>;
  run: (engine: ImmolateModule, settings: Settings) => Analysis;
  post: (message: WorkerResponse) => void;
  /** Lets already-queued messages arrive before we commit to analyzing (default: a macrotask). */
  yieldToQueue?: () => Promise<void>;
}

export interface WorkerHandler {
  /** Warm the engine up front; a failure is reported but retried on the next request. */
  preload: () => Promise<void>;
  handle: (request: AnalyzeRequest) => Promise<void>;
}

export function createWorkerHandler(deps: WorkerHandlerDeps): WorkerHandler {
  const yieldToQueue = deps.yieldToQueue ?? (() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
  let latestId = 0;
  let ready = false;

  const loadEngine = async (): Promise<ImmolateModule> => {
    const engine = await deps.load();
    if (!ready) {
      ready = true;
      deps.post({ type: 'ready' });
    }
    return engine;
  };

  return {
    preload: () =>
      loadEngine().then(
        () => undefined,
        (err: unknown) => deps.post({ type: 'error', id: null, message: errorMessage(err) }),
      ),
    handle: async ({ id, settings }) => {
      latestId = Math.max(latestId, id);
      await yieldToQueue();
      if (id !== latestId) return deps.post({ type: 'skipped', id });
      let engine: ImmolateModule;
      try {
        engine = await loadEngine();
      } catch (err) {
        return deps.post({ type: 'error', id, message: errorMessage(err) });
      }
      if (id !== latestId) return deps.post({ type: 'skipped', id });
      try {
        deps.post({ type: 'result', id, analysis: deps.run(engine, settings) });
      } catch (err) {
        deps.post({ type: 'error', id, message: errorMessage(err) });
      }
    },
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
