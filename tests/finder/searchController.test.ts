import { describe, expect, it } from 'vitest';
import type { Occurrence } from '../../src/finder/match';
import type { FinderWorkerRequest, FinderWorkerResponse } from '../../src/finder/protocol';
import { MAX_WORKER_RESTARTS, SearchController, type FinderWorkerLike, type VerifiedHit } from '../../src/finder/searchController';
import type { FinderQuery } from '../../src/finder/types';
import { query, slot } from './queries';

const QUERY = query({}, [slot('tag', 'Charm Tag', 2)]);
const MATCH = new Map<string, Occurrence>([['x', { id: 1, kind: 'tag', name: 'Charm Tag', edition: null, ante: 1, where: 'shop', place: 'Small blind tag' }]]);

describe('SearchController', () => {
  it('starts every worker with the query', () => {
    const { controller, workers } = setup({ workerCount: 3 });
    controller.start(QUERY);
    expect(workers).toHaveLength(3);
    for (const w of workers) expect(w.sent).toEqual([{ type: 'start', query: QUERY }]);
    expect(controller.snapshot().status).toBe('running');
  });

  it('first hit pauses all workers, verifies, then reports found', async () => {
    const { controller, workers, found, verified } = setup({ workerCount: 2 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'AAAA1111' });

    expect(workers.every((w) => w.last()?.type === 'pause')).toBe(true);
    expect(controller.snapshot().status).toBe('verifying');
    await flush();
    expect(verified).toEqual(['AAAA1111']);
    expect(found.map((h) => h.seed)).toEqual(['AAAA1111']);
    expect(controller.snapshot()).toMatchObject({ status: 'paused', found: 1 });
  });

  it('findNext returns a queued simultaneous hit without resuming workers', async () => {
    const { controller, workers, found } = setup({ workerCount: 2 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'FIRST111' });
    workers[1]!.reply({ type: 'hit', seed: 'SECOND22' });
    await flush();
    expect(found.map((h) => h.seed)).toEqual(['FIRST111']);

    const sentBefore = workers.map((w) => w.sent.length);
    controller.findNext();
    await flush();
    expect(found.map((h) => h.seed)).toEqual(['FIRST111', 'SECOND22']);
    expect(workers.map((w) => w.sent.length)).toEqual(sentBefore);
    expect(controller.snapshot().status).toBe('paused');
  });

  it('findNext with no queued hits resumes all workers', async () => {
    const { controller, workers } = setup({ workerCount: 2 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'ONLY1111' });
    await flush();
    controller.findNext();
    expect(workers.every((w) => w.last()?.type === 'resume')).toBe(true);
    expect(controller.snapshot().status).toBe('running');
  });

  it('ignores duplicate seeds (and lets that worker continue)', async () => {
    const { controller, workers, found } = setup({ workerCount: 2 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'DUPE1111' });
    await flush();
    controller.findNext();
    workers[1]!.reply({ type: 'hit', seed: 'DUPE1111' });
    await flush();
    expect(found).toHaveLength(1);
    expect(workers[1]!.last()).toEqual({ type: 'resume' });
    expect(controller.snapshot().status).toBe('running');
  });

  it('a hit rejected by full verification is not reported and the search resumes', async () => {
    const { controller, workers, found } = setup({ workerCount: 1, verify: async () => null });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'FALSE111' });
    await flush();
    expect(found).toEqual([]);
    expect(controller.snapshot()).toMatchObject({ status: 'running', rejected: 1, found: 0 });
    expect(workers[0]!.last()).toEqual({ type: 'resume' });
  });

  it('a thrown verification stops the search with an error instead of resuming', async () => {
    const { controller, workers, found } = setup({ workerCount: 2, verify: async () => Promise.reject(new Error('engine aborted')) });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'BOOM1111' });
    await flush();
    expect(found).toEqual([]);
    expect(controller.snapshot()).toMatchObject({ status: 'error', workers: 0 });
    expect(controller.snapshot().error).toContain('engine aborted');
    expect(workers.every((w) => w.terminated && !w.sent.some((m) => m.type === 'resume'))).toBe(true);
  });

  it('found hits get unique ids across searches', async () => {
    const { controller, workers, found } = setup({ workerCount: 1 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'SAMESEED' });
    await flush();
    controller.start(QUERY);
    workers[1]!.reply({ type: 'hit', seed: 'SAMESEED' });
    await flush();
    expect(found.map((h) => h.id)).toEqual([1, 2]);
  });

  it('stop terminates the workers and drops late messages', async () => {
    const { controller, workers, found } = setup({ workerCount: 2 });
    controller.start(QUERY);
    controller.stop();
    expect(workers.every((w) => w.terminated)).toBe(true);
    workers[0]!.reply({ type: 'hit', seed: 'LATE1111' });
    await flush();
    expect(found).toEqual([]);
    expect(controller.snapshot()).toMatchObject({ status: 'idle', workers: 0 });
  });

  it('a new query (start while running) stops the old search and resets stats', async () => {
    const { controller, workers, found } = setup({ workerCount: 1 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'progress', checked: 500 });
    workers[0]!.reply({ type: 'hit', seed: 'OLDQUERY' });
    const other: FinderQuery = query({}, [slot('tag', 'Double Tag', 3)]);
    controller.start(other);
    await flush();

    expect(workers[0]!.terminated).toBe(true);
    expect(found).toEqual([]);
    expect(workers[1]!.sent).toEqual([{ type: 'start', query: other }]);
    expect(controller.snapshot()).toMatchObject({ checked: 0, found: 0, status: 'running' });
  });

  it('reset (query edited) stops and clears stats', () => {
    const { controller, workers } = setup({ workerCount: 1 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'progress', checked: 1234 });
    controller.reset();
    expect(workers[0]!.terminated).toBe(true);
    expect(controller.snapshot()).toMatchObject({ status: 'idle', checked: 0 });
  });

  it('counts progress, rolling seeds/s and elapsed running time', () => {
    let now = 0;
    const { controller, workers } = setup({ workerCount: 1, now: () => now });
    controller.start(QUERY);
    now = 1000;
    workers[0]!.reply({ type: 'progress', checked: 1000 });
    now = 2000;
    workers[0]!.reply({ type: 'progress', checked: 3000 });
    expect(controller.snapshot()).toMatchObject({ checked: 4000, seedsPerSecond: 3000, elapsedMs: 2000 });
  });

  it('replaces a crashed worker and keeps searching; gives up after repeated crashes', () => {
    const { controller, workers, changes } = setup({ workerCount: 1 });
    controller.start(QUERY);
    workers[0]!.crash('out of memory');
    expect(workers[0]!.terminated).toBe(true);
    expect(workers[1]!.sent).toEqual([{ type: 'start', query: QUERY }]);
    expect(controller.snapshot().status).toBe('running');

    for (let i = 1; i <= MAX_WORKER_RESTARTS; i++) workers[i]!.crash('out of memory');
    expect(controller.snapshot().status).toBe('error');
    expect(controller.snapshot().error).toContain('out of memory');
    expect(changes()).toBeGreaterThan(0);
  });

  it('a crash while paused spawns the replacement paused', async () => {
    const { controller, workers } = setup({ workerCount: 2 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'hit', seed: 'PAUSED11' });
    await flush();
    workers[1]!.crash('boom');
    expect(workers[2]!.sent).toEqual([{ type: 'start', query: QUERY }, { type: 'pause' }]);
  });

  it('an engine load error stops the search and is reported; the next start retries with fresh workers', () => {
    const { controller, workers } = setup({ workerCount: 1 });
    controller.start(QUERY);
    workers[0]!.reply({ type: 'error', message: 'wasm 404' });
    expect(controller.snapshot()).toMatchObject({ status: 'error', error: 'wasm 404' });
    expect(workers[0]!.terminated).toBe(true);

    controller.start(QUERY);
    expect(workers).toHaveLength(2);
    expect(controller.snapshot()).toMatchObject({ status: 'running', error: null });
  });
});

class FakeWorker implements FinderWorkerLike {
  onmessage: ((event: MessageEvent<FinderWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  sent: FinderWorkerRequest[] = [];
  terminated = false;

  postMessage(message: FinderWorkerRequest): void {
    this.sent.push(message);
  }

  terminate(): void {
    this.terminated = true;
  }

  last(): FinderWorkerRequest | undefined {
    return this.sent[this.sent.length - 1];
  }

  reply(data: FinderWorkerResponse): void {
    this.onmessage?.({ data } as MessageEvent<FinderWorkerResponse>);
  }

  crash(message: string): void {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function setup(opts: { workerCount: number; verify?: (q: FinderQuery, seed: string) => Promise<Map<string, Occurrence> | null>; now?: () => number }) {
  const workers: FakeWorker[] = [];
  const found: VerifiedHit[] = [];
  const verified: string[] = [];
  let changeCount = 0;
  const controller = new SearchController({
    workerCount: opts.workerCount,
    createWorker: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    verify:
      opts.verify ??
      (async (_q, seed) => {
        verified.push(seed);
        return MATCH;
      }),
    now: opts.now ?? (() => 0),
    onChange: () => changeCount++,
    onFound: (hit) => found.push(hit),
  });
  return { controller, workers, found, verified, changes: () => changeCount };
}

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}
