import { describe, expect, it } from 'vitest';
import { analyze, cardsForAnte } from '../src/engine/analyze';
import { UNLOCK_OPTIONS } from '../src/engine/constants';
import { formatAsTheSoulText } from '../src/engine/format';
import type { Settings } from '../src/engine/types';
import { loadTestEngine } from './helpers/engine';
import { theSoulReferenceText } from './helpers/theSoulReference';

const BASE: Settings = {
  seed: 'ALEEB',
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  maxAnte: 8,
  cardsPerAnte: 50,
  showman: false,
  locked: [],
};

/** `mustContain` guards against a vacuous pass: the case must actually exercise those outputs. */
const CASES: { name: string; settings: Settings; mustContain?: string[] }[] = [
  { name: 'Red Deck / White Stake / 1.0.1f', settings: BASE },
  {
    name: 'Ghost Deck / Gold Stake / 1.0.0n',
    settings: { ...BASE, seed: '8Q47WV6K', deck: 'Ghost Deck', stake: 'Gold Stake', version: 10014, cardsPerAnte: 25 },
    mustContain: ['Eternal', 'Spectral Pack'],
  },
  {
    name: 'Ghost Deck / Gold Stake / 1.0.1f',
    settings: { ...BASE, seed: 'GHOSTLY', deck: 'Ghost Deck', stake: 'Gold Stake', version: 10106, maxAnte: 10 },
    mustContain: ['Eternal', 'Perishable', 'Rental', 'Seal', 'Negative', 'Polychrome', 'Spectral Pack', 'Standard Pack'],
  },
  {
    name: 'Zodiac Deck / Orange Stake / 1.0.1c with locked unlocks',
    settings: {
      ...BASE,
      seed: 'TUTORIAL',
      deck: 'Zodiac Deck',
      stake: 'Orange Stake',
      version: 10103,
      maxAnte: 12,
      cardsPerAnte: 100,
      locked: ['Negative Tag', 'Showman', 'Overstock Plus', 'Glow Up', 'Tarot Tycoon', 'Blueprint'],
    },
  },
  {
    name: 'Magic Deck / Black Stake / 1.0.0n, everything locked',
    settings: { ...BASE, seed: '1234ABCD', deck: 'Magic Deck', stake: 'Black Stake', version: 10014, maxAnte: 9, cardsPerAnte: 10, locked: [...UNLOCK_OPTIONS] },
  },
];

describe('parity with TheSoul text output', () => {
  it.each(CASES)('$name', async ({ settings, mustContain = [] }) => {
    const engine = await loadTestEngine();
    const reference = theSoulReferenceText(engine, {
      ante: settings.maxAnte,
      cardsPerAnte: Array.from({ length: settings.maxAnte }, (_, i) => cardsForAnte(i + 1, settings.cardsPerAnte)),
      deck: settings.deck,
      stake: settings.stake,
      version: settings.version,
      seed: settings.seed,
      options: UNLOCK_OPTIONS,
      selectedOptions: UNLOCK_OPTIONS.map((o) => !settings.locked.includes(o)),
    });

    const ours = formatAsTheSoulText(analyze(engine, settings));

    expect(reference).toContain(`==ANTE ${settings.maxAnte}==`);
    for (const text of mustContain) expect(reference).toContain(text);
    expect(ours).toBe(reference);
  });

  it('caps ante 1 shop at 15 cards', () => {
    expect(cardsForAnte(1, 200)).toBe(15);
    expect(cardsForAnte(1, 10)).toBe(10);
    expect(cardsForAnte(2, 200)).toBe(200);
  });
});
