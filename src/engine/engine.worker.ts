/// <reference lib="webworker" />
/** Runs the wasm engine off the main thread. */
import { analyze } from './analyze';
import { loadEngine } from './loader';
import type { AnalyzeRequest } from './protocol';
import { createWorkerHandler } from './workerHandler';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const baseUrl = new URL(import.meta.env.BASE_URL, scope.location.origin).href;

const handler = createWorkerHandler({
  load: () => loadEngine(baseUrl),
  run: analyze,
  post: (message) => scope.postMessage(message),
});

void handler.preload();
scope.onmessage = (event: MessageEvent<AnalyzeRequest>) => void handler.handle(event.data);
