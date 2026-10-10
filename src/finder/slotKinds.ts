/**
 * Slot-kind registry (open/closed): everything the finder knows about a requirement kind —
 * UI options and which engine sources can produce a matching occurrence — lives in one entry.
 * Adding a kind (Tarot, Planet, Boss…) = adding an entry here.
 */
import { EMPTY_POOL_JOKER, LEGENDARY_JOKERS, SPECTRAL_CARDS } from '../engine/constants';
import type { Edition, Item } from '../engine/types';
import { itemLayers, jokerLayers, tagLayers, voucherLayers, type Layer } from '../ui/sprites';
import { JOKER_POS, TAG_POS, VOUCHER_POS } from '../ui/spriteTables';
import type { AnteSource, PackType, ShopItemType } from './sources';
import type { FinderSettings, Slot, SlotKind, Where } from './types';

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

/** The sources that could yield an occurrence this slot accepts (given its item, where and the settings). */
export interface SlotSources {
  ante: readonly AnteSource[];
  shop: ShopSource | null;
  packs: readonly (readonly [PackType, ItemSource])[];
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
/** Shop and Buffoon jokers come from the rarity 1–3 pools: never a legendary. */
const POOL_JOKERS: readonly string[] = Object.keys(JOKER_POS).filter((name) => !(LEGENDARY_JOKERS as readonly string[]).includes(name));

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
      shop: { types: ['Joker'], facet: jokerFacet, names: POOL_JOKERS },
      packs: { 'Buffoon Pack': { facet: jokerFacet, names: POOL_JOKERS }, 'Arcana Pack': soulSource, 'Spectral Pack': soulSource },
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

export function slotSources(slot: Slot, settings: FinderSettings): SlotSources {
  const spec = SLOT_KINDS[slot.kind];
  const { ante = [], shop, packs = {} } = spec.occurrenceSources;
  const where = spec.hasWhere ? slot.where : 'any';
  const shopOk = shop && where !== 'packs' && canYield(shop, slot) && (shop.onlyIf?.settings(settings) ?? true);
  const packSources = where === 'shop' ? [] : (Object.entries(packs) as [PackType, ItemSource][]).filter(([, src]) => canYield(src, slot));
  return { ante, shop: shopOk ? shop : null, packs: packSources };
}

/** Whether choosing `where` for this slot could ever match (UI disables the rest). */
export function whereEnabled(slot: Slot, where: Where, settings: FinderSettings): boolean {
  return hasAnySource(slotSources({ ...slot, where }, settings));
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
  if (hasAnySource(slotSources(slot, settings))) return null;
  const shop = spec.occurrenceSources.shop;
  if (slot.where === 'shop' && shop?.onlyIf && canYield(shop, slot) && !shop.onlyIf.settings(settings)) return shop.onlyIf.hint;
  const what = slot.item ?? spec.label;
  return slot.where === 'any' ? `${what} can't appear in a run` : `${what} can't appear in the ${slot.where}`;
}

/** Blank slot of `kind` (keeps the deadline). */
export function blankSlot(id: string, kind: SlotKind, byAnte: number): Slot {
  return { id, kind, item: null, edition: 'any', where: 'any', byAnte };
}

function hasAnySource(sources: SlotSources): boolean {
  return sources.ante.length > 0 || sources.shop !== null || sources.packs.length > 0;
}

function canYield(source: ItemSource, slot: Slot): boolean {
  return slot.item === null || source.names === undefined || source.names.includes(slot.item);
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
