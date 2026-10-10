/// <reference lib="webworker" />
/** Runs the wasm engine off the main thread. Loads it once, then answers analyze requests. */
import { analyze } from './analyze';
import { loadEngine } from './loader';
import type { AnalyzeRequest, WorkerResponse } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const engineReady = loadEngine(new URL(import.meta.env.BASE_URL, scope.location.origin).href);

engineReady.then(
  () => post({ type: 'ready' }),
  (err: unknown) => post({ type: 'error', id: null, message: errorMessage(err) }),
);

scope.onmessage = async (event: MessageEvent<AnalyzeRequest>) => {
  const { id, settings } = event.data;
  try {
    const engine = await engineReady;
    post({ type: 'result', id, analysis: analyze(engine, settings) });
  } catch (err) {
    post({ type: 'error', id, message: errorMessage(err) });
  }
};

function post(message: WorkerResponse): void {
  scope.postMessage(message);
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
