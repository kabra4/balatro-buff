import { describe, expect, it } from 'vitest';
import { ANALYZER_SHOP_CAPS, analyze, cardsForAnte } from '../../src/engine/analyze';
import { randomSeed } from '../../src/engine/seed';
import { createChecker, fullCheck } from '../../src/finder/check';
import type { Occurrence } from '../../src/finder/match';
import { FINDER_SHOP_CAPS } from '../../src/finder/query';
import { loadTestEngine } from '../helpers/engine';
import { seededRandom } from '../helpers/random';
import { BASE_SETTINGS, query, slot } from './queries';

describe('shop caps', () => {
  it('analyzer keeps TheSoul caps: 15 cards in ante 1, setting elsewhere', () => {
    expect(ANALYZER_SHOP_CAPS).toEqual({ 1: 15 });
    expect([1, 2, 3].map((a) => cardsForAnte(a, 50))).toEqual([15, 50, 50]);
    expect([1, 2].map((a) => cardsForAnte(a, 10))).toEqual([10, 10]);
  });

  it('finder counts only 10 shop cards in ante 1 and 30 in ante 2', () => {
    expect([1, 2, 3].map((a) => cardsForAnte(a, 50, FINDER_SHOP_CAPS))).toEqual([10, 30, 50]);
    expect([1, 2, 3].map((a) => cardsForAnte(a, 25, FINDER_SHOP_CAPS))).toEqual([10, 25, 25]);
    expect([1, 2, 3].map((a) => cardsForAnte(a, 200, FINDER_SHOP_CAPS))).toEqual([10, 30, 200]);
  });

  it('fast path and full re-check only see the capped shop', async () => {
    const engine = await loadTestEngine();
    const q = query({ cardsPerAnte: 50 }, [slot('joker', null, 3, { where: 'shop' })]);
    const checker = createChecker(engine, q);
    const random = seededRandom(1010);
    for (let i = 0; i < 50; i++) {
      const seed = randomSeed(random);
      expect(fullCheck(engine, q, seed).analysis.antes.map((a) => a.shop.length)).toEqual([10, 30, 50]);
      for (const o of checker.collect(seed).filter((o) => o.where === 'shop')) {
        expect(shopIndex(o.place)).toBeLessThanOrEqual(o.ante === 1 ? 10 : o.ante === 2 ? 30 : 50);
      }
    }
  });

  it('a shop slot limit rolls only that many shop cards, and full analysis agrees past it', async () => {
    const engine = await loadTestEngine();
    const q = query({ cardsPerAnte: 50 }, [slot('joker', null, 3, { where: 'shop', shopSlot: 4 })]);
    const unlimited = createChecker(engine, { ...q, slots: [{ ...q.slots[0]!, shopSlot: null }] });
    const checker = createChecker(engine, q);
    const random = seededRandom(2024);
    for (let i = 0; i < 50; i++) {
      const seed = randomSeed(random);
      const shop = checker.collect(seed).filter((o) => o.where === 'shop');
      expect(shop.every((o) => o.shopIndex !== undefined && o.shopIndex <= 4 && o.place === `Shop #${o.shopIndex}`)).toBe(true);
      const early = unlimited.collect(seed).filter((o) => o.where === 'shop' && (o.shopIndex ?? Infinity) <= 4);
      expect(shop.map(withoutId)).toEqual(early.map(withoutId));
      expect(checker.check(seed)).toBe(fullCheck(engine, q, seed).matches !== null);
    }
  });

  it('a joker seen only past shop card 10 of ante 1 does not satisfy a by-ante-1 slot', async () => {
    const engine = await loadTestEngine();
    const random = seededRandom(77);
    let checked = 0;
    for (let i = 0; i < 5000 && checked < 5; i++) {
      const seed = randomSeed(random);
      const ante1 = analyze(engine, { ...BASE_SETTINGS, cardsPerAnte: 50, seed, maxAnte: 1 }).antes[0]!;
      const late = ante1.shop.slice(10, 15).find((item) => item.kind === 'joker');
      if (!late || ante1.shop.slice(0, 10).some((item) => 'name' in item && item.name === late.name)) continue;
      const q = query({ cardsPerAnte: 50 }, [slot('joker', late.name, 1, { where: 'shop' })]);
      expect(fullCheck(engine, q, seed).matches).toBeNull();
      expect(createChecker(engine, q).check(seed)).toBe(false);
      checked++;
    }
    expect(checked).toBe(5);
  });
});

/** Ids number every rolled card, so they differ between differently deep rolls. */
function withoutId({ id: _id, ...rest }: Occurrence): Omit<Occurrence, 'id'> {
  return rest;
}

/** "Shop #7" → 7. */
function shopIndex(place: string): number {
  return Number(place.replace('Shop #', ''));
}
