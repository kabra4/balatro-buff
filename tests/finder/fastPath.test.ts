/**
 * Correctness gate: the fast path must agree with full analysis on every seed —
 * same verdict, and the same occurrences for everything any slot could accept.
 *
 * Phase 1: SEEDS_PER_QUERY random seeds, every one checked both ways (catches false positives
 * and false negatives). Phase 2: keep drawing seeds through the fast path until the query has
 * MIN_POSITIVES positives, each re-checked with full analysis — so rare queries still exercise
 * their positive path.
 */
import { describe, expect, it } from 'vitest';
import type { ImmolateModule } from '../../src/engine/loader';
import { createChecker, fullCheck, type Checker } from '../../src/finder/check';
import { slotAccepts, type Occurrence } from '../../src/finder/match';
import { occurrencesFrom } from '../../src/finder/occurrences';
import { randomFinderSeed } from '../../src/finder/seeds';
import type { FinderQuery } from '../../src/finder/types';
import { loadTestEngine } from '../helpers/engine';
import { seededRandom } from '../helpers/random';
import { QUERIES } from './queries';

const SEEDS_PER_QUERY = 2000;
const MIN_POSITIVES = 30;
const MAX_EXTRA_SEEDS = 400_000;

describe('fast path ≡ full analyze + matchSlots', () => {
  it.each(Object.entries(QUERIES))(
    '%s',
    async (name, query) => {
      const engine = await loadTestEngine();
      const checker = createChecker(engine, query);
      const random = seededRandom(fnv1a(name));
      const mismatches: string[] = [];
      let positives = 0;

      for (let i = 0; i < SEEDS_PER_QUERY; i++) {
        const seed = randomFinderSeed(random);
        const fast = checker.check(seed);
        const problem = compare(engine, checker, query, seed, fast);
        if (problem) mismatches.push(problem);
        if (fast) positives++;
      }
      expect(positives).toBeLessThan(SEEDS_PER_QUERY);

      for (let i = 0; i < MAX_EXTRA_SEEDS && positives < MIN_POSITIVES; i++) {
        const seed = randomFinderSeed(random);
        if (!checker.check(seed)) continue;
        positives++;
        const problem = compare(engine, checker, query, seed, true);
        if (problem) mismatches.push(problem);
      }

      expect(mismatches.slice(0, 10)).toEqual([]);
      expect(positives).toBeGreaterThanOrEqual(MIN_POSITIVES);
    },
    180_000,
  );
});

/** null when fast path and full analysis agree on `seed`, else a description. */
function compare(engine: ImmolateModule, checker: Checker, query: FinderQuery, seed: string, fast: boolean): string | null {
  const full = fullCheck(engine, query, seed);
  if (fast !== (full.matches !== null)) return `${seed}: verdict fast=${fast} full=${!fast}`;
  const a = relevant(query, checker.collect(seed));
  const b = relevant(query, occurrencesFrom(full.analysis));
  return a.join('\n') === b.join('\n') ? null : `${seed}: occurrences differ`;
}

/** Occurrences some slot of the query accepts, as sorted comparable strings (ids differ between paths). */
function relevant(query: FinderQuery, occ: Occurrence[]): string[] {
  return occ
    .filter((o) => query.slots.some((s) => slotAccepts(s, o)))
    .map((o) => [o.kind, o.name, o.edition, o.ante, o.where, o.place].join('|'))
    .sort();
}

/** 32-bit FNV-1a: a distinct, stable seed stream per query name. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}
