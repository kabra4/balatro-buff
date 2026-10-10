import { describe, expect, it } from 'vitest';
import { analyze, createAnalysisStepper } from '../../src/engine/analyze';
import type { EmVector } from '../../src/engine/loader';
import { blankSlot, SLOT_KIND_IDS, SLOT_KINDS, slotProblem, whereEnabled } from '../../src/finder/slotKinds';
import { DEFAULT_SETTINGS } from '../../src/state/settings';
import { loadTestEngine } from '../helpers/engine';
import { BASE_SETTINGS } from './queries';

describe('slot-kind registry', () => {
  it('item lists match the engine pools', async () => {
    const engine = (await loadTestEngine()) as unknown as Record<string, EmVector<string>>;
    const names = (key: string) => Array.from({ length: engine[key]!.size() }, (_, i) => engine[key]!.get(i));
    const sorted = (xs: readonly string[]) => [...xs].sort();

    const jokers = ['COMMON_JOKERS', 'UNCOMMON_JOKERS', 'RARE_JOKERS', 'LEGENDARY_JOKERS'].flatMap(names);
    expect(sorted(SLOT_KINDS.joker.itemOptions)).toEqual(sorted(jokers));
    expect(sorted(SLOT_KINDS.soul.itemOptions)).toEqual(sorted(names('LEGENDARY_JOKERS')));
    expect(sorted(SLOT_KINDS.voucher.itemOptions)).toEqual(sorted(names('VOUCHERS')));
    expect(sorted(SLOT_KINDS.tag.itemOptions)).toEqual(sorted(names('TAGS')));
    const spectrals = names('SPECTRALS').filter((n) => n !== 'RETRY');
    expect(sorted(SLOT_KINDS.spectral.itemOptions)).toEqual(sorted([...spectrals, 'The Soul', 'Black Hole']));
  });

  it('every kind has sprites for its items', () => {
    for (const kind of SLOT_KIND_IDS) {
      for (const item of SLOT_KINDS[kind].itemOptions) expect(SLOT_KINDS[kind].itemLayers(item).length, `${kind} ${item}`).toBeGreaterThan(0);
    }
  });

  it('validates slots: required items, unknown items, impossible where', () => {
    const ghost = { ...BASE_SETTINGS, deck: 'Ghost Deck' };
    expect(slotProblem(blankSlot('a', 'voucher', 2), BASE_SETTINGS)).toMatch(/Pick a voucher/);
    expect(slotProblem(blankSlot('a', 'tag', 2), BASE_SETTINGS)).toMatch(/Pick a tag/);
    expect(slotProblem({ ...blankSlot('a', 'joker', 2), item: 'Nope' }, BASE_SETTINGS)).toMatch(/Unknown/);
    const shopSpectral = { ...blankSlot('a', 'spectral', 2), where: 'shop' as const };
    expect(slotProblem(shopSpectral, BASE_SETTINGS)).toBe('Shop spectrals need the Ghost Deck');
    expect(slotProblem(shopSpectral, ghost)).toBeNull();
    expect(whereEnabled('soul', 'shop', ghost)).toBe(false);
    expect(slotProblem(blankSlot('a', 'joker', 2), BASE_SETTINGS)).toBeNull();
  });
});

describe('analysis stepper', () => {
  it('yields antes 1..maxAnte then null, identical to analyze()', async () => {
    const engine = await loadTestEngine();
    const settings = { ...DEFAULT_SETTINGS, seed: 'STEPPER', maxAnte: 3, cardsPerAnte: 10 };
    const stepper = createAnalysisStepper(engine, settings);
    const antes = [stepper.next(), stepper.next(), stepper.next()];
    expect(stepper.next()).toBeNull();
    stepper.dispose();
    stepper.dispose();
    expect(stepper.next()).toBeNull();

    const full = analyze(engine, settings);
    // analyze() also resolves Souls (adds `soul` to Soul cards); compare without it.
    const strip = (x: unknown) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'soul' ? undefined : v)));
    expect(strip(antes)).toEqual(strip(full.antes));
  });
});
