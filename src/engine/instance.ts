import { SECOND_TIER_VOUCHERS, UNLOCK_OPTIONS } from './constants';
import type { EmHandle, EngineInstance, ImmolateModule } from './loader';
import { normalizeSeed } from './seed';
import type { Settings } from './types';

/**
 * New Instance with TheSoul's run setup applied: params, initial locks, second-tier vouchers,
 * user-locked items, stake, deck. Caller owns (and must delete) the instance.
 */
export function createInstance(engine: ImmolateModule, s: Settings): EngineInstance {
  const inst = new engine.Instance(normalizeSeed(s.seed));
  try {
    withHandle(new engine.InstParams(s.deck, s.stake, s.showman, s.version), (params) => {
      inst.params = params;
    });
    inst.initLocks(1, false, false);
    for (const voucher of SECOND_TIER_VOUCHERS) inst.lock(voucher);
    const locked = new Set(s.locked);
    for (const option of UNLOCK_OPTIONS) {
      if (locked.has(option)) inst.lock(option);
    }
    inst.setStake(s.stake);
    inst.setDeck(s.deck);
    return inst;
  } catch (err) {
    inst.delete();
    throw err;
  }
}

/** Runs `use(handle)` and always deletes the embind handle afterwards, even on throw. */
export function withHandle<H extends EmHandle, R>(handle: H, use: (handle: H) => R): R {
  try {
    return use(handle);
  } finally {
    handle.delete();
  }
}
