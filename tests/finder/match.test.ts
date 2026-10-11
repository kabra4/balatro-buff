import { describe, expect, it } from 'vitest';
import { matchSlots, slotAccepts, type Occurrence } from '../../src/finder/match';
import type { Slot } from '../../src/finder/types';

let nextId = 1;

function occ(o: Partial<Occurrence> & Pick<Occurrence, 'kind' | 'name'>): Occurrence {
  return { id: nextId++, edition: null, ante: 1, where: 'shop', place: 'Shop #1', ...o };
}

function slot(s: Partial<Slot> & Pick<Slot, 'kind'>): Slot {
  return { id: `s${nextId++}`, item: null, edition: 'any', where: 'any', byAnte: 8, shopSlot: null, ...s };
}

/** The three facets of one Soul card (shared id). */
function soulCard(legendary: string, ante: number, edition: Occurrence['edition'] = null): Occurrence[] {
  const id = nextId++;
  const at = { id, ante, where: 'packs' as const, place: 'Arcana Pack (pack 2)' };
  return [
    { ...at, kind: 'soul', name: legendary, edition },
    { ...at, kind: 'joker', name: legendary, edition },
    { ...at, kind: 'spectral', name: 'The Soul', edition: null },
  ];
}

describe('slotAccepts', () => {
  it('honours deadline, item, kind', () => {
    const s = slot({ kind: 'joker', item: 'Blueprint', byAnte: 3 });
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Blueprint', ante: 3 }))).toBe(true);
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Blueprint', ante: 4 }))).toBe(false);
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Brainstorm', ante: 1 }))).toBe(false);
    expect(slotAccepts(s, occ({ kind: 'soul', name: 'Blueprint', ante: 1 }))).toBe(false);
  });

  it('matches editions: any, none, exact', () => {
    const foil = occ({ kind: 'joker', name: 'Joker', edition: 'Foil' });
    const plain = occ({ kind: 'joker', name: 'Joker' });
    expect(slotAccepts(slot({ kind: 'joker', edition: 'any' }), foil)).toBe(true);
    expect(slotAccepts(slot({ kind: 'joker', edition: 'none' }), foil)).toBe(false);
    expect(slotAccepts(slot({ kind: 'joker', edition: 'none' }), plain)).toBe(true);
    expect(slotAccepts(slot({ kind: 'joker', edition: 'Foil' }), foil)).toBe(true);
    expect(slotAccepts(slot({ kind: 'joker', edition: 'Negative' }), foil)).toBe(false);
  });

  it('matches a Soul slot by the edition of the legendary it yields', () => {
    const [soul] = soulCard('Perkeo', 2, 'Negative');
    expect(slotAccepts(slot({ kind: 'soul', item: 'Perkeo', edition: 'Negative' }), soul!)).toBe(true);
    expect(slotAccepts(slot({ kind: 'soul', item: null, edition: 'Negative' }), soul!)).toBe(true);
    expect(slotAccepts(slot({ kind: 'soul', item: 'Perkeo', edition: 'Polychrome' }), soul!)).toBe(false);
    expect(slotAccepts(slot({ kind: 'soul', item: null, edition: 'none' }), soul!)).toBe(false);
    const [plainSoul] = soulCard('Canio', 3);
    expect(slotAccepts(slot({ kind: 'soul', item: null, edition: 'none' }), plainSoul!)).toBe(true);
  });

  it('matches where for kinds that have it, ignores it for vouchers/tags', () => {
    const inPack = occ({ kind: 'spectral', name: 'Grim', where: 'packs' });
    expect(slotAccepts(slot({ kind: 'spectral', where: 'packs' }), inPack)).toBe(true);
    expect(slotAccepts(slot({ kind: 'spectral', where: 'shop' }), inPack)).toBe(false);
    expect(slotAccepts(slot({ kind: 'spectral', where: 'any' }), inPack)).toBe(true);
    const tag = occ({ kind: 'tag', name: 'Charm Tag', where: 'shop' });
    expect(slotAccepts(slot({ kind: 'tag', item: 'Charm Tag', where: 'packs' }), tag)).toBe(true);
  });

  it('limits shop occurrences to the first `shopSlot` shop cards', () => {
    const s = slot({ kind: 'joker', item: 'Blueprint', shopSlot: 5 });
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Blueprint', place: 'Shop #5', shopIndex: 5 }))).toBe(true);
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Blueprint', place: 'Shop #6', shopIndex: 6 }))).toBe(false);
    expect(slotAccepts({ ...s, shopSlot: null }, occ({ kind: 'joker', name: 'Blueprint', place: 'Shop #6', shopIndex: 6 }))).toBe(true);
    const ghostShop = occ({ kind: 'spectral', name: 'Grim', place: 'Shop #3', shopIndex: 3 });
    expect(slotAccepts(slot({ kind: 'spectral', where: 'shop', shopSlot: 2 }), ghostShop)).toBe(false);
    expect(slotAccepts(slot({ kind: 'spectral', where: 'shop', shopSlot: 3 }), ghostShop)).toBe(true);
  });

  it('shop slot never limits pack occurrences (where any = in a pack, or early in the shop)', () => {
    const inPack = { where: 'packs' as const, place: 'Buffoon Pack (pack 4)' };
    const s = slot({ kind: 'joker', item: 'Blueprint', shopSlot: 1 });
    expect(slotAccepts(s, occ({ kind: 'joker', name: 'Blueprint', ...inPack }))).toBe(true);
    expect(slotAccepts({ ...s, where: 'packs' }, occ({ kind: 'joker', name: 'Blueprint', ...inPack }))).toBe(true);
    const [soul] = soulCard('Perkeo', 2);
    expect(slotAccepts(slot({ kind: 'soul', shopSlot: 1 }), soul!)).toBe(true);
  });

  it('kinds without a shop source ignore shop slot', () => {
    const voucher = occ({ kind: 'voucher', name: 'Telescope', place: 'Voucher' });
    expect(slotAccepts(slot({ kind: 'voucher', item: 'Telescope', shopSlot: 1 }), voucher)).toBe(true);
    // Even an occurrence carrying a shop index can't be limited for a kind the shop never yields.
    const tag = occ({ kind: 'tag', name: 'Charm Tag', shopIndex: 9 });
    expect(slotAccepts(slot({ kind: 'tag', item: 'Charm Tag', shopSlot: 1 }), tag)).toBe(true);
  });

  it('ignores edition for kinds without it', () => {
    const grim = occ({ kind: 'spectral', name: 'Grim', where: 'packs' });
    expect(slotAccepts(slot({ kind: 'spectral', edition: 'Foil' }), grim)).toBe(true);
  });
});

describe('matchSlots', () => {
  it('gives every slot its own occurrence', () => {
    const one = occ({ kind: 'tag', name: 'Charm Tag' });
    const slots = [slot({ kind: 'tag', item: 'Charm Tag' }), slot({ kind: 'tag', item: 'Charm Tag' })];
    expect(matchSlots(slots, [one])).toBeNull();
    const two = occ({ kind: 'tag', name: 'Charm Tag', ante: 2 });
    const m = matchSlots(slots, [one, two]);
    expect(m && new Set([...m.values()].map((o) => o.id)).size).toBe(2);
  });

  it('is not greedy: re-routes an earlier choice through an augmenting path', () => {
    // A takes any joker, B only Blueprint. Greedy A→Blueprint would strand B.
    const blueprint = occ({ kind: 'joker', name: 'Blueprint' });
    const joker = occ({ kind: 'joker', name: 'Joker' });
    const a = slot({ kind: 'joker' });
    const b = slot({ kind: 'joker', item: 'Blueprint' });
    const m = matchSlots([a, b], [blueprint, joker]);
    expect(m?.get(b.id)?.id).toBe(blueprint.id);
    expect(m?.get(a.id)?.id).toBe(joker.id);
  });

  it('a Soul satisfies a soul slot OR a joker slot (its legendary), not both', () => {
    const card = soulCard('Perkeo', 2, 'Negative');
    const soulSlot = slot({ kind: 'soul', item: 'Perkeo' });
    const jokerSlot = slot({ kind: 'joker', item: 'Perkeo', edition: 'Negative' });
    expect(matchSlots([soulSlot], card)?.get(soulSlot.id)?.kind).toBe('soul');
    expect(matchSlots([jokerSlot], card)?.get(jokerSlot.id)?.kind).toBe('joker');
    expect(matchSlots([soulSlot, jokerSlot], card)).toBeNull();
    expect(matchSlots([soulSlot, jokerSlot], [...card, ...soulCard('Perkeo', 3, 'Negative')])).not.toBeNull();
  });

  it('a Soul card can also be the spectral "The Soul", but only once', () => {
    const card = soulCard('Canio', 1);
    const spectral = slot({ kind: 'spectral', item: 'The Soul' });
    const soul = slot({ kind: 'soul' });
    expect(matchSlots([spectral], card)).not.toBeNull();
    expect(matchSlots([spectral, soul], card)).toBeNull();
  });

  it('respects each slot deadline', () => {
    const late = occ({ kind: 'voucher', name: 'Telescope', ante: 5 });
    expect(matchSlots([slot({ kind: 'voucher', item: 'Telescope', byAnte: 4 })], [late])).toBeNull();
    expect(matchSlots([slot({ kind: 'voucher', item: 'Telescope', byAnte: 5 })], [late])).not.toBeNull();
  });

  it('matches an empty slot list trivially', () => {
    expect(matchSlots([], [])?.size).toBe(0);
  });
});
