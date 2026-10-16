/**
 * Main-thread search orchestration (framework-free; workers and verification are injected).
 * First hit → pause every worker, verify with full analysis, report. "Find next" serves hits
 * that arrived meanwhile before resuming the workers.
 */
import type { Occurrence } from './match';
import type { FinderWorkerRequest, FinderWorkerResponse } from './protocol';
import type { FinderQuery } from './types';

/** Rolling window for the seeds/s figure. */
export const RATE_WINDOW_MS = 3000;
/** Crashed workers are replaced this many times per search before giving up. */
export const MAX_WORKER_RESTARTS = 3;

export interface FinderWorkerLike {
  onmessage: ((event: MessageEvent<FinderWorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: FinderWorkerRequest): void;
  terminate(): void;
}

export type Verifier = (query: FinderQuery, seed: string) => Promise<Map<string, Occurrence> | null>;

export interface VerifiedHit {
  /** Unique per controller (across searches). */
  id: number;
  seed: string;
  query: FinderQuery;
  /** Slot id → the occurrence (from full analysis) that satisfies it. */
  matches: Map<string, Occurrence>;
}

/** idle → running → verifying → paused (found) → running … ; stop() → idle. */
export type SearchStatus = 'idle' | 'running' | 'verifying' | 'paused' | 'error';

export interface SearchSnapshot {
  status: SearchStatus;
  checked: number;
  seedsPerSecond: number;
  elapsedMs: number;
  found: number;
  workers: number;
  /** Fast-path hits that full analysis rejected: tag-pack skips that don't work together (else should stay 0). */
  rejected: number;
  error: string | null;
}

export interface SearchControllerDeps {
  createWorker: () => FinderWorkerLike;
  workerCount: number;
  verify: Verifier;
  now?: () => number;
  /** Called after every state change (status, stats, errors). */
  onChange?: () => void;
  onFound?: (hit: VerifiedHit) => void;
}

interface Sample {
  at: number;
  checked: number;
}

export class SearchController {
  private workers: FinderWorkerLike[] = [];
  private query: FinderQuery | null = null;
  private status: SearchStatus = 'idle';
  private error: string | null = null;
  private run = 0;
  private queue: string[] = [];
  private seen = new Set<string>();
  private checked = 0;
  private found = 0;
  private rejected = 0;
  private restarts = 0;
  private hitIds = 0;
  private elapsedBefore = 0;
  private runningSince: number | null = null;
  private samples: Sample[] = [];
  private readonly now: () => number;

  constructor(private readonly deps: SearchControllerDeps) {
    this.now = deps.now ?? (() => performance.now());
  }

  /** Starts a fresh search (any current one is stopped and its stats reset). */
  start(query: FinderQuery): void {
    this.reset();
    this.query = query;
    for (let i = 0; i < Math.max(1, this.deps.workerCount); i++) this.workers.push(this.spawn());
    this.setRunning();
    this.changed();
  }

  /** Next match: a hit found meanwhile if there is one, else resume the workers. */
  findNext(): void {
    if (this.status !== 'paused') return;
    if (!this.verifyQueued()) this.resume();
    this.changed();
  }

  /** Terminates the workers; stats stay visible until the next start(). */
  stop(): void {
    this.run++;
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.queue = [];
    this.pauseClock();
    if (this.status !== 'error') this.status = 'idle';
    this.changed();
  }

  /** Stop and clear stats (e.g. the query changed). */
  reset(): void {
    this.stop();
    this.query = null;
    this.status = 'idle';
    this.error = null;
    this.seen.clear();
    this.checked = 0;
    this.found = 0;
    this.rejected = 0;
    this.restarts = 0;
    this.elapsedBefore = 0;
    this.samples = [];
    this.changed();
  }

  snapshot(): SearchSnapshot {
    const now = this.now();
    return {
      status: this.status,
      checked: this.checked,
      seedsPerSecond: this.status === 'running' ? this.rate(now) : 0,
      elapsedMs: this.elapsedBefore + (this.runningSince === null ? 0 : now - this.runningSince),
      found: this.found,
      workers: this.workers.length,
      rejected: this.rejected,
      error: this.error,
    };
  }

  private spawn(): FinderWorkerLike {
    const run = this.run;
    const worker = this.deps.createWorker();
    worker.onmessage = (e) => {
      if (run === this.run) this.handle(worker, e.data);
    };
    worker.onerror = (e) => {
      if (run === this.run) this.crash(worker, e.message || 'Search worker crashed');
    };
    if (this.query) worker.postMessage({ type: 'start', query: this.query });
    return worker;
  }

  private handle(worker: FinderWorkerLike, msg: FinderWorkerResponse): void {
    switch (msg.type) {
      case 'ready':
        return;
      case 'progress':
        this.checked += msg.checked;
        if (this.status === 'running') this.samples.push({ at: this.now(), checked: this.checked });
        this.changed();
        return;
      case 'hit':
        this.hit(worker, msg.seed);
        return;
      case 'error':
        this.fail(msg.message);
    }
  }

  private hit(worker: FinderWorkerLike, seed: string): void {
    if (this.seen.has(seed)) {
      // The worker paused itself for a duplicate; let it continue if the search is running.
      if (this.status === 'running') worker.postMessage({ type: 'resume' });
      return;
    }
    this.seen.add(seed);
    this.queue.push(seed);
    if (this.status === 'running') {
      this.pauseAll();
      this.verifyQueued();
    }
    this.changed();
  }

  /** Verifies the next queued hit; false when the queue is empty. */
  private verifyQueued(): boolean {
    const seed = this.queue.shift();
    const query = this.query;
    if (seed === undefined || !query) return false;
    const run = this.run;
    this.status = 'verifying';
    this.deps.verify(query, seed).then(
      (matches) => {
        if (run === this.run) this.verified(query, seed, matches);
      },
      (err: unknown) => {
        // A thrown verification (engine failure) is not a "no": stop instead of resuming blindly.
        if (run === this.run) this.fail(`Verification failed for ${seed}: ${err instanceof Error ? err.message : String(err)}`);
      },
    );
    return true;
  }

  private verified(query: FinderQuery, seed: string, matches: Map<string, Occurrence> | null): void {
    if (matches) {
      this.found++;
      this.status = 'paused';
      this.deps.onFound?.({ id: ++this.hitIds, seed, query, matches });
    } else {
      this.rejected++;
      if (!this.verifyQueued()) this.resume();
    }
    this.changed();
  }

  private pauseAll(): void {
    for (const w of this.workers) w.postMessage({ type: 'pause' });
    this.pauseClock();
  }

  private resume(): void {
    for (const w of this.workers) w.postMessage({ type: 'resume' });
    this.setRunning();
  }

  private crash(worker: FinderWorkerLike, message: string): void {
    worker.terminate();
    const index = this.workers.indexOf(worker);
    if (index < 0) return;
    if (this.restarts >= MAX_WORKER_RESTARTS) {
      this.fail(`${message} (gave up after ${MAX_WORKER_RESTARTS} restarts)`);
      return;
    }
    this.restarts++;
    const replacement = this.spawn();
    if (this.status !== 'running') replacement.postMessage({ type: 'pause' });
    this.workers[index] = replacement;
    this.changed();
  }

  private fail(message: string): void {
    this.error = message;
    this.status = 'error';
    this.stop();
  }

  private setRunning(): void {
    this.status = 'running';
    this.runningSince ??= this.now();
  }

  private pauseClock(): void {
    if (this.runningSince !== null) this.elapsedBefore += this.now() - this.runningSince;
    this.runningSince = null;
    this.samples = [];
  }

  private rate(now: number): number {
    this.samples = this.samples.filter((s) => now - s.at <= RATE_WINDOW_MS);
    const first = this.samples[0];
    const last = this.samples[this.samples.length - 1];
    if (!first || !last || last.at <= first.at) return 0;
    return ((last.checked - first.checked) / (last.at - first.at)) * 1000;
  }

  private changed(): void {
    this.deps.onChange?.();
  }
}
