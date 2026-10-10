/// <reference lib="webworker" />
/** Seed-search worker: runs the fast-path checker on random seeds until paused. */
import { loadEngine } from '../engine/loader';
import { createChecker } from './check';
import type { FinderWorkerRequest } from './protocol';
import { createSearchLoop } from './searchLoop';
import { randomFinderSeed } from './seeds';

const scope = self as unknown as DedicatedWorkerGlobalScope;
const baseUrl = new URL(import.meta.env.BASE_URL, scope.location.origin).href;
const channel = new MessageChannel();
const yields: (() => void)[] = [];
channel.port1.onmessage = () => yields.shift()?.();

const loop = createSearchLoop({
  load: () => loadEngine(baseUrl),
  createChecker,
  post: (message) => scope.postMessage(message),
  randomSeed: () => randomFinderSeed(),
  now: () => performance.now(),
  // A MessageChannel round-trip yields to the event loop without setTimeout's clamping.
  yieldNow: () =>
    new Promise<void>((resolve) => {
      yields.push(resolve);
      channel.port2.postMessage(null);
    }),
});

scope.onmessage = (event: MessageEvent<FinderWorkerRequest>) => loop.handle(event.data);
