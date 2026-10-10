import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/analyze';
import type { ImmolateModule } from '../src/engine/loader';
import { isSoulCard } from '../src/engine/souls';
import type { Analysis, Item, Settings } from '../src/engine/types';
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

  it('never repeats a legendary without Showman, although the unlocked pool would', async () => {
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

  it('rolls the edition from the Soul’s own ante stream', async () => {
    const engine = await loadTestEngine();
    const analysis = analyze(engine, SETTINGS);
    const first = analysis.souls[0]!;

    const [sameAnte] = directSoulRolls(engine, SETTINGS, [first.ante], true);

    expect(first.edition).toBe(sameAnte!.edition);
  });
});

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
