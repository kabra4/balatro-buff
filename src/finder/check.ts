/**
 * Seed checking. `createChecker` is the fast path: it rolls only the streams the plan needs
 * (see plan.ts), ante by ante, and rejects as soon as a deadline can no longer be met.
 * `fullCheck` is the reference: full `analyze()` + `matchSlots` — used to verify every hit.
 */
import { analyze, cardsForAnte, createVoucherRoller, packsForAnte, readPackItems } from '../engine/analyze';
import { toEdition } from '../engine/editions';
import { createInstance, withHandle } from '../engine/instance';
import type { EngineInstance, ImmolateModule } from '../engine/loader';
import { createSoulRoller, isSoulCard, type SoulRoller } from '../engine/souls';
import type { Analysis, Item } from '../engine/types';
import { matchSlots, type Occurrence } from './match';
import { OccurrenceCollector, occurrencesFrom } from './occurrences';
import { buildPlan, STEP_ORDER, type Plan, type StepId } from './plan';
import type { PackType, ShopItemType } from './slotKinds';
import { seedSettings } from './query';
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

interface PackInfo {
  type: string;
  size: number;
}

interface ShopRates {
  joker: number;
  tarot: number;
  planet: number;
  playing: number;
  total: number;
}

interface SeedRun {
  inst: EngineInstance;
  souls: SoulRoller | null;
  occ: OccurrenceCollector;
}

type ShopReader = (inst: EngineInstance, ante: number) => Item;

const NO_STICKERS = Object.freeze({ eternal: false, perishable: false, rental: false });

/** Fast-path shop readers: same streams as nextShopItem after its "cdt" roll (jokers without stickers). */
const SHOP_READERS: Partial<Record<ShopItemType, ShopReader>> = {
  Joker: (inst, a) =>
    withHandle(inst.nextJoker('sho', a, false), (jd) => ({
      kind: 'joker',
      name: jd.joker,
      edition: toEdition(jd.edition),
      stickers: NO_STICKERS,
    })),
  Spectral: (inst, a) => ({ kind: 'spectral', name: inst.nextSpectral('sho', a, false) }),
};

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
  const rollVoucher = createVoucherRoller(engine, query.settings.locked);
  const packInfos = new Map<string, PackInfo>();
  let rates: ShopRates | null = null;

  const steps: Record<StepId, (run: SeedRun, a: number) => void> = {
    voucher: ({ inst, occ }, a) => occ.voucher(a, rollVoucher(inst, a)),
    tags: ({ inst, occ }, a) => {
      inst.initUnlocks(a, false);
      const first = inst.nextTag(a);
      occ.tags(a, [first, inst.nextTag(a)]);
    },
    packs: (run, a) => rollPacks(run, a),
    shop: (run, a) => rollShop(run, a),
  };

  const rollPacks = ({ inst, souls, occ }: SeedRun, a: number): void => {
    const count = packsForAnte(a);
    for (let p = 0; p < count; p++) {
      const name = inst.nextPack(a);
      const { type, size } = packInfo(engine, packInfos, name);
      if ((plan.packTypes.get(type as PackType) ?? 0) < a) continue;
      const items = readPackItems(inst, type, size, a);
      for (const item of items) {
        if (souls && plan.souls >= a && isSoulCard(item)) item.soul = souls.roll(a);
        occ.packItem(a, p, name, type, item);
      }
    }
  };

  const rollShop = ({ inst, occ }: SeedRun, a: number): void => {
    rates ??= shopRates(inst);
    const count = cardsForAnte(a, query.settings.cardsPerAnte);
    const cdt = `cdt${a}`;
    for (let q = 0; q < count; q++) {
      const type = shopType(inst.random(cdt), rates);
      const read = type === null || (plan.shopTypes.get(type) ?? 0) < a ? undefined : SHOP_READERS[type];
      if (read) occ.shopItem(a, q, read(inst, a));
    }
  };

  /** Runs the plan for `seed`; with `earlyExit`, returns null as soon as a deadline fails. */
  const run = (seed: string, earlyExit: boolean): OccurrenceCollector | null => {
    const settings = seedSettings(query, seed);
    const inst = createInstance(engine, settings);
    const seedRun: SeedRun = { inst, souls: plan.souls > 0 ? createSoulRoller(engine, settings) : null, occ: new OccurrenceCollector() };
    try {
      const due: Slot[] = [];
      for (let a = 1; a <= plan.horizon; a++) {
        for (let k = 0; k < STEP_ORDER.length; k++) {
          const step = STEP_ORDER[k] as StepId;
          if (plan.through[step] >= a) steps[step](seedRun, a);
          const newlyDue = dueAfter.get(key(a, k));
          if (!newlyDue) continue;
          // Slots past their deadline have seen every candidate: if they can't all be matched now, they never will.
          due.push(...newlyDue);
          if (earlyExit && matchSlots(due, seedRun.occ.list) === null) return null;
        }
      }
      return seedRun.occ;
    } finally {
      seedRun.souls?.dispose();
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

function packInfo(engine: ImmolateModule, cache: Map<string, PackInfo>, name: string): PackInfo {
  let info = cache.get(name);
  if (!info) {
    info = withHandle(engine.packInfo(name), (h) => ({ type: h.type, size: h.size }));
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
