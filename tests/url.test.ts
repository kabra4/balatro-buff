import { describe, expect, it } from 'vitest';
import { UNLOCK_OPTIONS } from '../src/engine/constants';
import type { Settings } from '../src/engine/types';
import { DEFAULT_SETTINGS } from '../src/state/settings';
import { parse, serialize } from '../src/state/url';

const CUSTOM: Settings = {
  seed: 'N9LXVGLM',
  deck: 'Ghost Deck',
  stake: 'Gold Stake',
  version: 10014,
  maxAnte: 12,
  cardsPerAnte: 200,
  showman: true,
  locked: ['Negative Tag', 'Oops! All 6s', "Driver's License", 'Palette'],
};

describe('url state', () => {
  it('round-trips custom settings', () => {
    expect(parse(serialize(CUSTOM))).toEqual(CUSTOM);
  });

  it('round-trips defaults to an empty query', () => {
    expect(serialize({ ...DEFAULT_SETTINGS })).toBe('');
    expect(parse('')).toEqual(DEFAULT_SETTINGS);
  });

  it('writes only non-default params', () => {
    const query = serialize({ ...DEFAULT_SETTINGS, seed: 'ABC', maxAnte: 3 });

    expect([...new URLSearchParams(query).keys()]).toEqual(['seed', 'ante']);
  });

  it('keeps locked names readable as a comma list', () => {
    const query = serialize({ ...DEFAULT_SETTINGS, locked: ['Showman', 'Blueprint'] });

    expect(query).toBe('locked=Showman,Blueprint');
  });

  it('round-trips every unlock locked', () => {
    const s = { ...DEFAULT_SETTINGS, locked: [...UNLOCK_OPTIONS] };

    expect(parse(serialize(s))).toEqual(s);
  });

  it.each([
    ['ante=-5', { maxAnte: 1 }],
    ['ante=0', { maxAnte: 1 }],
    ['ante=abc', {}],
    ['ante=', {}],
    ['cards=7', {}],
    ['cards=abc', {}],
    ['version=1', {}],
    ['version=10106.5', {}],
    ['deck=red+deck', {}],
    ['showman=yes', {}],
    ['seed=%00%3Cscript%3E', { seed: 'SCRIPT' }],
    ['locked=%2C%2C,Bogus', {}],
  ])('hostile param %s parses safely', (query, expected) => {
    expect(parse(query)).toEqual({ ...DEFAULT_SETTINGS, ...expected });
  });

  it('falls back to defaults for invalid values and normalises the rest', () => {
    const s = parse('?seed=ab0c-d&deck=Nope&stake=Gold+Stake&version=1&ante=99&cards=7&locked=Blueprint,Bogus,Showman,Blueprint');

    expect(s).toEqual({
      ...DEFAULT_SETTINGS,
      seed: 'ABOCD',
      stake: 'Gold Stake',
      maxAnte: 20,
      locked: ['Showman', 'Blueprint'],
    });
  });
});
