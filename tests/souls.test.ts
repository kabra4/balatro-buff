import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/analyze';
import type { ImmolateModule } from '../src/engine/loader';
import { LEGENDARY_JOKERS } from '../src/engine/constants';
import { isSoulCard, resolveSouls } from '../src/engine/souls';
import type { Analysis, AnteResult, Item, Settings } from '../src/engine/types';
import { loadTestEngine } from './helpers/engine';

/** Found by scanning random seeds: 3 Souls in antes 1–8 and, without locking, Yorick would repeat. */
const SOUL_SEED = 'N9LXVGLM';

const SETTINGS: Settings = {
  seed: SOUL_SEED,
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  maxAnte: 8,
  cardsPerAnte: 50,
  showman: false,
  locked: [],
};

describe('Soul → Legendary resolution', () => {
  it('finds every Soul in appearance order with the expected legendaries', async () => {
    const analysis = analyze(await loadTestEngine(), SETTINGS);

    expect(analysis.souls.map((s) => [s.index, s.ante, s.legendary, s.where])).toEqual([
      [1, 2, 'Triboulet', 'Jumbo Arcana Pack (pack 3)'],
      [2, 4, 'Yorick', 'Arcana Pack (pack 4)'],
      [3, 8, 'Perkeo', 'Arcana Pack (pack 3)'],
    ]);
  });

  it('matches direct engine calls, locking each received legendary', async () => {
    const engine = await loadTestEngine();
    const analysis = analyze(engine, SETTINGS);

    const direct = directSoulRolls(engine, SETTINGS, analysis.souls.map((s) => s.ante), true);

    expect(analysis.souls.map((s) => ({ legendary: s.legendary, edition: s.edition }))).toEqual(direct);
  });

  it('does not repeat a legendary without Showman while some are still unowned', async () => {
    const engine = await loadTestEngine();
    const analysis = analyze(engine, SETTINGS);
    const legendaries = analysis.souls.map((s) => s.legendary);

    const unlockedPool = directSoulRolls(engine, SETTINGS, analysis.souls.map((s) => s.ante), false);

    expect(new Set(legendaries).size).toBe(legendaries.length);
    expect(unlockedPool.map((r) => r.legendary)).toEqual(['Triboulet', 'Yorick', 'Yorick']);
  });

  it('with Showman keeps duplicates possible (no locking)', async () => {
    const engine = await loadTestEngine();
    const settings = { ...SETTINGS, showman: true };
    const analysis = analyze(engine, settings);

    const direct = directSoulRolls(engine, settings, analysis.souls.map((s) => s.ante), false);

    expect(analysis.souls.length).toBeGreaterThanOrEqual(2);
    expect(analysis.souls.map((s) => ({ legendary: s.legendary, edition: s.edition }))).toEqual(direct);
  });

  it('attaches each result to the Soul card in the ante it appeared in', async () => {
    const analysis = analyze(await loadTestEngine(), SETTINGS);

    const cards = soulCardsByAnte(analysis);

    expect(cards.map(({ ante, item }) => [ante, item.soul?.index, item.soul?.legendary])).toEqual(
      analysis.souls.map((s) => [s.ante, s.index, s.legendary]),
    );
  });

  it('falls back to plain Joker once all five legendaries are owned (Showman off)', async () => {
    const engine = await loadTestEngine();
    const antes = [syntheticAnte(1, 4), syntheticAnte(2, 3)];

    const souls = resolveSouls(engine, SETTINGS, antes);

    const direct = directSoulRolls(engine, SETTINGS, souls.map((s) => s.ante), true);
    expect(souls).toHaveLength(7);
    expect(new Set(souls.slice(0, 5).map((s) => s.legendary))).toEqual(new Set(LEGENDARY_JOKERS));
    expect(souls.slice(0, 5).every((s) => !s.allOwned)).toBe(true);
    expect(souls.slice(5).map((s) => [s.legendary, s.allOwned])).toEqual([
      ['Joker', true],
      ['Joker', true],
    ]);
    // The engine itself would hand out an already-owned legendary here: that is the bug guarded against.
    expect(LEGENDARY_JOKERS as readonly string[]).toContain(direct[5]!.legendary);
    // The edition roll still happens, in the Soul's own ante stream.
    expect(souls.map((s) => s.edition)).toEqual(direct.map((d) => d.edition));
  });

  it('with Showman never falls back to plain Joker', async () => {
    const engine = await loadTestEngine();

    const souls = resolveSouls(engine, { ...SETTINGS, showman: true }, [syntheticAnte(1, 7)]);

    expect(souls.every((s) => !s.allOwned && (LEGENDARY_JOKERS as readonly string[]).includes(s.legendary))).toBe(true);
  });

  it('rolls the edition from the Soul’s own ante stream', async () => {
    const engine = await loadTestEngine();
    const analysis = analyze(engine, SETTINGS);
    const first = analysis.souls[0]!;

    const [sameAnte] = directSoulRolls(engine, SETTINGS, [first.ante], true);

    expect(first.edition).toBe(sameAnte!.edition);
  });
});

/** An ante whose shop holds `souls` Soul cards and nothing else. */
function syntheticAnte(ante: number, souls: number): AnteResult {
  return {
    ante,
    boss: 'The Hook',
    voucher: 'Hone',
    tags: ['Rare Tag', 'Foil Tag'],
    shop: Array.from({ length: souls }, (): Item => ({ kind: 'spectral', name: 'The Soul' })),
    packs: [],
  };
}

/** Raw engine calls, independent of src/engine/souls.ts. */
function directSoulRolls(engine: ImmolateModule, s: Settings, antes: number[], lock: boolean) {
  const inst = new engine.Instance(s.seed);
  const params = new engine.InstParams(s.deck, s.stake, s.showman, s.version);
  inst.params = params;
  params.delete();
  const rolls = antes.map((ante) => {
    const jd = inst.nextJoker('sou', ante, false);
    const roll = { legendary: jd.joker, edition: jd.edition === 'No Edition' ? null : jd.edition };
    if (lock) inst.lock(jd.joker);
    jd.delete();
    return roll;
  });
  inst.delete();
  return rolls;
}

function soulCardsByAnte(analysis: Analysis) {
  const out: { ante: number; item: Extract<Item, { kind: 'tarot' | 'planet' | 'spectral' }> }[] = [];
  for (const a of analysis.antes) {
    for (const item of [...a.shop, ...a.packs.flatMap((p) => p.items)]) {
      if (isSoulCard(item)) out.push({ ante: a.ante, item });
    }
  }
  return out;
}
