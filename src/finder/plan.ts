/**
 * Fast-path plan: which engine streams a query needs, through which ante, derived from the
 * slot-kind registry. RNG streams are keyed per ante ("Tag3", "shop_pack2", "cdt5", …) and
 * independent except through shared Instance state, so each step can be skipped on its own:
 *
 * - voucher: "Voucher<a>" + voucher locks (lock rolled voucher, unlock its upgrade). Voucher names
 *   are in no other pool (all engine pools are name-disjoint — asserted in registry.test.ts), and
 *   isVoucherActive() reads params.vouchers (set by setDeck only).
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
import { horizonOf } from './query';
import { SLOT_KIND_IDS, SLOT_KINDS, slotSources, type ItemSource } from './slotKinds';
import { ANTE_SOURCE_IDS, type AnteSource, type PackType, type ShopItemType } from './sources';
import type { FinderQuery, Slot } from './types';

export type StepId = AnteSource | 'packs' | 'shop';

/** Per-ante step order: cheap ante values first, the expensive shop last, so deadlines reject early. */
export const STEP_ORDER: readonly StepId[] = [...ANTE_SOURCE_IDS, 'packs', 'shop'];

/**
 * Packs whose cards can carry a Soul-derived facet (registry sources flagged `soul`: Arcana and
 * Spectral — functions.hpp rolls soulable cards only there; shop rolls are never soulable).
 * Souls resolve in order of appearance, so all of these are rolled through the last ante any
 * Soul-derived slot needs.
 */
export const SOUL_PACK_TYPES: readonly PackType[] = soulPackTypes();

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
  const through = Object.fromEntries(STEP_ORDER.map((step) => [step, 0])) as Record<StepId, number>;
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
  return { horizon: horizonOf(query), through, packTypes, shopTypes, souls, slots, impossible: slots.some((p) => p.lastStep < 0) };
}

function slotNeeds(slot: Slot, { settings }: FinderQuery): SlotNeeds {
  const sources = slotSources(slot, settings);
  const needs: SlotNeeds = { steps: new Set(sources.ante), packTypes: new Set(), shopTypes: new Set(), souls: false };
  if (sources.shop) {
    needs.steps.add('shop');
    for (const type of sources.shop.types) needs.shopTypes.add(type);
  }
  for (const [type, source] of sources.packs) {
    needs.steps.add('packs');
    needs.packTypes.add(type);
    needs.souls ||= source.soul === true;
  }
  if (needs.souls) for (const type of SOUL_PACK_TYPES) needs.packTypes.add(type);
  return needs;
}

function soulPackTypes(): PackType[] {
  const types = new Set<PackType>();
  for (const kind of SLOT_KIND_IDS) {
    const packs = SLOT_KINDS[kind].occurrenceSources.packs ?? {};
    for (const [type, source] of Object.entries(packs) as [PackType, ItemSource][]) if (source.soul) types.add(type);
  }
  return [...types];
}
