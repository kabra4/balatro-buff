/**
 * Seed checking. `createChecker` is the fast path: it rolls only the streams the plan needs
 * (see plan.ts), ante by ante, and rejects as soon as a deadline can no longer be met.
 * `fullCheck` is the reference: full `analyze()` + `matchSlots` — used to verify every hit.
 *
 * Both follow the default line (engine/run.ts): every voucher bought and in effect, no blind
 * skipped, every shop pack opened. Pack tags count through their previews: the pack the tag would
 * give if its blind were skipped (only that change). The analyzer computes those by re-running the
 * line with the skip; here a preview is rolled on a fresh Instance (`previewPack`) — the gate is the
 * fast-path ≡ full-analysis property test.
 */
import { TAG_PACKS } from '../engine/constants';
import { analyze, cardsForAnte, readPackItems } from '../engine/analyze';
import { createInstance, withHandle } from '../engine/instance';
import type { EngineInstance, ImmolateModule } from '../engine/loader';
import { BLINDS, createVoucherState, packsForAnte, SHOP_PACKS_PER_VISIT, voucherUpgrades, type VoucherState } from '../engine/run';
import { createSoulRoller, isSoulCard, previewSoul, shopPackPlace, tagPackPlace, type SoulRoller } from '../engine/souls';
import type { Analysis, Pack, Settings } from '../engine/types';
import { matchSlots, type Occurrence } from './match';
import { OccurrenceCollector, occurrencesFrom } from './occurrences';
import { buildPlan, OMEN_GLOBE_PACK_TYPES, STEP_ORDER, type Plan, type StepId } from './plan';
import { FINDER_SHOP_CAPS, seedSettings } from './query';
import { ANTE_SOURCE_IDS, ANTE_SOURCES, SHOP_READERS, type AnteRoller, type AnteSource, type PackType, type ShopItemType } from './sources';
import type { FinderQuery, Slot } from './types';

export interface Checker {
  /** Fast-path verdict: can every slot get its own occurrence in this seed? */
  check(seed: string): boolean;
  /** Every occurrence the plan rolls for this seed (no early exit). For tests. */
  collect(seed: string): Occurrence[];
}

export interface FullCheck {
  analysis: Analysis;
  /** Slot id → matched occurrence, or null when the seed doesn't satisfy the query. */
  matches: Map<string, Occurrence> | null;
}

/** A pack opened earlier in the run, as a preview replays it. */
export interface Opening {
  ante: number;
  name: string;
}

interface PackInfo {
  type: string;
  size: number;
  choices: number;
}

interface ShopRates {
  joker: number;
  tarot: number;
  planet: number;
  playing: number;
  total: number;
}

interface ShopOpening extends Opening {
  type: string;
  /** Omen Globe was in effect when it was opened. */
  omenGlobe: boolean;
}

interface SeedRun {
  settings: Settings;
  inst: EngineInstance;
  vouchers: VoucherState;
  anteRollers: Map<AnteSource, AnteRoller>;
  souls: SoulRoller | null;
  occ: OccurrenceCollector;
  /** This ante's values per ante source (tags: what the previews open). */
  anteValues: Partial<Record<AnteSource, readonly string[]>>;
  /** Shop cards this ante showed on entry, before its voucher took effect. */
  entryCards: number;
  /** Shop packs opened so far, in order. */
  opened: ShopOpening[];
}

const OMEN_GLOBE = 'Omen Globe';

const packInfoCache = new WeakMap<ImmolateModule, Map<string, PackInfo>>();

export function fullCheck(engine: ImmolateModule, query: FinderQuery, seed: string): FullCheck {
  const analysis = analyze(engine, seedSettings(query, seed));
  return { analysis, matches: matchSlots(query.slots, occurrencesFrom(analysis)) };
}

export function createChecker(engine: ImmolateModule, query: FinderQuery): Checker {
  const plan = buildPlan(query);
  for (const type of plan.shopTypes.keys()) {
    if (!SHOP_READERS[type]) throw new Error(`No fast-path shop reader for ${type}`);
  }
  const allSlots = query.slots;
  const dueAfter = dueSlots(plan);
  const rolledSources = ANTE_SOURCE_IDS.filter((id) => plan.through[id] > 0);
  const needsType = (type: string, a: number): boolean => (plan.packTypes.get(type as PackType) ?? 0) >= a;
  const shopSize = (a: number): number => cardsForAnte(a, query.settings.cardsPerAnte, FINDER_SHOP_CAPS);

  const rollStep = (step: StepId, run: SeedRun, a: number): void => {
    if (step === 'shopEntry') rollShopEntry(run, a);
    else if (step === 'packs') rollPacks(run, a);
    else if (step === 'shop') rollShop(run, a);
    else {
      const values = run.anteRollers.get(step)?.(run.inst, a) ?? [];
      run.anteValues[step] = values;
      run.occ.anteValues(a, step, values);
    }
  };

  /** The shop cards shown on entry: they roll before the ante's voucher is bought. */
  const rollShopEntry = (run: SeedRun, a: number): void => {
    run.entryCards = Math.min(run.vouchers.shopSlots(), shopSize(a));
    rollShopCards(run, a, 0, run.entryCards);
  };

  /** Packs are opened after the voucher is bought; each blind's tag pack would open at its shop visit. */
  const rollPacks = (run: SeedRun, a: number): void => {
    const { inst, souls, occ, vouchers } = run;
    const count = packsForAnte(a);
    for (let p = 0; p < count; p++) {
      if (p % SHOP_PACKS_PER_VISIT === 0) previewTagPack(run, a, p / SHOP_PACKS_PER_VISIT);
      if (p === 0) vouchers.activatePending(inst);
      const name = inst.nextPack(a);
      const { type, size } = packInfo(engine, name);
      run.opened.push({ ante: a, name, type, omenGlobe: vouchers.active.includes(OMEN_GLOBE) });
      if (!needsType(type, a)) continue;
      const place = shopPackPlace(name, p);
      for (const item of readPackItems(inst, type, size, a)) {
        if (souls && plan.souls >= a && isSoulCard(item)) item.soul = souls.roll(a);
        occ.packItem(a, place, type, item);
      }
    }
  };

  /** The pack the tag of blind `index` would give if that blind were skipped, when its type is needed. */
  const previewTagPack = (run: SeedRun, a: number, index: number): void => {
    const blind = BLINDS[index];
    const tag = run.anteValues.tags?.[index];
    const name = tag === undefined ? undefined : TAG_PACKS[tag];
    if (blind === undefined || tag === undefined || name === undefined) return;
    const { type } = packInfo(engine, name);
    if (!needsType(type, a)) return;
    const active = run.vouchers.active;
    const pack = previewPack(engine, run.settings, a, name, active, earlierOpenings(run.opened, a, type, active.includes(OMEN_GLOBE)));
    const prior = [...(run.souls?.history() ?? [])];
    for (const item of pack.items) {
      if (run.souls && plan.souls >= a && isSoulCard(item)) {
        item.soul = previewSoul(engine, run.settings, prior, a);
        prior.push(a);
      }
      run.occ.packItem(a, tagPackPlace(tag, blind), type, item, { ante: a, blind });
    }
  };

  /** The rest of the shop, with the ante's voucher in effect. */
  const rollShop = (run: SeedRun, a: number): void => {
    run.vouchers.activatePending(run.inst);
    rollShopCards(run, a, run.entryCards, shopSize(a));
  };

  /** Shop cards [from, to) of ante `a`, limited by the plan's shop depth. */
  const rollShopCards = ({ inst, occ }: SeedRun, a: number, from: number, to: number): void => {
    const count = Math.min(to, plan.shopDepth[a] ?? Infinity);
    if (from >= count) return;
    // Rates depend on the vouchers in effect, so they're read per call (cheap next to the rolls).
    const rates = shopRates(inst);
    const cdt = `cdt${a}`;
    for (let q = from; q < count; q++) {
      const type = shopType(inst.random(cdt), rates);
      const read = type === null || (plan.shopTypes.get(type) ?? 0) < a ? undefined : SHOP_READERS[type];
      if (read) occ.shopItem(a, q, read(inst, a));
    }
  };

  /** Runs the plan for `seed`; with `earlyExit`, returns null as soon as a deadline fails. */
  const run = (seed: string, earlyExit: boolean): OccurrenceCollector | null => {
    const settings = seedSettings(query, seed);
    const inst = createInstance(engine, settings);
    let souls: SoulRoller | null = null;
    try {
      souls = plan.souls > 0 ? createSoulRoller(engine, settings) : null;
      const vouchers = createVoucherState(voucherUpgrades(engine), settings);
      const anteRollers = new Map(rolledSources.map((id) => [id, ANTE_SOURCES[id].createRoller(engine, settings, vouchers)]));
      const seedRun: SeedRun = { settings, inst, vouchers, anteRollers, souls, occ: new OccurrenceCollector(), anteValues: {}, entryCards: 0, opened: [] };
      const due: Slot[] = [];
      for (let a = 1; a <= plan.horizon; a++) {
        // Last ante's voucher is in effect by now, even when no step of that ante applied it.
        vouchers.activatePending(inst);
        for (let k = 0; k < STEP_ORDER.length; k++) {
          const step = STEP_ORDER[k] as StepId;
          if (plan.through[step] >= a) rollStep(step, seedRun, a);
          const newlyDue = dueAfter.get(key(a, k));
          if (!newlyDue) continue;
          // Slots past their deadline have seen every candidate: if they can't all be matched now, they never will.
          due.push(...newlyDue);
          if (earlyExit && matchSlots(due, seedRun.occ.list) === null) return null;
        }
      }
      return seedRun.occ;
    } finally {
      souls?.dispose();
      inst.delete();
    }
  };

  return {
    check: (seed) => {
      if (plan.impossible || allSlots.length === 0) return false;
      const occ = run(seed, true);
      return occ !== null && matchSlots(allSlots, occ.list) !== null;
    },
    collect: (seed) => (plan.impossible ? [] : (run(seed, false)?.list ?? [])),
  };
}

/**
 * Pack `packName` as if opened in ante `a`, on a fresh Instance: the `active` vouchers in effect, then
 * the `earlier` openings that share its streams replayed, then the pack. A fresh Instance never calls
 * nextPack (names come from the caller), so it only touches pack-content streams.
 */
export function previewPack(
  engine: ImmolateModule,
  s: Settings,
  a: number,
  packName: string,
  active: readonly string[],
  earlier: readonly Opening[],
): Pack {
  const inst = createInstance(engine, s);
  try {
    for (const voucher of active) inst.activateVoucher(voucher);
    for (const opening of earlier) {
      const { type, size } = packInfo(engine, opening.name);
      readPackItems(inst, type, size, opening.ante);
    }
    const info = packInfo(engine, packName);
    return { name: packName, ...info, items: readPackItems(inst, info.type, info.size, a) };
  } finally {
    inst.delete();
  }
}

/** (ante, step index) → slots whose deadline is that ante and whose last needed step is that step. */
function dueSlots(plan: Plan): Map<string, Slot[]> {
  const map = new Map<string, Slot[]>();
  for (const { slot, lastStep } of plan.slots) {
    const k = key(slot.byAnte, lastStep);
    map.set(k, [...(map.get(k) ?? []), slot]);
  }
  return map;
}

function key(ante: number, step: number): string {
  return `${ante}:${step}`;
}

/**
 * Openings before a tag pack of `type` in ante `a` that its contents depend on: the ante's packs of
 * the same type (per-ante streams), and with Omen Globe in effect every Arcana / Spectral pack opened
 * under it — its Arcana Spectrals share the ante's Spectral streams and the run-wide "omen_globe" stream.
 */
function earlierOpenings(opened: readonly ShopOpening[], a: number, type: string, omenGlobe: boolean): ShopOpening[] {
  const coupled = omenGlobe && isOmenGlobeType(type);
  return opened.filter((o) => (o.ante === a && o.type === type) || (coupled && o.omenGlobe && isOmenGlobeType(o.type)));
}

function isOmenGlobeType(type: string): boolean {
  return (OMEN_GLOBE_PACK_TYPES as readonly string[]).includes(type);
}

/** `packInfo` by pack name, cached per engine. */
function packInfo(engine: ImmolateModule, name: string): PackInfo {
  let cache = packInfoCache.get(engine);
  if (!cache) {
    cache = new Map();
    packInfoCache.set(engine, cache);
  }
  let info = cache.get(name);
  if (!info) {
    info = withHandle(engine.packInfo(name), (h) => ({ type: h.type, size: h.size, choices: h.choices }));
    cache.set(name, info);
  }
  return info;
}

function shopRates(inst: EngineInstance): ShopRates {
  return withHandle(inst.getShopInstance(), (s) => ({
    joker: s.jokerRate,
    tarot: s.tarotRate,
    planet: s.planetRate,
    playing: s.playingCardRate,
    // Same summation order as ShopInstance::getTotalRate.
    total: s.jokerRate + s.tarotRate + s.planetRate + s.playingCardRate + s.spectralRate,
  }));
}

/** Port of nextShopItem's type selection from its "cdt" poll. null = playing card (never rolled). */
function shopType(poll: number, r: ShopRates): ShopItemType | null {
  let cdt = poll * r.total;
  if (cdt < r.joker) return 'Joker';
  cdt -= r.joker;
  if (cdt < r.tarot) return 'Tarot';
  cdt -= r.tarot;
  if (cdt < r.planet) return 'Planet';
  cdt -= r.planet;
  if (cdt < r.playing) return null;
  return 'Spectral';
}
