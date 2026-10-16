import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/engine/analyze';
import { fullCheck } from '../../src/finder/check';
import type { Occurrence } from '../../src/finder/match';
import { analyzerHref } from '../../src/finder/query';
import { createVerifier } from '../../src/finder/verify';
import { loadTestEngine } from '../helpers/engine';
import { query, slot } from './queries';

/** Two Souls by ante 1: ante 1 opens 4 shop packs, only 2 when a blind is skipped. */
const TWO_SOULS = query({}, [slot('soul', null, 1), slot('soul', null, 1)]);

describe('createVerifier: tag-pack previews must be reachable together', () => {
  it('rejects a match whose preview skip removes the other matched pack (LQGDR9XD)', async () => {
    const engine = await loadTestEngine();
    // Each preview counts on its own: a Soul in shop pack 4 + the Charm Tag's Soul if the big blind is skipped.
    expect(places(fullCheck(engine, TWO_SOULS, 'LQGDR9XD').matches)).toEqual(['Arcana Pack (pack 4)', 'Charm Tag (skip Big Blind)']);
    // Skipping the big blind drops its shop visit, so pack 4 is never opened.
    const verify = createVerifier(async (s) => analyze(engine, s));
    expect(await verify(TWO_SOULS, 'LQGDR9XD')).toBeNull();
  });

  it('accepts a reachable preview and links the analyzer to that line (513ZWDQA)', async () => {
    const engine = await loadTestEngine();
    const verify = createVerifier(async (s) => analyze(engine, s));
    const matches = await verify(TWO_SOULS, '513ZWDQA');
    expect(places(matches)).toEqual(['Arcana Pack (pack 2)', 'Charm Tag (skip Big Blind)']);
    expect([...matches!.values()].flatMap((o) => (o.skip ? [o.skip] : []))).toEqual([{ ante: 1, blind: 'big' }]);
    const href = analyzerHref(TWO_SOULS, '513ZWDQA', matches!);
    expect(new URLSearchParams(href.slice(href.indexOf('?'))).get('act')).toBe('b1');
  });

  it('matches without previews are verified on the default line (one analysis)', async () => {
    const engine = await loadTestEngine();
    const seen: unknown[] = [];
    const verify = createVerifier(async (s) => {
      seen.push(s.actions);
      return analyze(engine, s);
    });
    const tagOnly = query({}, [slot('tag', 'Charm Tag', 1)]);
    expect(await verify(tagOnly, '513ZWDQA')).not.toBeNull();
    expect(seen).toEqual([[]]);
  });
});

function places(matches: ReadonlyMap<string, Occurrence> | null): string[] {
  return [...(matches?.values() ?? [])].map((o) => o.place).sort();
}
