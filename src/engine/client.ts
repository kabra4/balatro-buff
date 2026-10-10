/** Main-thread handle to the engine worker: promise-per-request over postMessage. */
import type { AnalyzeRequest, WorkerResponse } from './protocol';
import type { Analysis, Settings } from './types';

interface Pending {
  resolve: (analysis: Analysis) => void;
  reject: (err: Error) => void;
}

export interface EngineClientEvents {
  onReady?: () => void;
  onFatal?: (message: string) => void;
}

export class EngineClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor(private readonly events: EngineClientEvents = {}) {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module', name: 'engine' });
    this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => this.handle(e.data);
    this.worker.onerror = (e) => this.fail(e.message || 'Engine worker crashed');
  }

  analyze(settings: Settings): Promise<Analysis> {
    const id = this.nextId++;
    const request: AnalyzeRequest = { id, settings };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(request);
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.fail('Engine disposed');
  }

  private handle(msg: WorkerResponse): void {
    if (msg.type === 'ready') {
      this.events.onReady?.();
      return;
    }
    if (msg.type === 'result') {
      this.settle(msg.id)?.resolve(msg.analysis);
    } else if (msg.id === null) {
      this.fail(msg.message);
    } else {
      this.settle(msg.id)?.reject(new Error(msg.message));
    }
  }

  private settle(id: number): Pending | undefined {
    const pending = this.pending.get(id);
    this.pending.delete(id);
    return pending;
  }

  private fail(message: string): void {
    this.events.onFatal?.(message);
    for (const p of this.pending.values()) p.reject(new Error(message));
    this.pending.clear();
  }
}
