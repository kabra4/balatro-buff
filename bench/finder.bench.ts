/**
 * `npm run bench` — seeds checked per second on one thread: the fast path vs the full-analysis
 * reference (`analyze` through the query's horizon + matchSlots), plus raw `analyze` baselines.
 */
import { afterAll, describe, it } from 'vitest';
import { analyze } from '../src/engine/analyze';
import { createChecker, fullCheck } from '../src/finder/check';
import { randomFinderSeed } from '../src/finder/seeds';
import type { FinderQuery } from '../src/finder/types';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { query, slot } from '../tests/finder/queries';
import { loadTestEngine } from '../tests/helpers/engine';
import { seededRandom } from '../tests/helpers/random';

const WARMUP_MS = 300;
const RUN_MS = 2000;
const CARDS = 50;

const QUERIES: Record<string, FinderQuery> = {
  'tag-only (Charm Tag by 2)': query({ cardsPerAnte: CARDS }, [slot('tag', 'Charm Tag', 2)]),
  'soul → Perkeo by 2': query({ cardsPerAnte: CARDS }, [slot('soul', 'Perkeo', 2)]),
  'joker Perkeo by 2 (via Soul)': query({ cardsPerAnte: CARDS }, [slot('joker', 'Perkeo', 2)]),
  'Negative Blueprint in shop by 3': query({ cardsPerAnte: CARDS }, [
    slot('joker', 'Blueprint', 3, { edition: 'Negative', where: 'shop' }),
  ]),
  'Negative Blueprint in shop by 2': query({ cardsPerAnte: CARDS }, [
    slot('joker', 'Blueprint', 2, { edition: 'Negative', where: 'shop' }),
  ]),
  'Negative Blueprint in shop by 2, shop slot 5': query({ cardsPerAnte: CARDS }, [
    slot('joker', 'Blueprint', 2, { edition: 'Negative', where: 'shop', shopSlot: 5 }),
  ]),
  '3-slot mixed (Telescope by 2, Soul by 4, Polychrome joker by 3)': query({ cardsPerAnte: CARDS }, [
    slot('voucher', 'Telescope', 2),
    slot('soul', null, 4),
    slot('joker', null, 3, { edition: 'Polychrome' }),
  ]),
};

const rows: Record<string, { 'seeds/s/thread': number; 'vs full': string }> = {};

describe('finder throughput (seeds/s, one thread)', async () => {
  const engine = await loadTestEngine();
  const random = seededRandom(42);
  const seeds = Array.from({ length: 20_000 }, () => randomFinderSeed(random));

  it('baseline: analyze ante 1, 15 cards', () => {
    record('baseline: analyze ante 1, 15 cards', seedsPerSecond(seeds, (seed) => {
      analyze(engine, { ...DEFAULT_SETTINGS, seed, maxAnte: 1, cardsPerAnte: 15 });
    }));
  });

  it('baseline: analyze 8 antes, 50 cards', () => {
    record('baseline: analyze 8 antes, 50 cards', seedsPerSecond(seeds, (seed) => {
      analyze(engine, { ...DEFAULT_SETTINGS, seed, maxAnte: 8, cardsPerAnte: 50 });
    }));
  });

  for (const [name, q] of Object.entries(QUERIES)) {
    it(name, () => {
      const checker = createChecker(engine, q);
      const fast = seedsPerSecond(seeds, (seed) => checker.check(seed));
      const full = seedsPerSecond(seeds, (seed) => fullCheck(engine, q, seed));
      record(`${name} — full analyze + match`, full);
      record(`${name} — fast path`, fast, `${(fast / full).toFixed(1)}×`);
    });
  }
});

afterAll(() => {
  console.table(rows);
});

function record(name: string, perSecond: number, vsFull = ''): void {
  rows[name] = { 'seeds/s/thread': Math.round(perSecond), 'vs full': vsFull };
}

function seedsPerSecond(seeds: string[], run: (seed: string) => unknown): number {
  let i = 0;
  const loop = (ms: number): number => {
    const start = performance.now();
    let n = 0;
    while (performance.now() - start < ms) {
      for (let k = 0; k < 20; k++, n++) run(seeds[(i = (i + 1) % seeds.length)] ?? 'A');
    }
    return n / ((performance.now() - start) / 1000);
  };
  loop(WARMUP_MS);
  return loop(RUN_MS);
}
