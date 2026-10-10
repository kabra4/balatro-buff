import { describe, expect, it } from 'vitest';
import { analyze } from '../src/engine/analyze';
import { createInstance, withHandle } from '../src/engine/instance';
import type { ImmolateModule } from '../src/engine/loader';
import type { Settings } from '../src/engine/types';

const SETTINGS: Settings = {
  seed: 'LEAKS',
  deck: 'Red Deck',
  stake: 'White Stake',
  version: 10106,
  maxAnte: 1,
  cardsPerAnte: 10,
  showman: false,
  locked: [],
};

describe('embind handle cleanup', () => {
  it('withHandle deletes the handle even when the callback throws', () => {
    const handle = fakeHandle();

    expect(() => withHandle(handle, () => {
      throw new Error('boom');
    })).toThrow('boom');
    expect(handle.deleted).toBe(1);
  });

  it('createInstance deletes the Instance when setup throws', () => {
    const fake = fakeEngine({ setDeck: () => { throw new Error('bad deck'); } });

    expect(() => createInstance(fake.engine, SETTINGS)).toThrow('bad deck');
    expect(fake.instances[0]!.deleted).toBe(1);
    expect(fake.params[0]!.deleted).toBe(1);
  });

  it('pack readers delete the vector, and analyze deletes the Instance, when reading throws', () => {
    const vector = { ...fakeHandle(), size: () => 3, get: () => { throw new Error('bad card'); } };
    const fake = fakeEngine({ nextArcanaPack: () => vector });

    expect(() => analyze(fake.engine, SETTINGS)).toThrow('bad card');
    expect(vector.deleted).toBe(1);
    expect(fake.instances[0]!.deleted).toBe(1);
    expect(fake.packInfos.every((p) => p.deleted === 1)).toBe(true);
  });

  it('shop reader deletes the ShopItem and JokerData when reading throws', () => {
    const jokerData = { ...fakeHandle(), joker: 'Joker', rarity: '1', edition: 'No Edition', get stickers(): never { throw new Error('bad stickers'); } };
    const shopItem = { ...fakeHandle(), type: 'Joker', item: 'Joker', jokerData };
    const fake = fakeEngine({ nextShopItem: () => shopItem });

    expect(() => analyze(fake.engine, SETTINGS)).toThrow('bad stickers');
    expect(shopItem.deleted).toBe(1);
    expect(jokerData.deleted).toBe(1);
  });
});

interface Deletable {
  deleted: number;
  delete(): void;
}

function fakeHandle(): Deletable {
  return {
    deleted: 0,
    delete() {
      this.deleted++;
    },
  };
}

/** Minimal stand-in for the wasm module: every roll returns a fixed value unless overridden. */
function fakeEngine(overrides: Record<string, (...args: unknown[]) => unknown>) {
  const instances: Deletable[] = [];
  const params: Deletable[] = [];
  const packInfos: Deletable[] = [];
  const emptyVector = () => ({ ...fakeHandle(), size: () => 0, get: () => undefined });
  const defaults: Record<string, (...args: unknown[]) => unknown> = {
    lock: () => undefined,
    unlock: () => undefined,
    initLocks: () => undefined,
    initUnlocks: () => undefined,
    setStake: () => undefined,
    setDeck: () => undefined,
    nextBoss: () => 'The Hook',
    nextVoucher: () => 'Hone',
    nextTag: () => 'Rare Tag',
    nextShopItem: () => ({ ...fakeHandle(), type: 'Tarot', item: 'The Fool' }),
    nextPack: () => 'Arcana Pack',
    nextArcanaPack: emptyVector,
  };
  const engine = {
    Instance: function Instance() {
      const inst = { ...fakeHandle(), ...defaults, ...overrides, params: null };
      instances.push(inst);
      return inst;
    },
    InstParams: function InstParams() {
      const p = fakeHandle();
      params.push(p);
      return p;
    },
    packInfo: () => {
      const info = { ...fakeHandle(), type: 'Arcana Pack', size: 3, choices: 1 };
      packInfos.push(info);
      return info;
    },
    VOUCHERS: { ...fakeHandle(), size: () => 0, get: () => '' },
    LEGENDARY_JOKERS: { ...fakeHandle(), size: () => 0, get: () => '' },
  } as unknown as ImmolateModule;
  return { engine, instances, params, packInfos };
}
