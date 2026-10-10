/**
 * Fast-path plan: which engine streams a query needs, through which ante, derived from the
 * slot-kind registry. RNG streams are keyed per ante ("Tag3", "shop_pack2", "cdt5", …) and
 * independent except through shared Instance state, so each step can be skipped on its own:
 *
 * - voucher: "Voucher<a>" + voucher locks (lock rolled voucher, unlock its upgrade). Voucher names
 *   are in no other pool, and isVoucherActive() reads params.vouchers (set by setDeck only).
 * - tags:    initUnlocks(a) + "Tag<a>" ×2. initUnlocks only touches boss and tag names.
 * - packs:   "shop_pack<a>" + cache.generatedFirstPack for every pack; contents only for the pack
 *   types needed. Each type has its own streams (soul_Tarot/Tarotar1, soul_Spectral/Spectralspe,
 *   soul_Planet/Planetpl1, …buf…); in-pack dedupe locks are released at the end of the pack, and
 *   names a pack could release early (showman) are never read by other pools (no RETRY in joker pools).
 * - shop:    "cdt<a>" for every queue slot; only item types a slot can match are rolled further.
 *   Shop jokers are rolled without stickers (sticker streams come after name/edition and feed
 *   nothing we match on).
 * - boss:    never needed ("boss" stream + boss-name locks only).
 *
 * Every step runs on a prefix of antes 1..through, because streams are sequential across antes
 * (voucher locks, initUnlocks, generatedFirstPack, the global Soul stream "Joker4").
 */
import type { FinderQuery, Slot } from './types';
import { SLOT_KINDS, type ItemSource, type PackType, type ShopItemType } from './slotKinds';

export type StepId = 'voucher' | 'tags' | 'packs' | 'shop';

/** Per-ante step order: cheapest first, so deadlines can reject before the expensive shop. */
export const STEP_ORDER: readonly StepId[] = ['voucher', 'tags', 'packs', 'shop'];

/**
 * Packs whose cards can be The Soul (functions.hpp: soulable nextTarot in Arcana, nextSpectral in
 * Spectral packs; shop rolls are never soulable). Souls resolve in order of appearance, so all
 * of these are rolled through the last ante any Soul-derived slot needs.
 */
export const SOUL_PACK_TYPES: readonly PackType[] = ['Arcana Pack', 'Spectral Pack'];

export interface PlannedSlot {
  slot: Slot;
  /** Index in STEP_ORDER after which, in ante `byAnte`, the slot has seen every candidate. -1 = can never match. */
  lastStep: number;
}

export interface Plan {
  /** Highest deadline = last ante to evaluate. */
  horizon: number;
  /** Last ante (inclusive) each step runs through; 0 = never. */
  through: Record<StepId, number>;
  /** Pack contents to roll, by base type → through ante. */
  packTypes: ReadonlyMap<PackType, number>;
  /** Shop item types to roll beyond "cdt" → through ante. */
  shopTypes: ReadonlyMap<ShopItemType, number>;
  /** Resolve Souls through this ante; 0 = never. */
  souls: number;
  slots: PlannedSlot[];
  /** Some slot has no possible source — the query can never match. */
  impossible: boolean;
}

interface SlotNeeds {
  steps: Set<StepId>;
  packTypes: Set<PackType>;
  shopTypes: Set<ShopItemType>;
  souls: boolean;
}

export function buildPlan(query: FinderQuery): Plan {
  const through: Record<StepId, number> = { voucher: 0, tags: 0, packs: 0, shop: 0 };
  const packTypes = new Map<PackType, number>();
  const shopTypes = new Map<ShopItemType, number>();
  let souls = 0;
  const slots = query.slots.map((slot): PlannedSlot => {
    const needs = slotNeeds(slot, query);
    const a = slot.byAnte;
    for (const step of needs.steps) through[step] = Math.max(through[step], a);
    for (const type of needs.packTypes) packTypes.set(type, Math.max(packTypes.get(type) ?? 0, a));
    for (const type of needs.shopTypes) shopTypes.set(type, Math.max(shopTypes.get(type) ?? 0, a));
    if (needs.souls) souls = Math.max(souls, a);
    return { slot, lastStep: Math.max(-1, ...[...needs.steps].map((s) => STEP_ORDER.indexOf(s))) };
  });
  return {
    horizon: Math.max(0, ...query.slots.map((s) => s.byAnte)),
    through,
    packTypes,
    shopTypes,
    souls,
    slots,
    impossible: slots.some((p) => p.lastStep < 0),
  };
}

function slotNeeds(slot: Slot, { settings }: FinderQuery): SlotNeeds {
  const spec = SLOT_KINDS[slot.kind];
  const { ante = [], shop, packs = {} } = spec.occurrenceSources;
  const needs: SlotNeeds = { steps: new Set(ante), packTypes: new Set(), shopTypes: new Set(), souls: false };
  const where = spec.hasWhere ? slot.where : 'any';
  if (shop && where !== 'packs' && (shop.onlyIf?.settings(settings) ?? true) && canYield(shop, slot)) {
    needs.steps.add('shop');
    for (const type of shop.types) needs.shopTypes.add(type);
  }
  if (where !== 'shop') {
    for (const [type, source] of Object.entries(packs) as [PackType, ItemSource][]) {
      if (!canYield(source, slot)) continue;
      needs.steps.add('packs');
      needs.packTypes.add(type);
      needs.souls ||= source.soul === true;
    }
  }
  if (needs.souls) for (const type of SOUL_PACK_TYPES) needs.packTypes.add(type);
  return needs;
}

function canYield(source: ItemSource, slot: Slot): boolean {
  return slot.item === null || source.names === undefined || source.names.includes(slot.item);
}
