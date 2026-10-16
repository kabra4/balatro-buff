import type { RunAction, Settings, ShopCaps } from '../engine/types';
import { DEFAULT_SETTINGS } from '../state/settings';
import { serialize } from '../state/url';
import type { Occurrence } from './match';
import type { FinderQuery } from './types';

/** Early antes have little money for rerolls: only the first 10 (ante 1) / 30 (ante 2) shop cards count. */
export const FINDER_SHOP_CAPS: ShopCaps = { 1: 10, 2: 30 };

/** Highest deadline among the slots — the number of antes a check needs. */
export function horizonOf(query: FinderQuery): number {
  return Math.max(0, ...query.slots.map((s) => s.byAnte));
}

/** Analyzer settings for `seed` under `query`, analyzing through the query's horizon (default line: no actions). */
export function seedSettings(query: FinderQuery, seed: string): Settings {
  return { ...query.settings, locked: [...query.settings.locked], seed, maxAnte: horizonOf(query), shopCaps: FINDER_SHOP_CAPS };
}

/** The blind skips that matched tag-pack occurrences need. */
export function skipActions(matches: ReadonlyMap<string, Occurrence>): RunAction[] {
  return [...matches.values()].flatMap((o) => (o.skip ? [{ kind: 'skipBlind' as const, ...o.skip }] : []));
}

/**
 * Page-1 link (page-1 URL format) showing `seed` with the query's settings and the analyzer's default
 * antes, on the line where the blinds of matched tag packs are skipped.
 */
export function analyzerHref(query: FinderQuery, seed: string, matches: ReadonlyMap<string, Occurrence>): string {
  return `./index.html?${serialize({ ...seedSettings(query, seed), maxAnte: DEFAULT_SETTINGS.maxAnte, actions: skipActions(matches) })}`;
}
