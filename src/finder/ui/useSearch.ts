import { useEffect, useRef, useState } from 'preact/hooks';
import { EngineClient } from '../../engine/client';
import { SearchController, type FinderWorkerLike, type SearchSnapshot, type VerifiedHit } from '../searchController';
import type { FinderQuery } from '../types';
import { createVerifier } from '../verify';

const MAX_WORKERS = 16;
/** Stats refresh while searching (elapsed time / rate move even without messages). */
const TICK_MS = 500;
const IDLE: SearchSnapshot = { status: 'idle', checked: 0, seedsPerSecond: 0, elapsedMs: 0, found: 0, workers: 0, rejected: 0, error: null };

export interface SearchApi {
  snapshot: SearchSnapshot;
  start: (query: FinderQuery) => void;
  findNext: () => void;
  stop: () => void;
  reset: () => void;
}

/** Owns the search workers and the verification engine for the page's lifetime. */
export function useSearch(onFound: (hit: VerifiedHit) => void): SearchApi {
  const controller = useRef<SearchController | null>(null);
  const found = useRef(onFound);
  found.current = onFound;
  const [snapshot, setSnapshot] = useState<SearchSnapshot>(IDLE);

  useEffect(() => {
    let frame = 0;
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => controller.current && setSnapshot(controller.current.snapshot()));
    };
    const verifier = new EngineClient();
    const search = new SearchController({
      createWorker: createFinderWorker,
      workerCount: workerCount(),
      verify: createVerifier((settings) => verifier.analyze(settings)),
      onChange: refresh,
      onFound: (hit) => found.current(hit),
    });
    controller.current = search;
    const tick = window.setInterval(() => {
      const status = search.snapshot().status;
      if (status === 'running' || status === 'verifying') refresh();
    }, TICK_MS);
    return () => {
      window.clearInterval(tick);
      cancelAnimationFrame(frame);
      search.stop();
      verifier.dispose();
      controller.current = null;
    };
  }, []);

  return {
    snapshot,
    start: (query) => controller.current?.start(query),
    findNext: () => controller.current?.findNext(),
    stop: () => controller.current?.stop(),
    reset: () => controller.current?.reset(),
  };
}

function workerCount(): number {
  return Math.min(MAX_WORKERS, Math.max(1, (navigator.hardwareConcurrency || 2) - 1));
}

function createFinderWorker(): FinderWorkerLike {
  return new Worker(new URL('../finder.worker.ts', import.meta.url), { type: 'module', name: 'finder' }) as FinderWorkerLike;
}
