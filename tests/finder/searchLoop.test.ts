import { afterEach, describe, expect, it } from 'vitest';
import { analyze } from '../../src/engine/analyze';
import type { ImmolateModule } from '../../src/engine/loader';
import { createChecker, fullCheck } from '../../src/finder/check';
import type { FinderWorkerResponse } from '../../src/finder/protocol';
import { createSearchLoop, type SearchLoop, type SeedChecker } from '../../src/finder/searchLoop';
import { randomFinderSeed } from '../../src/finder/seeds';
import { createVerifier } from '../../src/finder/verify';
import { loadTestEngine } from '../helpers/engine';
import { seededRandom } from '../helpers/random';
import { query, slot } from './queries';

const ENGINE = {} as ImmolateModule;
const QUERY = query({}, [slot('tag', 'Charm Tag', 1)]);
const loops: SearchLoop[] = [];

afterEach(() => {
  for (const loop of loops.splice(0)) loop.handle({ type: 'pause' });
});

describe('search loop (worker side)', () => {
  it('posts ready, checks seeds until a hit, posts progress then the hit, and pauses itself', async () => {
    const seeds = ['AAAAAAAA', 'BBBBBBBB', 'HIT11111', 'CCCCCCCC'];
    const { loop, posted, checked } = setup({ seeds, isHit: (s) => s === 'HIT11111' });
    loop.handle({ type: 'start', query: QUERY });
    await until(() => posted.some((m) => m.type === 'hit'));
    await settle();

    expect(posted).toEqual([{ type: 'ready' }, { type: 'progress', checked: 3 }, { type: 'hit', seed: 'HIT11111' }]);
    expect(checked).toEqual(['AAAAAAAA', 'BBBBBBBB', 'HIT11111']);
  });

  it('resume continues after a hit; pause stops looping', async () => {
    const seeds = ['HIT11111', 'X1', 'X2', 'HIT22222'];
    const { loop, posted } = setup({ seeds, isHit: (s) => s.startsWith('HIT') });
    loop.handle({ type: 'start', query: QUERY });
    await until(() => posted.filter((m) => m.type === 'hit').length === 1);
    loop.handle({ type: 'resume' });
    await until(() => posted.filter((m) => m.type === 'hit').length === 2);
    expect(posted.filter((m) => m.type === 'hit')).toEqual([
      { type: 'hit', seed: 'HIT11111' },
      { type: 'hit', seed: 'HIT22222' },
    ]);
  });

  it('a pause that arrives during the engine load keeps the worker paused', async () => {
    const { loop, checked } = setup({ seeds: ['A', 'B'], isHit: () => false });
    loop.handle({ type: 'start', query: QUERY });
    loop.handle({ type: 'pause' });
    await settle();
    expect(checked).toEqual([]);
  });

  it('reports an engine load failure and retries on the next start', async () => {
    const loads = [Promise.reject(new Error('wasm 404')), Promise.resolve(ENGINE)];
    const { loop, posted } = setup({ seeds: ['HIT11111'], isHit: () => true, load: () => loads.shift()! });
    loop.handle({ type: 'start', query: QUERY });
    await until(() => posted.length > 0);
    expect(posted).toEqual([{ type: 'error', message: 'wasm 404' }]);

    loop.handle({ type: 'start', query: QUERY });
    await until(() => posted.some((m) => m.type === 'hit'));
    expect(posted.map((m) => m.type)).toEqual(['error', 'ready', 'progress', 'hit']);
  });

  it('real engine: finds a seed for an easy query, and full analysis verifies it', async () => {
    const engine = await loadTestEngine();
    const easy = query({ cardsPerAnte: 15 }, [slot('soul', null, 2), slot('tag', 'Charm Tag', 3)]);
    const random = seededRandom(2024);
    const posted: FinderWorkerResponse[] = [];
    const loop = createSearchLoop({
      load: async () => engine,
      createChecker,
      post: (m) => posted.push(m),
      randomSeed: () => randomFinderSeed(random),
      now: () => performance.now(),
      yieldNow: () => new Promise((r) => setTimeout(r, 0)),
    });
    loop.handle({ type: 'start', query: easy });
    await until(() => posted.some((m) => m.type === 'hit' || m.type === 'error'), 20_000);

    const hit = posted.find((m) => m.type === 'hit');
    expect(hit?.type).toBe('hit');
    const seed = hit?.type === 'hit' ? hit.seed : '';
    const verify = createVerifier(async (s) => analyze(engine, s));
    const matches = await verify(easy, seed);
    expect(matches?.size).toBe(2);
    const soul = matches?.get(easy.slots[0]!.id);
    expect(soul?.kind).toBe('soul');
    expect(soul?.ante).toBeLessThanOrEqual(2);
    expect(fullCheck(engine, easy, seed).analysis.souls.length).toBeGreaterThan(0);
  });
});

function setup(opts: { seeds: string[]; isHit: (seed: string) => boolean; load?: () => Promise<ImmolateModule> }) {
  const posted: FinderWorkerResponse[] = [];
  const checked: string[] = [];
  const queue = [...opts.seeds];
  const checker: SeedChecker = {
    check: (seed) => {
      checked.push(seed);
      return opts.isHit(seed);
    },
  };
  const loop = createSearchLoop({
    load: opts.load ?? (async () => ENGINE),
    createChecker: () => checker,
    post: (m) => posted.push(m),
    // Out of scripted seeds → endless non-hits (the loop keeps going until paused).
    randomSeed: () => queue.shift() ?? 'ZZZZZZZZ',
    now: () => 0,
    yieldNow: () => new Promise((r) => setTimeout(r, 0)),
  });
  loops.push(loop);
  return { loop, posted, checked };
}

async function until(done: () => boolean, timeoutMs = 2000): Promise<void> {
  const start = Date.now();
  while (!done()) {
    if (Date.now() - start > timeoutMs) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 1));
  }
}

function settle(): Promise<void> {
  return new Promise((r) => setTimeout(r, 20));
}
