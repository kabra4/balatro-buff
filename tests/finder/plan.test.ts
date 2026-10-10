import { describe, expect, it } from 'vitest';
import { buildPlan } from '../../src/finder/plan';
import { query, slot } from './queries';

describe('buildPlan', () => {
  it('tag-only query rolls only tags (through the deadline)', () => {
    const plan = buildPlan(query({}, [slot('tag', 'Charm Tag', 3)]));
    expect(plan.through).toEqual({ voucher: 0, tags: 3, packs: 0, shop: 0 });
    expect(plan.souls).toBe(0);
    expect(plan.horizon).toBe(3);
  });

  it('soul query rolls packs with Arcana + Spectral contents only', () => {
    const plan = buildPlan(query({}, [slot('soul', 'Perkeo', 2)]));
    expect(plan.through).toEqual({ voucher: 0, tags: 0, packs: 2, shop: 0 });
    expect([...plan.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Spectral Pack']);
    expect(plan.souls).toBe(2);
  });

  it('named non-legendary joker in the shop needs shop jokers only', () => {
    const plan = buildPlan(query({}, [slot('joker', 'Blueprint', 3, { where: 'shop' })]));
    expect(plan.through).toEqual({ voucher: 0, tags: 0, packs: 0, shop: 3 });
    expect([...plan.shopTypes.keys()]).toEqual(['Joker']);
  });

  it('any joker anywhere also needs Buffoon packs and Soul legendaries', () => {
    const plan = buildPlan(query({}, [slot('joker', null, 2)]));
    expect([...plan.packTypes.keys()].sort()).toEqual(['Arcana Pack', 'Buffoon Pack', 'Spectral Pack']);
    expect(plan.souls).toBe(2);
    expect(plan.through.shop).toBe(2);
  });

  it('a specific spectral skips Arcana/Celestial; Black Hole needs Celestial', () => {
    expect([...buildPlan(query({}, [slot('spectral', 'Grim', 2)])).packTypes.keys()]).toEqual(['Spectral Pack']);
    expect([...buildPlan(query({}, [slot('spectral', 'Black Hole', 2)])).packTypes.keys()].sort()).toEqual([
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

  it('each step runs through the latest deadline that needs it', () => {
    const plan = buildPlan(query({}, [slot('voucher', 'Hone', 2), slot('tag', 'Charm Tag', 5), slot('voucher', 'Telescope', 4)]));
    expect(plan.through).toEqual({ voucher: 4, tags: 5, packs: 0, shop: 0 });
    expect(plan.slots.map((p) => p.lastStep)).toEqual([0, 1, 0]);
  });
});
