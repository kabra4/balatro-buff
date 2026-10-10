import type { Analysis, Settings } from '../engine/types';
import { matchSlots } from './match';
import { occurrencesFrom } from './occurrences';
import { seedSettings } from './query';
import type { Verifier } from './searchController';

/** Hit verification by full analysis (e.g. page 1's engine worker) + matchSlots. */
export function createVerifier(analyze: (settings: Settings) => Promise<Analysis>): Verifier {
  return async (query, seed) => matchSlots(query.slots, occurrencesFrom(await analyze(seedSettings(query, seed))));
}
