/**
 * Correctness gate: the fast path must agree with full analysis on every seed —
 * same verdict, and the same occurrences for everything any slot could accept.
 */
import { describe, expect, it } from 'vitest';
import { createChecker, fullCheck } from '../../src/finder/check';
import { slotAccepts, type Occurrence } from '../../src/finder/match';
import { occurrencesFrom } from '../../src/finder/occurrences';
import { randomFinderSeed } from '../../src/finder/seeds';
import type { FinderQuery } from '../../src/finder/types';
import { loadTestEngine } from '../helpers/engine';
import { seededRandom } from '../helpers/random';
import { QUERIES } from './queries';

const SEEDS_PER_QUERY = 2000;

describe('fast path ≡ full analyze + matchSlots', () => {
  it.each(Object.entries(QUERIES))(
    '%s',
    async (_name, query) => {
      const engine = await loadTestEngine();
      const checker = createChecker(engine, query);
      const random = seededRandom(0x5eed + _name.length);
      const verdictMismatches: string[] = [];
      const occurrenceMismatches: string[] = [];
      let positives = 0;

      for (let i = 0; i < SEEDS_PER_QUERY; i++) {
        const seed = randomFinderSeed(random);
        const full = fullCheck(engine, query, seed);
        const expected = full.matches !== null;
        if (expected) positives++;
        if (checker.check(seed) !== expected) verdictMismatches.push(seed);
        const fast = relevant(query, checker.collect(seed));
        const reference = relevant(query, occurrencesFrom(full.analysis));
        if (fast.join('\n') !== reference.join('\n')) occurrenceMismatches.push(seed);
      }

      expect(verdictMismatches.slice(0, 10)).toEqual([]);
      expect(occurrenceMismatches.slice(0, 10)).toEqual([]);
      // Non-vacuous: both verdicts must actually occur.
      expect(positives).toBeGreaterThan(0);
      expect(positives).toBeLessThan(SEEDS_PER_QUERY);
    },
    120_000,
  );
});

/** Occurrences some slot of the query accepts, as sorted comparable strings (ids differ between paths). */
function relevant(query: FinderQuery, occ: Occurrence[]): string[] {
  return occ
    .filter((o) => query.slots.some((s) => slotAccepts(s, o)))
    .map((o) => [o.kind, o.name, o.edition, o.ante, o.where, o.place].join('|'))
    .sort();
}
