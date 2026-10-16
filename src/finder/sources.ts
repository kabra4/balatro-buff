/**
 * Engine sources the finder can roll, as data (open/closed): per-ante values (voucher, tags) and
 * shop item readers. The fast path (check.ts) and the full-analysis occurrence builder both
 * iterate these tables, so a new source is one entry here (plus a slot kind that reads it).
 *
 * Independence (why a source can be rolled without the others, see plan.ts): every engine pool
 * (TAROTS, PLANETS, SPECTRALS, joker pools, VOUCHERS, TAGS, BOSSES) is name-disjoint from every
 * other (asserted in tests/finder/registry.test.ts), so a lock taken by one source never changes
 * another source's picks. If that test ever fails, the sources sharing names are no longer
 * independent and plan.ts must roll them together.
 */
import { toEdition } from '../engine/editions';
import { withHandle } from '../engine/instance';
import type { EngineInstance, ImmolateModule } from '../engine/loader';
import type { VoucherState } from '../engine/run';
import type { AnteResult, Item, Settings } from '../engine/types';

/** Base pack types as returned by the engine's `packInfo`. */
export const PACK_TYPES = ['Arcana Pack', 'Celestial Pack', 'Spectral Pack', 'Buffoon Pack', 'Standard Pack'] as const;
export type PackType = (typeof PACK_TYPES)[number];
/** Shop queue item types as rolled by the engine's `nextShopItem`. */
export type ShopItemType = 'Joker' | 'Tarot' | 'Planet' | 'Spectral';

/** Rolls one ante's values on the fast path. */
export type AnteRoller = (inst: EngineInstance, ante: number) => string[];

export interface AnteSourceSpec {
  /** Place label of each value, e.g. ["Small blind tag", "Big blind tag"]. */
  places: readonly string[];
  /** The same values from a full analysis. */
  fromAnte: (ante: AnteResult) => readonly string[];
  /**
   * Fast-path roller, created per seed (it may hold per-run state) and called in ante order 1, 2, …
   * `vouchers` is the seed's voucher state, shared with the rest of the fast path.
   */
  createRoller: (engine: ImmolateModule, settings: Settings, vouchers: VoucherState) => AnteRoller;
}

/** Fast-path roll of one shop item of a type, after its "cdt" type roll (same streams as nextShopItem). */
export type ShopReader = (inst: EngineInstance, ante: number) => Item;

const NO_STICKERS = Object.freeze({ eternal: false, perishable: false, rental: false });

/** In per-ante step order: cheapest first. */
export const ANTE_SOURCES = {
  voucher: {
    places: ['Voucher'],
    fromAnte: (a) => [a.voucher],
    // The finder's line buys every voucher; check.ts activates it when the game would.
    createRoller: (_engine, _settings, vouchers) => (inst, ante) => [vouchers.roll(inst, ante, true)],
  },
  tags: {
    places: ['Small blind tag', 'Big blind tag'],
    fromAnte: (a) => a.tags,
    // initUnlocks only touches boss and tag names, so it belongs to the tag source.
    createRoller: () => (inst, ante) => {
      inst.initUnlocks(ante, false);
      const first = inst.nextTag(ante);
      return [first, inst.nextTag(ante)];
    },
  },
} satisfies Record<string, AnteSourceSpec>;

export type AnteSource = keyof typeof ANTE_SOURCES;
export const ANTE_SOURCE_IDS = Object.keys(ANTE_SOURCES) as AnteSource[];

/** Shop readers by item type. Jokers skip stickers: those streams come after name/edition and feed nothing matched. */
export const SHOP_READERS: Partial<Record<ShopItemType, ShopReader>> = {
  Joker: (inst, ante) =>
    withHandle(inst.nextJoker('sho', ante, false), (jd) => ({
      kind: 'joker',
      name: jd.joker,
      edition: toEdition(jd.edition),
      stickers: NO_STICKERS,
    })),
  Spectral: (inst, ante) => ({ kind: 'spectral', name: inst.nextSpectral('sho', ante, false) }),
};
