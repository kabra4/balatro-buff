/**
 * Fast-path plan: which engine streams a query needs, through which ante, derived from the
 * slot-kind registry. The finder searches the default line (every voucher bought and in effect,
 * no blind skipped, every shop pack opened; see engine/run.ts). RNG streams are keyed per ante
 * ("Tag3", "shop_pack2", "cdt5", …) and independent except through shared Instance state, so each
 * step can be skipped on its own unless a coupling below pulls it in:
 *
 * - voucher:   "Voucher<a>" + voucher locks (lock rolled voucher, unlock its upgrade) + activation.
 *   Voucher names are in no other pool (all engine pools are name-disjoint — asserted in
 *   registry.test.ts), but bought vouchers change other rolls (engine probes): shop rates and
 *   editions (Tarot/Planet Merchant/Tycoon, Magic Trick, Hone, Glow Up), Arcana packs (Omen Globe)
 *   and Buffoon pack editions (Hone, Glow Up). So the voucher step runs through the shop and the
 *   Arcana / Buffoon pack contents (VOUCHER_PACK_TYPES).
 * - tags:      initUnlocks(a) + "Tag<a>" ×2. initUnlocks only touches boss and tag names. Pack tags
 *   (Charm, Ethereal, …) give a pack when their blind is skipped; the finder counts that pack as a
 *   preview, so a needed pack type pulls the tags through the same ante.
 * - shopEntry: the shop cards shown on entry (2 + Overstock slots), rolled before the ante's voucher
 *   is bought — same streams as `shop`, so it runs through the same ante.
 * - packs:     "shop_pack<a>" + cache.generatedFirstPack for every pack; contents only for the pack
 *   types needed. Each type has its own streams (soul_Tarot/Tarotar1, soul_Spectral/Spectralspe,
 *   soul_Planet/Planetpl1, …buf…); in-pack dedupe locks are released at the end of the pack, and
 *   names a pack could release early (showman) are never read by other pools (no RETRY in joker
 *   pools). Exception: with Omen Globe active, Arcana packs roll Spectral cards — sharing the
 *   ante's Spectral streams and a run-wide "omen_globe" stream — so Arcana and Spectral contents
 *   are rolled together (OMEN_GLOBE_PACK_TYPES) unless Omen Globe is locked in the profile.
 * - shop:      "cdt<a>" for every queue slot up to the deepest shop slot a slot still due accepts;
 *   only item types a slot can match are rolled further.
 *   Shop jokers are rolled without stickers (sticker streams come after name/edition and feed
 *   nothing we match on).
 * - boss:      never needed ("boss" stream + boss-name locks only).
 *
 * Every step runs on a prefix of antes 1..through, because streams are sequential across antes
 * (voucher locks and effects, initUnlocks, generatedFirstPack, the global Soul stream "Joker4",
 * "omen_globe").
 */
import { TAG_PACKS } from '../engine/constants';
import { horizonOf } from './query';
import { SLOT_KIND_IDS, SLOT_KINDS, slotSources, type ItemSource } from './slotKinds';
import { ANTE_SOURCE_IDS, PACK_TYPES, type AnteSource, type PackType, type ShopItemType } from './sources';
import type { FinderQuery, Slot } from './types';

export type StepId = AnteSource | 'shopEntry' | 'packs' | 'shop';

/**
 * Per-ante step order: cheap ante values first, the expensive shop last, so deadlines reject early.
 * `shopEntry` comes before `packs` because the ante's voucher takes effect between them.
 */
export const STEP_ORDER: readonly StepId[] = [...ANTE_SOURCE_IDS, 'shopEntry', 'packs', 'shop'];

/** Pack types whose contents bought vouchers change (Omen Globe; Hone / Glow Up editions). */
export const VOUCHER_PACK_TYPES: readonly PackType[] = ['Arcana Pack', 'Buffoon Pack'];

/** Pack types whose contents Omen Globe couples (Spectral cards in Arcana packs). */
export const OMEN_GLOBE_PACK_TYPES: readonly PackType[] = ['Arcana Pack', 'Spectral Pack'];

/**
 * Packs whose cards can carry a Soul-derived facet (registry sources flagged `soul`: Arcana and
 * Spectral — functions.hpp rolls soulable cards only there; shop rolls are never soulable).
 * Souls resolve in order of appearance, so all of these are rolled through the last ante any
 * Soul-derived slot needs.
 */
export const SOUL_PACK_TYPES: readonly PackType[] = soulPackTypes();

const TAG_PACK_TYPES: ReadonlySet<PackType> = tagPackTypes();

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
  /**
   * Shop cards ante `a` needs at most, at index `a`: the deepest "by shop slot" among the slots
   * the shop can serve that are still due (Infinity = no limit; Cards/ante caps it further).
   */
  shopDepth: readonly number[];
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
  /** Shop cards per ante this slot can use: 0 = none, Infinity = all. */
  shopDepth: number;
  souls: boolean;
}

export function buildPlan(query: FinderQuery): Plan {
  const through = Object.fromEntries(STEP_ORDER.map((step) => [step, 0])) as Record<StepId, number>;
  const packTypes = new Map<PackType, number>();
  const shopTypes = new Map<ShopItemType, number>();
  const horizon = horizonOf(query);
  const shopDepth = Array.from({ length: horizon + 1 }, () => 0);
  let souls = 0;
  const slots = query.slots.map((slot): PlannedSlot => {
    const needs = slotNeeds(slot, query);
    const a = slot.byAnte;
    for (const step of needs.steps) through[step] = Math.max(through[step], a);
    for (const type of needs.packTypes) packTypes.set(type, Math.max(packTypes.get(type) ?? 0, a));
    for (const type of needs.shopTypes) shopTypes.set(type, Math.max(shopTypes.get(type) ?? 0, a));
    for (let ante = 1; ante <= a; ante++) shopDepth[ante] = Math.max(shopDepth[ante] ?? 0, needs.shopDepth);
    if (needs.souls) souls = Math.max(souls, a);
    return { slot, lastStep: Math.max(-1, ...[...needs.steps].map((s) => STEP_ORDER.indexOf(s))) };
  });
  addCouplings(query, through, packTypes);
  return { horizon, through, packTypes, shopTypes, shopDepth, souls, slots, impossible: slots.some((p) => p.lastStep < 0) };
}

function slotNeeds(slot: Slot, { settings }: FinderQuery): SlotNeeds {
  const sources = slotSources(slot, settings);
  const needs: SlotNeeds = { steps: new Set(sources.ante), packTypes: new Set(), shopTypes: new Set(), shopDepth: 0, souls: false };
  if (sources.shop) {
    needs.steps.add('shopEntry');
    needs.steps.add('shop');
    needs.shopDepth = slot.shopSlot ?? Infinity;
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

/** Steps and pack types the needed ones depend on (see the module doc). Mutates its arguments. */
function addCouplings({ settings }: FinderQuery, through: Record<StepId, number>, packTypes: Map<PackType, number>): void {
  if (!settings.locked.includes('Omen Globe')) {
    const coupled = Math.max(0, ...OMEN_GLOBE_PACK_TYPES.map((type) => packTypes.get(type) ?? 0));
    if (coupled > 0) for (const type of OMEN_GLOBE_PACK_TYPES) packTypes.set(type, coupled);
  }
  for (const [type, a] of packTypes) {
    if (TAG_PACK_TYPES.has(type)) through.tags = Math.max(through.tags, a);
    if (VOUCHER_PACK_TYPES.includes(type)) through.voucher = Math.max(through.voucher, a);
  }
  through.voucher = Math.max(through.voucher, through.shop);
}

/** Pack types some pack tag gives ("Mega Arcana Pack" → Arcana Pack). */
function tagPackTypes(): Set<PackType> {
  const names = Object.values(TAG_PACKS);
  return new Set(PACK_TYPES.filter((type) => names.some((name) => name.endsWith(type))));
}

function soulPackTypes(): PackType[] {
  const types = new Set<PackType>();
  for (const kind of SLOT_KIND_IDS) {
    const packs = SLOT_KINDS[kind].occurrenceSources.packs ?? {};
    for (const [type, source] of Object.entries(packs) as [PackType, ItemSource][]) if (source.soul) types.add(type);
  }
  return [...types];
}
