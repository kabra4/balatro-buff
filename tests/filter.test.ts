import { describe, expect, it } from 'vitest';
import type { Item } from '../src/engine/types';
import { EMPTY_FILTER, isFilterActive, matches, matchesLabel, type Filter } from '../src/ui/filter';

const NO_STICKERS = { eternal: false, perishable: false, rental: false };
const BLUEPRINT: Item = { kind: 'joker', name: 'Blueprint', edition: null, stickers: NO_STICKERS };
const NEG_JOKER: Item = { kind: 'joker', name: 'Joker', edition: 'Negative', stickers: { ...NO_STICKERS, eternal: true } };
const SOUL: Item = { kind: 'spectral', name: 'The Soul', soul: { index: 1, legendary: 'Perkeo', edition: 'Polychrome' } };
const FOOL: Item = { kind: 'tarot', name: 'The Fool' };
const ANKH: Item = { kind: 'spectral', name: 'Ankh' };
const POLY_CARD: Item = { kind: 'playing', rank: 'Ace', suit: 'Spades', enhancement: 'Glass', edition: 'Polychrome', seal: 'Red Seal' };

const f = (query: string, chips: string[] = []): Filter => ({ query, chips });

describe('filter', () => {
  it('matches everything when empty', () => {
    expect(isFilterActive(EMPTY_FILTER)).toBe(false);
    expect([BLUEPRINT, SOUL, FOOL, POLY_CARD].every((i) => matches(i, EMPTY_FILTER))).toBe(true);
  });

  it('searches names case-insensitively, including a Soul’s legendary', () => {
    expect(matches(BLUEPRINT, f('bluep'))).toBe(true);
    expect(matches(SOUL, f('PERKEO'))).toBe(true);
    expect(matches(FOOL, f('perkeo'))).toBe(false);
    expect(matches(POLY_CARD, f('ace of spades'))).toBe(true);
    expect(matches(NEG_JOKER, f('eternal'))).toBe(true);
  });

  it('applies chips as OR between chips', () => {
    expect(matches(BLUEPRINT, f('', ['jokers']))).toBe(true);
    expect(matches(FOOL, f('', ['jokers']))).toBe(false);
    expect(matches(SOUL, f('', ['legendary']))).toBe(true);
    expect(matches(ANKH, f('', ['legendary']))).toBe(false);
    expect(matches(ANKH, f('', ['jokers', 'spectral']))).toBe(true);
  });

  it('Negative/Poly matches jokers, playing cards and Soul legendaries by edition', () => {
    const chip = f('', ['negpoly']);
    expect([NEG_JOKER, POLY_CARD, SOUL].map((i) => matches(i, chip))).toEqual([true, true, true]);
    expect(matches(BLUEPRINT, chip)).toBe(false);
  });

  it('combines query AND chips', () => {
    expect(matches(NEG_JOKER, f('joker', ['negpoly']))).toBe(true);
    expect(matches(NEG_JOKER, f('blueprint', ['negpoly']))).toBe(false);
  });

  it('label chips select vouchers and tags but not items', () => {
    expect(matchesLabel('voucher', 'Telescope', f('', ['vouchers']))).toBe(true);
    expect(matchesLabel('tag', 'Negative Tag', f('', ['vouchers']))).toBe(false);
    expect(matchesLabel('tag', 'Negative Tag', f('negative', ['tags']))).toBe(true);
    expect(matchesLabel('boss', 'The Hook', f('hook'))).toBe(true);
    expect(matches(BLUEPRINT, f('', ['vouchers']))).toBe(false);
  });
});
