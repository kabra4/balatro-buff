import { describe, expect, it } from 'vitest';
import { UNLOCK_OPTIONS } from '../../src/engine/constants';
import { analyzerHref } from '../../src/finder/query';
import type { FinderQuery } from '../../src/finder/types';
import { MAX_SLOTS, parseQuery, serializeQuery } from '../../src/finder/url';
import { parse as parseAnalyzer } from '../../src/state/url';
import { BASE_SETTINGS } from './queries';

const FULL: FinderQuery = {
  settings: { deck: 'Ghost Deck', stake: 'Gold Stake', version: 10014, cardsPerAnte: 25, showman: true, locked: ['Negative Tag', 'Blueprint'] },
  slots: [
    { id: 'slot-1', kind: 'joker', item: 'Blueprint', edition: 'Negative', where: 'shop', byAnte: 3 },
    { id: 'slot-2', kind: 'soul', item: null, edition: 'any', where: 'packs', byAnte: 2 },
    { id: 'slot-3', kind: 'spectral', item: 'Black Hole', edition: 'any', where: 'any', byAnte: 8 },
    { id: 'slot-4', kind: 'voucher', item: "Director's Cut", edition: 'any', where: 'any', byAnte: 1 },
    { id: 'slot-5', kind: 'tag', item: 'Charm Tag', edition: 'any', where: 'any', byAnte: 4 },
    { id: 'slot-6', kind: 'joker', item: 'Oops! All 6s', edition: 'none', where: 'any', byAnte: 5 },
  ],
};

describe('finder URL state', () => {
  it('round-trips settings and slots', () => {
    expect(parseQuery(serializeQuery(FULL))).toEqual(FULL);
    expect(parseQuery(`?${serializeQuery(FULL)}`)).toEqual(FULL);
  });

  it('writes only non-default settings and a compact versioned slots param', () => {
    const q: FinderQuery = { settings: BASE_SETTINGS, slots: [{ id: 'a', kind: 'tag', item: 'Charm Tag', edition: 'any', where: 'any', byAnte: 2 }] };
    expect(serializeQuery({ ...q, settings: { ...q.settings, cardsPerAnte: 50 } })).toBe('q=1*tag_Charm+Tag___2');
  });

  it('defaults everything on an empty query', () => {
    expect(parseQuery('')).toEqual({ settings: { ...BASE_SETTINGS, cardsPerAnte: 50 }, slots: [] });
  });

  it('survives hostile input', () => {
    const hostile = [
      'q=2*joker_Blueprint___3', // unknown version
      'q=1*joker_<script>___3', // unknown item
      'q=1*boss_The+Hook___3', // unknown kind
      'q=1*joker_Blueprint_Shiny_nowhere_99', // bad edition / where / ante
      'q=1*tag____1*tag_Charm+Tag_Negative_shop_-5', // missing required item kept for validation; edition/where ignored
      'q=1*joker_Blueprint', // too few fields
      `q=1${'*joker____3'.repeat(500)}`, // oversized
      'q=%E0%A4%A', // malformed percent-encoding
      'deck=Nope&stake=Nope&version=1&cards=7&showman=yes&locked=__proto__,Blueprint',
    ];
    const parsed = hostile.map(parseQuery);
    expect(parsed[0]!.slots).toEqual([]);
    expect(parsed[1]!.slots).toEqual([]);
    expect(parsed[2]!.slots).toEqual([]);
    expect(parsed[3]!.slots).toEqual([{ id: 'slot-1', kind: 'joker', item: 'Blueprint', edition: 'any', where: 'any', byAnte: 8 }]);
    expect(parsed[4]!.slots).toEqual([
      { id: 'slot-1', kind: 'tag', item: null, edition: 'any', where: 'any', byAnte: 1 },
      { id: 'slot-2', kind: 'tag', item: 'Charm Tag', edition: 'any', where: 'any', byAnte: 8 },
    ]);
    expect(parsed[5]!.slots).toEqual([]);
    expect(parsed[6]!.slots).toEqual([]);
    expect(parsed[7]!.slots).toEqual([]);
    expect(parsed[8]!.settings).toEqual({ ...BASE_SETTINGS, cardsPerAnte: 50, locked: ['Blueprint'] });
  });

  it(`keeps at most ${MAX_SLOTS} slots`, () => {
    const many = `q=1${'*tag_Charm+Tag___2'.repeat(MAX_SLOTS + 5)}`;
    expect(parseQuery(many).slots).toHaveLength(MAX_SLOTS);
  });

  it('builds a page-1 analyzer link with the same settings', () => {
    const href = analyzerHref(FULL, 'ABCD1234');
    expect(href.startsWith('./index.html?')).toBe(true);
    expect(parseAnalyzer(href.slice(href.indexOf('?')))).toEqual({
      ...FULL.settings,
      seed: 'ABCD1234',
      maxAnte: 8,
      locked: UNLOCK_OPTIONS.filter((o) => FULL.settings.locked.includes(o)),
    });
  });
});
