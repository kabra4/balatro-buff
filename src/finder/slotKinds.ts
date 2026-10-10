/**
 * Slot-kind registry (open/closed): everything the finder knows about a requirement kind —
 * UI options and which engine sources can produce a matching occurrence — lives in one entry.
 * Adding a kind (Tarot, Planet, Boss…) = adding an entry here.
 */
import { EMPTY_POOL_JOKER, LEGENDARY_JOKERS, SPECTRAL_CARDS } from '../engine/constants';
import type { Edition, Item } from '../engine/types';
import { itemLayers, jokerLayers, tagLayers, voucherLayers, type Layer } from '../ui/sprites';
import { JOKER_POS, TAG_POS, VOUCHER_POS } from '../ui/spriteTables';
import type { FinderSettings, Slot, SlotKind, Where } from './types';

/** Base pack types as returned by the engine's `packInfo`. */
export type PackType = 'Arcana Pack' | 'Celestial Pack' | 'Spectral Pack' | 'Buffoon Pack' | 'Standard Pack';
/** Shop queue item types as rolled by the engine's `nextShopItem`. */
export type ShopItemType = 'Joker' | 'Tarot' | 'Planet' | 'Spectral';
/** Once-per-ante values. */
export type AnteSource = 'voucher' | 'tags';

/** How one concrete card looks to a slot kind. */
export interface Facet {
  name: string;
  edition: Edition;
}

export interface ItemSource {
  /** This kind's view of an item from the source, or null when the item is not of this kind. */
  facet: (item: Item) => Facet | null;
  /** The only names the source can yield for this kind (the plan skips it for other items). Omit = any. */
  names?: readonly string[];
  /** The facet comes from Soul resolution (`item.soul`), so every Soul up to that ante must be rolled. */
  soul?: boolean;
}

export interface ShopSource extends ItemSource {
  /** Engine shop item types that can yield this kind. */
  types: readonly ShopItemType[];
  /** When the shop can yield this kind only under some settings (default: always). */
  onlyIf?: { settings: (settings: FinderSettings) => boolean; hint: string };
}

export interface OccurrenceSources {
  ante?: readonly AnteSource[];
  shop?: ShopSource;
  packs?: Partial<Record<PackType, ItemSource>>;
}

export interface SlotKindSpec {
  label: string;
  itemOptions: readonly string[];
  itemLayers: (name: string) => Layer[];
  /** An "Any" item is allowed (otherwise the slot needs a concrete item). */
  allowsAny: boolean;
  /** Label of the "Any" choice (default "Any <label>"). */
  anyLabel?: string;
  hasEdition: boolean;
  hasWhere: boolean;
  occurrenceSources: OccurrenceSources;
}

/** Legendary a Soul yields, or plain Joker once all five are owned. */
const SOUL_YIELDS: readonly string[] = [...LEGENDARY_JOKERS, EMPTY_POOL_JOKER];

const soulSource: ItemSource = { facet: soulFacet, names: SOUL_YIELDS, soul: true };

export const SLOT_KINDS: Readonly<Record<SlotKind, SlotKindSpec>> = {
  joker: {
    label: 'Joker',
    itemOptions: Object.keys(JOKER_POS).sort(byName),
    itemLayers: jokerLayers,
    allowsAny: true,
    hasEdition: true,
    hasWhere: true,
    occurrenceSources: {
      shop: { types: ['Joker'], facet: jokerFacet },
      packs: { 'Buffoon Pack': { facet: jokerFacet }, 'Arcana Pack': soulSource, 'Spectral Pack': soulSource },
    },
  },
  soul: {
    label: 'The Soul',
    itemOptions: LEGENDARY_JOKERS,
    itemLayers: jokerLayers,
    allowsAny: true,
    anyLabel: 'Any legendary',
    hasEdition: false,
    hasWhere: true,
    occurrenceSources: { packs: { 'Arcana Pack': soulSource, 'Spectral Pack': soulSource } },
  },
  spectral: {
    label: 'Spectral',
    itemOptions: SPECTRAL_CARDS,
    itemLayers: (name) => itemLayers({ kind: 'spectral', name }),
    allowsAny: true,
    hasEdition: false,
    hasWhere: true,
    occurrenceSources: {
      shop: { types: ['Spectral'], facet: spectralFacet, onlyIf: { settings: (s) => s.deck === 'Ghost Deck', hint: 'Shop spectrals need the Ghost Deck' } },
      packs: {
        'Spectral Pack': { facet: spectralFacet },
        'Arcana Pack': { facet: spectralFacet, names: ['The Soul'] },
        'Celestial Pack': { facet: spectralFacet, names: ['Black Hole'] },
      },
    },
  },
  voucher: {
    label: 'Voucher',
    itemOptions: Object.keys(VOUCHER_POS),
    itemLayers: voucherLayers,
    allowsAny: false,
    hasEdition: false,
    hasWhere: false,
    occurrenceSources: { ante: ['voucher'] },
  },
  tag: {
    label: 'Tag',
    itemOptions: Object.keys(TAG_POS),
    itemLayers: tagLayers,
    allowsAny: false,
    hasEdition: false,
    hasWhere: false,
    occurrenceSources: { ante: ['tags'] },
  },
};

export const SLOT_KIND_IDS = Object.keys(SLOT_KINDS) as SlotKind[];

/** Whether a `where` choice can ever match for this kind under these settings. */
export function whereEnabled(kind: SlotKind, where: Where, settings: FinderSettings): boolean {
  const { shop, packs } = SLOT_KINDS[kind].occurrenceSources;
  if (where === 'shop') return shop !== undefined && (shop.onlyIf?.settings(settings) ?? true);
  if (where === 'packs') return packs !== undefined;
  return true;
}

export function anyLabel(kind: SlotKind): string {
  const spec = SLOT_KINDS[kind];
  return spec.anyLabel ?? `Any ${spec.label.toLowerCase()}`;
}

/** Why the slot can't be searched as is, or null when it is fine. */
export function slotProblem(slot: Slot, settings: FinderSettings): string | null {
  const spec = SLOT_KINDS[slot.kind];
  if (slot.item === null && !spec.allowsAny) return `Pick a ${spec.label.toLowerCase()}`;
  if (slot.item !== null && !spec.itemOptions.includes(slot.item)) return `Unknown ${spec.label.toLowerCase()} "${slot.item}"`;
  if (spec.hasWhere && !whereEnabled(slot.kind, slot.where, settings)) {
    const hint = slot.where === 'shop' ? spec.occurrenceSources.shop?.onlyIf?.hint : undefined;
    return hint ?? `${spec.label} can't appear in the ${slot.where}`;
  }
  return null;
}

/** Blank slot of `kind` (keeps the deadline). */
export function blankSlot(id: string, kind: SlotKind, byAnte: number): Slot {
  return { id, kind, item: null, edition: 'any', where: 'any', byAnte };
}

function jokerFacet(item: Item): Facet | null {
  return item.kind === 'joker' ? { name: item.name, edition: item.edition } : null;
}

function spectralFacet(item: Item): Facet | null {
  return item.kind === 'spectral' ? { name: item.name, edition: null } : null;
}

/** The legendary a Soul card yields (set by Soul resolution). */
function soulFacet(item: Item): Facet | null {
  return item.kind !== 'joker' && item.kind !== 'playing' && item.soul ? { name: item.soul.legendary, edition: item.soul.edition } : null;
}

function byName(a: string, b: string): number {
  return a.localeCompare(b);
}
