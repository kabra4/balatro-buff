/**
 * The player's run choices and their game model: which events happen in an ante, how many shop
 * packs get opened, and the voucher state (bought vouchers in effect).
 *
 * An ante plays as: small blind (shop after it, or its tag when skipped), big blind (same), boss
 * blind (always a shop after it). Each shop visit opens the next 2 packs of the ante's shop queue;
 * a skipped blind's pack tag opens its pack right away. A bought voucher is bought at the first
 * shop visit, after the cards the shop shows on entry.
 */
import { BASE_SHOP_SLOTS, SHOP_SLOT_VOUCHERS, UNLOCK_OPTIONS } from './constants';
import type { EngineInstance, ImmolateModule } from './loader';
import type { Blind, RunAction, Settings } from './types';

export interface AnteChoices {
  voucherBought: boolean;
  skipped: ReadonlySet<Blind>;
  /** Shop queue indexes of packs left unopened. */
  unopened: ReadonlySet<number>;
}

export type AnteEvent = { kind: 'tagPack'; blind: Blind } | { kind: 'shopVisit' };

/** One run's voucher state. Create one per run (seed): it holds per-run state. */
export interface VoucherState {
  /** Rolls the voucher for `ante`; a bought one is locked and unlocks its upgrade (when the profile has it). */
  roll(inst: EngineInstance, ante: number, bought: boolean): string;
  /** Applies the effect of this ante's bought voucher (no-op when skipped / compat / already applied). */
  activatePending(inst: EngineInstance): void;
  /** Vouchers in effect now, in purchase order. */
  readonly active: readonly string[];
  /** Shop cards shown on entry: base slots + active Overstock vouchers. */
  shopSlots(): number;
}

export const BLINDS: readonly Blind[] = ['small', 'big'];

export const SHOP_PACKS_PER_VISIT = 2;

const upgradesCache = new WeakMap<ImmolateModule, Map<string, string>>();

export function anteChoices(actions: readonly RunAction[] | undefined, ante: number): AnteChoices {
  const skipped = new Set<Blind>();
  const unopened = new Set<number>();
  let voucherBought = true;
  for (const action of actions ?? []) {
    if (action.ante !== ante) continue;
    if (action.kind === 'skipVoucher') voucherBought = false;
    else if (action.kind === 'skipBlind') skipped.add(action.blind);
    else unopened.add(action.index);
  }
  return { voucherBought, skipped, unopened };
}

/** The ante's events in play order: each blind is a shop visit or (skipped) its tag's pack, then the boss shop. */
export function anteEvents(skipped: ReadonlySet<Blind>): AnteEvent[] {
  const blinds = BLINDS.map((blind): AnteEvent => (skipped.has(blind) ? { kind: 'tagPack', blind } : { kind: 'shopVisit' }));
  return [...blinds, { kind: 'shopVisit' }];
}

/** TheSoul's pack count per ante (ante 1: 4, others: 6). */
export function packsForAnte(ante: number): number {
  return ante === 1 ? 4 : 6;
}

/** Shop packs opened in `ante`: every skipped blind is a shop visit (2 packs) fewer. */
export function shopPackCount(ante: number, skipped: ReadonlySet<Blind>): number {
  return Math.max(0, packsForAnte(ante) - SHOP_PACKS_PER_VISIT * skipped.size);
}

export function createVoucherState(upgrades: ReadonlyMap<string, string>, s: Pick<Settings, 'locked' | 'theSoulCompat'>): VoucherState {
  const locked = new Set(s.locked);
  const active: string[] = [];
  let pending: string | null = null;
  return {
    roll: (inst, ante, bought) => {
      const voucher = inst.nextVoucher(ante);
      if (!bought) return voucher;
      inst.lock(voucher);
      const upgrade = upgrades.get(voucher);
      if (upgrade !== undefined && isUnlockable(upgrade, locked)) inst.unlock(upgrade);
      if (!s.theSoulCompat) pending = voucher;
      return voucher;
    },
    activatePending: (inst) => {
      if (pending === null) return;
      // activateVoucher also unlocks the upgrade once. Engine locks are counted (each unlock removes one
      // lock): an upgrade the profile lacks was locked twice at setup (createInstance), so it stays locked.
      inst.activateVoucher(pending);
      active.push(pending);
      pending = null;
    },
    active,
    shopSlots: () => BASE_SHOP_SLOTS + active.filter((v) => (SHOP_SLOT_VOUCHERS as readonly string[]).includes(v)).length,
  };
}

/** Base voucher → its upgrade (engine VOUCHERS pairs). Cached per engine. */
export function voucherUpgrades(engine: ImmolateModule): Map<string, string> {
  let upgrades = upgradesCache.get(engine);
  if (!upgrades) {
    upgrades = new Map();
    for (let i = 0; i + 1 < engine.VOUCHERS.size(); i += 2) upgrades.set(engine.VOUCHERS.get(i), engine.VOUCHERS.get(i + 1));
    upgradesCache.set(engine, upgrades);
  }
  return upgrades;
}

/** TheSoul only unlocks an upgrade when it is in the Unlocks list and the user has it unlocked. */
function isUnlockable(name: string, locked: ReadonlySet<string>): boolean {
  return (UNLOCK_OPTIONS as readonly string[]).includes(name) && !locked.has(name);
}
