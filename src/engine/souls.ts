/**
 * Resolves which Legendary joker each "The Soul" card yields.
 *
 * Walks Souls in order of appearance (ante asc; shop then packs, queue order) and calls
 * `nextJoker('sou', ante, false)` for each. Unless Showman is on, the received legendary is
 * locked — the player owns it, so the game excludes it from the pool for the next Soul.
 * Once all legendaries are owned the pool is empty and Balatro falls back to plain "Joker"
 * (the engine would instead return a locked legendary after 1000 resamples); the edition
 * roll still happens.
 * Runs on a separate Instance with the same setup: only the `Joker4*` / `edisou<ante>` streams
 * are consumed, which the main pass never touches, so main-pass output is unaffected either way.
 */
import { EMPTY_POOL_JOKER, LEGENDARY_JOKERS, SOUL_CARD } from './constants';
import { toEdition } from './editions';
import { createInstance, withHandle } from './instance';
import type { ImmolateModule } from './loader';
import type { AnteResult, ConsumableKind, Item, Settings, SoulLocation, SoulResult } from './types';

type ConsumableItem = Extract<Item, { kind: ConsumableKind }>;

interface SoulSite {
  ante: number;
  item: ConsumableItem;
  where: string;
}

/** Sets `item.soul` on every Soul card in `antes` (mutates) and returns the Souls in order. */
export function resolveSouls(engine: ImmolateModule, s: Settings, antes: AnteResult[]): SoulLocation[] {
  const sites = findSoulSites(antes);
  if (sites.length === 0) return [];
  const inst = createInstance(engine, s);
  try {
    const owned = new Set<string>();
    return sites.map(({ ante, item, where }, i) => {
      const allOwned = !s.showman && LEGENDARY_JOKERS.every((name) => owned.has(name));
      const roll = withHandle(inst.nextJoker('sou', ante, false), (jd) => ({
        legendary: jd.joker,
        edition: toEdition(jd.edition),
      }));
      const soul: SoulResult = allOwned
        ? { index: i + 1, legendary: EMPTY_POOL_JOKER, edition: roll.edition, allOwned: true }
        : { index: i + 1, ...roll };
      if (!s.showman && !allOwned) {
        inst.lock(roll.legendary);
        owned.add(roll.legendary);
      }
      item.soul = soul;
      return { ...soul, ante, where };
    });
  } finally {
    inst.delete();
  }
}

export function isSoulCard(item: Item): item is ConsumableItem {
  return item.kind !== 'joker' && item.kind !== 'playing' && item.name === SOUL_CARD;
}

function findSoulSites(antes: AnteResult[]): SoulSite[] {
  const sites: SoulSite[] = [];
  for (const { ante, shop, packs } of antes) {
    shop.forEach((item, q) => {
      if (isSoulCard(item)) sites.push({ ante, item, where: `Shop #${q + 1}` });
    });
    packs.forEach((pack, p) => {
      for (const item of pack.items) {
        if (isSoulCard(item)) sites.push({ ante, item, where: `${pack.name} (pack ${p + 1})` });
      }
    });
  }
  return sites;
}
