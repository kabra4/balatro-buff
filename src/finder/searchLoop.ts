/**
 * Worker-side search loop, kept free of worker globals so it can be unit-tested.
 * Checks random seeds in short batches, yielding between batches so pause/resume get through.
 */
import type { ImmolateModule } from '../engine/loader';
import type { FinderWorkerRequest, FinderWorkerResponse } from './protocol';
import type { FinderQuery } from './types';

export const BATCH_SEEDS = 500;
/** A batch also ends after this long, so pausing stays responsive on expensive queries. */
export const BATCH_MAX_MS = 100;
export const PROGRESS_INTERVAL_MS = 250;

export interface SeedChecker {
  check(seed: string): boolean;
}

export interface SearchLoopDeps {
  /** Memoized engine load that forgets failures (each start after a failure retries). */
  load: () => Promise<ImmolateModule>;
  createChecker: (engine: ImmolateModule, query: FinderQuery) => SeedChecker;
  post: (message: FinderWorkerResponse) => void;
  randomSeed: () => string;
  now: () => number;
  /** Lets queued messages (pause/resume) run between batches. */
  yieldNow: () => Promise<void>;
}

export interface SearchLoop {
  handle(message: FinderWorkerRequest): void;
}

export function createSearchLoop(deps: SearchLoopDeps): SearchLoop {
  let checker: SeedChecker | null = null;
  let wantRunning = false;
  let looping = false;
  let generation = 0;
  let unreported = 0;
  let lastProgress = deps.now();
  let ready = false;

  const flushProgress = () => {
    if (unreported > 0) deps.post({ type: 'progress', checked: unreported });
    unreported = 0;
    lastProgress = deps.now();
  };

  const fail = (err: unknown) => {
    wantRunning = false;
    checker = null;
    deps.post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  };

  /**
   * At most one loop runs per worker. It always uses the current checker, so a new `start` while
   * a loop is still parked in yieldNow() is picked up by that loop instead of being dropped.
   */
  const loop = async () => {
    if (looping) return;
    looping = true;
    try {
      while (wantRunning && checker) {
        const hit = runBatch(checker);
        if (hit !== null) {
          wantRunning = false;
          flushProgress();
          deps.post({ type: 'hit', seed: hit });
          break;
        }
        if (deps.now() - lastProgress >= PROGRESS_INTERVAL_MS) flushProgress();
        await deps.yieldNow();
      }
    } catch (err) {
      fail(err);
    } finally {
      looping = false;
    }
  };

  const runBatch = (c: SeedChecker): string | null => {
    const start = deps.now();
    for (let n = 0; n < BATCH_SEEDS; n++) {
      const seed = deps.randomSeed();
      unreported++;
      if (c.check(seed)) return seed;
      if ((n & 31) === 31 && deps.now() - start >= BATCH_MAX_MS) break;
    }
    return null;
  };

  const start = async (query: FinderQuery) => {
    const gen = ++generation;
    checker = null;
    wantRunning = true;
    unreported = 0;
    try {
      const engine = await deps.load();
      if (!ready) {
        ready = true;
        deps.post({ type: 'ready' });
      }
      if (gen !== generation) return;
      checker = deps.createChecker(engine, query);
    } catch (err) {
      if (gen === generation) fail(err);
      return;
    }
    lastProgress = deps.now();
    void loop();
  };

  return {
    handle: (message) => {
      switch (message.type) {
        case 'start':
          void start(message.query);
          return;
        case 'pause':
          wantRunning = false;
          flushProgress();
          return;
        case 'resume':
          wantRunning = true;
          lastProgress = deps.now();
          void loop();
      }
    },
  };
}
