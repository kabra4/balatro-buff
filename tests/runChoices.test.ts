import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/analyze';
import { formatAsTheSoulText } from '../src/engine/format';
import { randomSeed } from '../src/engine/seed';
import type { Analysis, Item, RunAction, Settings } from '../src/engine/types';
import { matchSlots } from '../src/finder/match';
import { occurrencesFrom } from '../src/finder/occurrences';
import { loadTestEngine } from './helpers/engine';
import { seededRandom } from './helpers/random';
import { slot } from './finder/queries';

const BASE: Settings = {
  seed: 'ABCD1234',
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  maxAnte: 8,
  cardsPerAnte: 15,
  showman: false,
  locked: [],
};

/** Vouchers whose effect changes later rolls (shop, Arcana / Buffoon packs) or the shop entry size. */
const EFFECT_VOUCHERS = ['Overstock', 'Overstock Plus', 'Tarot Merchant', 'Tarot Tycoon', 'Planet Merchant', 'Planet Tycoon', 'Magic Trick', 'Hone', 'Glow Up', 'Omen Globe'];

describe('bought voucher effects', () => {
  it('match compat mode until the first effect voucher is bought', async () => {
    const engine = await loadTestEngine();
    const random = seededRandom(7);
    for (let n = 0; n < 100; n++) {
      const settings = { ...BASE, seed: randomSeed(random) };
      const effects = analyze(engine, settings);
      const compat = analyze(engine, { ...settings, theSoulCompat: true });
      const first = effects.antes.findIndex((a) => EFFECT_VOUCHERS.includes(a.voucher));
      const before = first === -1 ? settings.maxAnte : first;

      expect(effects.antes.slice(0, before)).toEqual(compat.antes.slice(0, before));
      expect(effects.antes.map((a) => a.voucher)).toEqual(compat.antes.map((a) => a.voucher));
    }
  });

  it('Tarot Merchant applies after the 2 cards the shop shows on entry (8W7IHTDT)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: '8W7IHTDT', maxAnte: 1 };

    const [effects] = analyze(engine, settings).antes;
    const [compat] = analyze(engine, { ...settings, theSoulCompat: true }).antes;

    expect(effects!.voucher).toBe('Tarot Merchant');
    expect(effects!.shop.slice(0, 2)).toEqual(compat!.shop.slice(0, 2));
    expect(effects!.shop[2]).not.toEqual(compat!.shop[2]);
  });

  it('an active Overstock widens the next shop entry: 3 cards before the voucher applies (QSM8TVB2)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'QSM8TVB2', maxAnte: 2, cardsPerAnte: 10 };

    const effects = analyze(engine, settings).antes;
    const compat = analyze(engine, { ...settings, theSoulCompat: true }).antes;

    expect(effects.map((a) => a.voucher)).toEqual(['Overstock', 'Magic Trick']);
    expect(effects[1]!.shop.slice(0, 3)).toEqual(compat[1]!.shop.slice(0, 3));
    expect(effects[1]!.shop).not.toEqual(compat[1]!.shop);
  });

  it('a profile-locked upgrade stays locked after its base voucher is bought (SGCDCJXX)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'SGCDCJXX', maxAnte: 20 };

    const unlocked = analyze(engine, settings).antes.map((a) => a.voucher);
    const locked = analyze(engine, { ...settings, locked: ['Glow Up'] }).antes.map((a) => a.voucher);

    expect(unlocked[0]).toBe('Hone');
    expect(unlocked[4]).toBe('Glow Up');
    expect(locked).not.toContain('Glow Up');
  });

  it('Omen Globe puts Spectral cards into Arcana packs, as Spectral cards a Spectral slot matches (JCG2SAG4)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'JCG2SAG4', maxAnte: 4 };

    const effects = analyze(engine, settings);
    const compat = analyze(engine, { ...settings, theSoulCompat: true });

    expect(effects.antes.map((a) => a.voucher).slice(0, 2)).toEqual(['Crystal Ball', 'Omen Globe']);
    const arcana = effects.antes[3]!.packs.find((p) => p.type === 'Arcana Pack' && p.items.some((i) => isNamed(i, 'Medium')));
    expect(arcana?.items.find((i) => isNamed(i, 'Medium'))?.kind).toBe('spectral');
    expect(arcanaSpectrals(compat)).toEqual([]);
    const medium = slot('spectral', 'Medium', 4, { where: 'packs' });
    expect(matchSlots([medium], occurrencesFrom(effects))?.get(medium.id)?.place).toBe(`${arcana!.name} (pack ${arcana!.queueIndex! + 1})`);
  });
});

describe('run choices', () => {
  it('skipping the ante-1 voucher lets it come back (YF1QQRPN)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'YF1QQRPN', maxAnte: 3 };

    const bought = analyze(engine, settings).antes;
    const skipped = analyze(engine, { ...settings, actions: [{ kind: 'skipVoucher', ante: 1 }] }).antes;

    expect(bought.map((a) => a.voucher)).toEqual(['Seed Money', 'Blank', 'Money Tree']);
    expect(skipped.map((a) => a.voucher)).toEqual(['Seed Money', 'Blank', 'Seed Money']);
    expect(skipped.map((a) => a.voucherSkipped)).toEqual([true, false, false]);
  });

  it('a skipped blind opens its tag pack in play order and shifts the next pack of that type (ABCD1234)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, maxAnte: 2 };

    const played = analyze(engine, settings).antes;
    const small = analyze(engine, { ...settings, actions: [skipBlind(1, 'small'), skipBlind(2, 'small')] });
    const big = analyze(engine, { ...settings, actions: [skipBlind(1, 'big')] }).antes;
    const both = analyze(engine, { ...settings, actions: [skipBlind(1, 'small'), skipBlind(1, 'big')] }).antes;

    expect(played[0]!.tags).toEqual(['Charm Tag', 'Double Tag']);
    const [tagPack, ...shopPacks] = small.antes[0]!.packs;
    expect(tagPack).toMatchObject({ name: 'Mega Arcana Pack', tag: { name: 'Charm Tag', blind: 'small' } });
    expect(tagPack!.items).toHaveLength(5);
    expect(shopPacks.map((p) => [p.name, p.queueIndex])).toEqual([['Buffoon Pack', 0], ['Arcana Pack', 1]]);
    // The tag pack draws from the ante's Arcana stream first: the shop Arcana pack gets later cards.
    expect(tagPack!.items.slice(0, 3)).toEqual(played[0]!.packs[1]!.items);
    expect(shopPacks[1]!.items).not.toEqual(played[0]!.packs[1]!.items);
    expect(formatAsTheSoulText(small)).toContain('Charm Tag → Mega Arcana Pack - The Hierophant, ');
    // Double Tag gives no pack; every skipped blind is one shop visit (2 packs) fewer.
    expect(big[0]!.packs.map((p) => p.queueIndex)).toEqual([0, 1]);
    expect(played.map((a) => a.packs.length)).toEqual([4, 6]);
    expect(small.antes.map((a) => a.packs.filter((p) => !p.tag).length)).toEqual([2, 4]);
    // The boss shop is always visited: both blinds skipped still opens 2 shop packs (and the first-pack Buffoon stays in ante 1).
    expect(both[0]!.packs.map((p) => p.tag?.name ?? p.name)).toEqual(['Charm Tag', 'Buffoon Pack', 'Arcana Pack']);
    expect(both[1]!.packs.map((p) => p.name)).toEqual(played[1]!.packs.map((p) => p.name));
    expect(both[0]!.skipped).toEqual(['small', 'big']);
  });

  it('an unopened pack rolls nothing: the next pack of its type gets its cards (YVAQ4BUB)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'YVAQ4BUB', maxAnte: 2 };

    const opened = analyze(engine, settings);
    const skipped = analyze(engine, { ...settings, actions: [{ kind: 'skipPack', ante: 2, index: 0 }] });

    const [first, second] = skipped.antes[1]!.packs;
    expect(opened.antes[1]!.packs.slice(0, 2).map((p) => p.name)).toEqual(['Standard Pack', 'Standard Pack']);
    expect(first).toMatchObject({ name: 'Standard Pack', unopened: true, items: [] });
    expect(second!.items).toEqual(opened.antes[1]!.packs[0]!.items);
    expect(formatAsTheSoulText(skipped)).toContain('Standard Pack - (not opened)\n');
  });
});

describe('tag previews', () => {
  it('equal the toggled analysis, Souls included', async () => {
    const engine = await loadTestEngine();
    const random = seededRandom(2026);
    let previews = 0;
    let souls = 0;
    for (let n = 0; n < 200; n++) {
      const settings = { ...BASE, seed: randomSeed(random), maxAnte: 4, cardsPerAnte: 10 };
      for (const ante of analyze(engine, settings).antes) {
        for (const preview of ante.tagPreviews ?? []) {
          const toggled = analyze(engine, { ...settings, actions: [skipBlind(ante.ante, preview.blind)] });
          const real = toggled.antes[ante.ante - 1]!.packs.find((p) => p.tag?.blind === preview.blind);

          expect(preview.pack).toEqual(real);
          previews++;
          souls += preview.pack.items.filter((i) => 'soul' in i && i.soul).length;
        }
      }
    }
    expect(previews).toBeGreaterThan(100);
    expect(souls).toBeGreaterThan(0);
  });

  it('a Soul in a taken tag pack is placed by its tag, as its preview showed (I6JP4JRB)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...BASE, seed: 'I6JP4JRB', maxAnte: 1 };

    const preview = analyze(engine, settings).antes[0]!.tagPreviews!.find((p) => p.blind === 'small')!;
    const taken = analyze(engine, { ...settings, actions: [skipBlind(1, 'small')] });

    const soul = taken.souls.find((s) => s.where === 'Charm Tag (skip Small Blind)');
    expect(soul).toMatchObject({ ante: 1, legendary: 'Perkeo' });
    expect(preview.pack.items.find((i) => i.kind !== 'joker' && i.kind !== 'playing' && i.soul)).toMatchObject({ soul: { legendary: 'Perkeo' } });
  });

  it('are only attached for pack tags whose blind is not skipped', async () => {
    const engine = await loadTestEngine();

    const played = analyze(engine, { ...BASE, maxAnte: 1 }).antes[0]!;
    const skipped = analyze(engine, { ...BASE, maxAnte: 1, actions: [skipBlind(1, 'small')] }).antes[0]!;

    expect(played.tagPreviews?.map((p) => [p.blind, p.tag, p.pack.name])).toEqual([['small', 'Charm Tag', 'Mega Arcana Pack']]);
    expect(skipped.tagPreviews).toEqual([]);
  });
});

function skipBlind(ante: number, blind: 'small' | 'big'): RunAction {
  return { kind: 'skipBlind', ante, blind };
}

function isNamed(item: Item, name: string): boolean {
  return item.kind !== 'playing' && item.name === name;
}

/** Non-Soul Spectral cards found in Arcana packs. */
function arcanaSpectrals(analysis: Analysis): string[] {
  return analysis.antes.flatMap((a) =>
    a.packs
      .filter((p) => p.type === 'Arcana Pack')
      .flatMap((p) => p.items.flatMap((i) => (i.kind === 'spectral' && i.name !== 'The Soul' ? [i.name] : []))),
  );
}
