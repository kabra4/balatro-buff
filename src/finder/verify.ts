import type { Analysis, RunAction, Settings } from '../engine/types';
import { serializeActions } from '../state/actions';
import { matchSlots, type Occurrence } from './match';
import { occurrencesFrom } from './occurrences';
import { seedSettings, skipActions } from './query';
import type { Verifier } from './searchController';
import type { FinderQuery } from './types';

/** Re-analyses with matched skips before a hit whose tag packs don't add up is rejected. */
const MAX_SKIP_ROUNDS = 3;

/**
 * Hit verification by full analysis (e.g. page 1's engine worker) + matchSlots. Tag-pack previews
 * are matched as if each blind were skipped on its own; when a match uses any, the seed is
 * re-analyzed with those blinds skipped (the real line) and must match there using exactly the
 * skips it was analyzed with — else the next round tries the skips that match used.
 */
export function createVerifier(analyze: (settings: Settings) => Promise<Analysis>): Verifier {
  return async (query, seed) => {
    let actions: RunAction[] = [];
    for (let round = 0; round <= MAX_SKIP_ROUNDS; round++) {
      const matches = await matchLine(analyze, query, seed, actions);
      if (matches === null) return null;
      const skips = skipActions(matches);
      if (serializeActions(skips) === serializeActions(actions)) return matches;
      actions = skips;
    }
    return null;
  };
}

async function matchLine(
  analyze: (settings: Settings) => Promise<Analysis>,
  query: FinderQuery,
  seed: string,
  actions: readonly RunAction[],
): Promise<Map<string, Occurrence> | null> {
  return matchSlots(query.slots, occurrencesFrom(await analyze({ ...seedSettings(query, seed), actions })));
}
