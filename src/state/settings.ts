import type { Settings } from '../engine/types';

export const MAX_ANTE_LIMIT = 20;
export const MAX_ANTE_OPTIONS = Array.from({ length: MAX_ANTE_LIMIT }, (_, i) => i + 1);
export const CARDS_PER_ANTE_OPTIONS = [10, 25, 50, 100, 200] as const;

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  seed: '',
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  maxAnte: 8,
  cardsPerAnte: 50,
  showman: false,
  locked: [],
});
