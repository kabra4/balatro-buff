/** Main-thread handle to the engine worker: latest-wins requests over postMessage. */
import type { AnalyzeRequest, WorkerResponse } from './protocol';
import type { Analysis, Settings } from './types';

/** Rejection reason for a request replaced by a newer one (or dropped by dispose). Not an error to show. */
export class SupersededError extends Error {
  constructor() {
    super('Superseded by a newer analysis request');
    this.name = 'SupersededError';
  }
}

/** The subset of Worker the client uses (injectable for tests). */
export interface WorkerLike {
  onmessage: ((event: MessageEvent<WorkerResponse>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: AnalyzeRequest): void;
  terminate(): void;
}

export interface EngineClientEvents {
  onReady?: () => void;
  /** Engine load failure or worker crash. Pending requests are rejected; the next request retries. */
  onError?: (message: string) => void;
}

interface Pending {
  resolve: (analysis: Analysis) => void;
  reject: (err: Error) => void;
}

export class EngineClient {
  private worker: WorkerLike | null = null;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;
  private disposed = false;

  constructor(
    private readonly events: EngineClientEvents = {},
    private readonly createWorker: () => WorkerLike = createEngineWorker,
  ) {
    this.ensureWorker();
  }

  /** Starts an analysis; any older in-flight request is rejected with SupersededError. */
  analyze(settings: Settings): Promise<Analysis> {
    if (this.disposed) return Promise.reject(new SupersededError());
    this.rejectAll(() => new SupersededError());
    const worker = this.ensureWorker();
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ id, settings });
    });
  }

  /** Stops the worker. Pending requests are dropped as superseded; no error is reported. */
  dispose(): void {
    this.disposed = true;
    this.worker?.terminate();
    this.worker = null;
    this.rejectAll(() => new SupersededError());
  }

  private ensureWorker(): WorkerLike {
    if (this.worker) return this.worker;
    const worker = this.createWorker();
    worker.onmessage = (e) => this.handle(e.data);
    worker.onerror = (e) => this.crash(worker, e.message || 'Engine worker crashed');
    this.worker = worker;
    return worker;
  }

  private handle(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'ready':
        this.events.onReady?.();
        return;
      case 'result':
        this.settle(msg.id)?.resolve(msg.analysis);
        return;
      case 'skipped':
        this.settle(msg.id)?.reject(new SupersededError());
        return;
      case 'error':
        if (msg.id === null) this.events.onError?.(msg.message);
        else this.settle(msg.id)?.reject(new Error(msg.message));
    }
  }

  /** A crashed worker is discarded; the next analyze() starts a fresh one. */
  private crash(worker: WorkerLike, message: string): void {
    if (this.worker !== worker) return;
    worker.terminate();
    this.worker = null;
    this.rejectAll(() => new Error(message));
    this.events.onError?.(message);
  }

  private settle(id: number): Pending | undefined {
    const pending = this.pending.get(id);
    this.pending.delete(id);
    return pending;
  }

  private rejectAll(reason: () => Error): void {
    const all = [...this.pending.values()];
    this.pending.clear();
    for (const p of all) p.reject(reason());
  }
}

function createEngineWorker(): WorkerLike {
  return new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'engine' }) as WorkerLike;
}
