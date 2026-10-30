import { describe, expect, it } from 'vitest';
import { buildPlan, OMEN_GLOBE_PACK_TYPES, SOUL_PACK_TYPES, STEP_ORDER, VOUCHER_PACK_TYPES } from '../../src/finder/plan';
import { query, slot } from './queries';

describe('buildPlan', () => {
  it('tag-only query rolls only tags (through the deadline)', () => {
    const plan = buildPlan(query({}, [slot('tag', 'Charm Tag', 3)]));
    expect(plan.through).toEqual({ voucher: 0, tags: 3, shopEntry: 0, packs: 0, shop: 0 });
    expect(plan.souls).toBe(0);
    expect(plan.horizon).toBe(3);
  });

  it('soul query rolls packs with Arcana + Spectral contents only (+ vouchers and tags they depend on)', () => {
    const plan = buildPlan(query({}, [slot('soul', 'Perkeo', 2)]));
    expect(plan.through).toEqual({ voucher: 2, tags: 2, shopEntry: 0, packs: 2, shop: 0 });
    expect([...plan.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Spectral Pack']);
    expect(plan.souls).toBe(2);
  });

  it('named non-legendary joker in the shop needs shop jokers only', () => {
    const plan = buildPlan(query({}, [slot('joker', 'Blueprint', 3, { where: 'shop' })]));
    expect(plan.through).toEqual({ voucher: 3, tags: 0, shopEntry: 3, packs: 0, shop: 3 });
    expect([...plan.shopTypes.keys()]).toEqual(['Joker']);
  });

  it('any joker anywhere also needs Buffoon packs and Soul legendaries', () => {
    const plan = buildPlan(query({}, [slot('joker', null, 2)]));
    expect([...plan.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Buffoon Pack', 'Spectral Pack']);
    expect(plan.souls).toBe(2);
    expect(plan.through.shop).toBe(2);
  });

  it('a legendary joker slot only uses Soul sources (shop/Buffoon never roll legendaries)', () => {
    const plan = buildPlan(query({}, [slot('joker', 'Perkeo', 2)]));
    expect(plan.through.shop).toBe(0);
    expect([...plan.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Spectral Pack']);
    expect(plan.souls).toBe(2);
    expect(buildPlan(query({}, [slot('joker', 'Perkeo', 2, { where: 'shop' })])).impossible).toBe(true);
    // Plain "Joker" is both a shop/Buffoon joker and the Soul fallback once all legendaries are owned.
    const joker = buildPlan(query({}, [slot('joker', 'Joker', 2)]));
    expect(joker.through.shop).toBe(2);
    expect([...joker.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Buffoon Pack', 'Spectral Pack']);
  });

  it('Soul pack types come from the registry', () => {
    expect([...SOUL_PACK_TYPES].sort()).toEqual(['Arcana Pack', 'Spectral Pack']);
  });

  it('a specific spectral skips Celestial (Arcana packs: Omen Globe); Black Hole needs Celestial', () => {
    expect([...buildPlan(query({}, [slot('spectral', 'Grim', 2)])).packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Spectral Pack']);
    expect([...buildPlan(query({}, [slot('spectral', 'Black Hole', 2)])).packTypes.keys()].sort()).toEqual([
      'Arcana Pack',
      'Celestial Pack',
      'Spectral Pack',
    ]);
  });

  it('shop spectrals only exist on the Ghost Deck', () => {
    expect(buildPlan(query({}, [slot('spectral', null, 1, { where: 'shop' })])).impossible).toBe(true);
    const ghost = buildPlan(query({ deck: 'Ghost Deck' }, [slot('spectral', null, 1, { where: 'shop' })]));
    expect(ghost.impossible).toBe(false);
    expect([...ghost.shopTypes.keys()]).toEqual(['Spectral']);
  });

  it('shop depth: the deepest shop slot among shop-served slots still due, per ante', () => {
    const limited = buildPlan(query({}, [slot('joker', 'Blueprint', 2, { where: 'shop', shopSlot: 5 }), slot('joker', null, 3, { shopSlot: 2 })]));
    expect(limited.shopDepth.slice(1)).toEqual([5, 5, 2]);
    const oneUnlimited = buildPlan(query({}, [slot('joker', null, 2, { shopSlot: 3 }), slot('joker', 'Joker', 2, { where: 'shop' })]));
    expect(oneUnlimited.shopDepth.slice(1)).toEqual([Infinity, Infinity]);
    // The unlimited slot is due by ante 1: later antes only need the limited one.
    const early = buildPlan(query({}, [slot('joker', null, 1, { where: 'shop' }), slot('joker', null, 4, { where: 'shop', shopSlot: 3 })]));
    expect(early.shopDepth.slice(1)).toEqual([Infinity, 3, 3, 3]);
  });

  it('slots the shop cannot serve never add shop depth', () => {
    const plan = buildPlan(query({}, [slot('joker', null, 2, { where: 'shop', shopSlot: 4 }), slot('joker', null, 2, { where: 'packs' }), slot('joker', 'Perkeo', 2), slot('spectral', null, 2), slot('tag', 'Charm Tag', 3)]));
    expect(plan.shopDepth.slice(1)).toEqual([4, 4, 0]);
    expect(plan.through.shop).toBe(2);
  });

  it('each step runs through the latest deadline that needs it', () => {
    const plan = buildPlan(query({}, [slot('voucher', 'Hone', 2), slot('tag', 'Charm Tag', 5), slot('voucher', 'Telescope', 4)]));
    expect(plan.through).toEqual({ voucher: 4, tags: 5, shopEntry: 0, packs: 0, shop: 0 });
    expect(plan.slots.map((p) => p.lastStep)).toEqual([0, 1, 0]);
  });

  it('shop entry cards roll before packs, the rest of the shop last', () => {
    expect(STEP_ORDER).toEqual(['voucher', 'tags', 'shopEntry', 'packs', 'shop']);
    const plan = buildPlan(query({}, [slot('joker', null, 2, { where: 'shop', shopSlot: 1 })]));
    expect(plan.through.shopEntry).toBe(2);
    expect(plan.slots[0]!.lastStep).toBe(STEP_ORDER.indexOf('shop'));
  });

  describe('couplings', () => {
    it('bought vouchers change the shop: vouchers roll through the shop', () => {
      const plan = buildPlan(query({}, [slot('joker', null, 3, { where: 'shop' }), slot('voucher', 'Hone', 1)]));
      expect(plan.through.voucher).toBe(3);
    });

    it('bought vouchers change Arcana and Buffoon packs: vouchers roll through them', () => {
      expect([...VOUCHER_PACK_TYPES].sort()).toEqual(['Arcana Pack', 'Buffoon Pack']);
      expect(buildPlan(query({}, [slot('joker', 'Blueprint', 3, { where: 'packs' })])).through.voucher).toBe(3);
      expect(buildPlan(query({}, [slot('spectral', 'Grim', 4, { where: 'packs' })])).through.voucher).toBe(4);
      expect(buildPlan(query({}, [slot('spectral', 'Black Hole', 2, { where: 'packs' }), slot('tag', 'Charm Tag', 5)])).through.voucher).toBe(2);
    });

    it('Omen Globe: Arcana and Spectral contents roll through the same ante', () => {
      expect(OMEN_GLOBE_PACK_TYPES).toEqual(['Arcana Pack', 'Spectral Pack']);
      const plan = buildPlan(query({}, [slot('soul', null, 2), slot('spectral', 'Familiar', 5, { where: 'packs' })]));
      expect(plan.packTypes.get('Arcana Pack')).toBe(5);
      expect(plan.packTypes.get('Spectral Pack')).toBe(5);
    });

    it('a needed pack type pulls the tags (tag-pack previews) through the same ante', () => {
      expect(buildPlan(query({}, [slot('soul', null, 3)])).through.tags).toBe(3);
      expect(buildPlan(query({}, [slot('joker', null, 4, { where: 'packs' })])).through.tags).toBe(4);
      expect(buildPlan(query({}, [slot('spectral', 'Black Hole', 2, { where: 'packs' }), slot('tag', 'Charm Tag', 1)])).through.tags).toBe(2);
      // Shop-only queries never need tags.
      expect(buildPlan(query({}, [slot('joker', null, 3, { where: 'shop' })])).through.tags).toBe(0);
    });
  });
});
