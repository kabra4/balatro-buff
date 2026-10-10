/**
 * Faithful port of TheSoul's `performAnalysis` loop (index.html). Engine calls happen in
 * exactly the same order as TheSoul's — the RNG streams are order-sensitive.
 */
import { SOUL_CARD, UNLOCK_OPTIONS } from './constants';
import { toEdition } from './editions';
import { createInstance } from './instance';
import type { CardHandle, EmVector, EngineInstance, ImmolateModule, JokerDataHandle } from './loader';
import { normalizeSeed } from './seed';
import { resolveSouls } from './souls';
import type { Analysis, AnteResult, ConsumableKind, Item, Pack, Settings } from './types';

const SHOP_CARDS_ANTE_1_CAP = 15;

type PackReader = (inst: EngineInstance, size: number, ante: number) => Item[];

/** Pack type (from `packInfo`) → how to roll its contents. Unknown types yield no cards, like TheSoul. */
const PACK_READERS: Record<string, PackReader> = {
  'Celestial Pack': (inst, size, ante) => readConsumables(inst.nextCelestialPack(size, ante), 'planet'),
  'Arcana Pack': (inst, size, ante) => readConsumables(inst.nextArcanaPack(size, ante), 'tarot'),
  'Spectral Pack': (inst, size, ante) => readConsumables(inst.nextSpectralPack(size, ante), 'spectral'),
  'Buffoon Pack': (inst, size, ante) => readJokers(inst.nextBuffoonPack(size, ante)),
  'Standard Pack': (inst, size, ante) => readCards(inst.nextStandardPack(size, ante)),
};

/** Shop item `type` → consumable kind (Jokers are handled separately: they carry joker data). */
const SHOP_CONSUMABLE_KINDS: Record<string, ConsumableKind> = {
  Tarot: 'tarot',
  Planet: 'planet',
  Spectral: 'spectral',
};

/** Cards that are Spectral regardless of which pack they appear in. */
const ALWAYS_SPECTRAL = new Set([SOUL_CARD, 'Black Hole']);

const RANKS: Record<string, string> = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
const SUITS: Record<string, string> = { C: 'Clubs', S: 'Spades', D: 'Diamonds', H: 'Hearts' };

export function cardsForAnte(ante: number, cardsPerAnte: number): number {
  return ante === 1 ? Math.min(SHOP_CARDS_ANTE_1_CAP, cardsPerAnte) : cardsPerAnte;
}

export function analyze(engine: ImmolateModule, s: Settings): Analysis {
  const settings: Settings = { ...s, seed: normalizeSeed(s.seed), locked: [...s.locked] };
  const inst = createInstance(engine, settings);
  try {
    const upgrades = voucherUpgrades(engine);
    const locked = new Set(settings.locked);
    const antes: AnteResult[] = [];
    for (let a = 1; a <= settings.maxAnte; a++) {
      antes.push(analyzeAnte(engine, inst, a, settings, upgrades, locked));
    }
    const souls = resolveSouls(engine, settings, antes);
    return { settings, antes, souls };
  } finally {
    inst.delete();
  }
}

function analyzeAnte(
  engine: ImmolateModule,
  inst: EngineInstance,
  a: number,
  s: Settings,
  upgrades: Map<string, string>,
  locked: Set<string>,
): AnteResult {
  inst.initUnlocks(a, false);
  const boss = inst.nextBoss(a);
  const voucher = inst.nextVoucher(a);
  inst.lock(voucher);
  const upgrade = upgrades.get(voucher);
  if (upgrade !== undefined && isUnlockable(upgrade, locked)) inst.unlock(upgrade);
  const tag1 = inst.nextTag(a);
  const tag2 = inst.nextTag(a);

  const shop: Item[] = [];
  const shopSize = cardsForAnte(a, s.cardsPerAnte);
  for (let q = 1; q <= shopSize; q++) shop.push(readShopItem(inst, a));

  const packs: Pack[] = [];
  const packCount = packsForAnte(a);
  for (let p = 1; p <= packCount; p++) packs.push(readPack(engine, inst, a));

  return { ante: a, boss, voucher, tags: [tag1, tag2], shop, packs };
}

/** TheSoul only unlocks an upgrade when it is in the Unlocks list and the user has it unlocked. */
function isUnlockable(name: string, locked: Set<string>): boolean {
  return (UNLOCK_OPTIONS as readonly string[]).includes(name) && !locked.has(name);
}

function voucherUpgrades(engine: ImmolateModule): Map<string, string> {
  const upgrades = new Map<string, string>();
  for (let i = 0; i + 1 < engine.VOUCHERS.size(); i += 2) {
    upgrades.set(engine.VOUCHERS.get(i), engine.VOUCHERS.get(i + 1));
  }
  return upgrades;
}

function readShopItem(inst: EngineInstance, a: number): Item {
  const raw = inst.nextShopItem(a);
  try {
    if (raw.type === 'Joker') {
      const jd = raw.jokerData;
      try {
        return toJoker(jd);
      } finally {
        jd.delete();
      }
    }
    return consumable(raw.item, SHOP_CONSUMABLE_KINDS[raw.type] ?? 'tarot');
  } finally {
    raw.delete();
  }
}

function readPack(engine: ImmolateModule, inst: EngineInstance, a: number): Pack {
  const name = inst.nextPack(a);
  const info = engine.packInfo(name);
  const { type, size, choices } = info;
  info.delete();
  const reader = PACK_READERS[type];
  return { name, type, size, choices, items: reader ? reader(inst, size, a) : [] };
}

function readConsumables(vec: EmVector<string>, kind: ConsumableKind): Item[] {
  const items: Item[] = [];
  for (let c = 0; c < vec.size(); c++) items.push(consumable(vec.get(c), kind));
  vec.delete();
  return items;
}

function readJokers(vec: EmVector<JokerDataHandle>): Item[] {
  const items: Item[] = [];
  for (let c = 0; c < vec.size(); c++) {
    const jd = vec.get(c);
    items.push(toJoker(jd));
    jd.delete();
  }
  vec.delete();
  return items;
}

function readCards(vec: EmVector<CardHandle>): Item[] {
  const items: Item[] = [];
  for (let c = 0; c < vec.size(); c++) {
    const card = vec.get(c);
    items.push({
      kind: 'playing',
      rank: RANKS[card.base[2] ?? ''] ?? card.base[2] ?? '',
      suit: SUITS[card.base[0] ?? ''] ?? '',
      enhancement: card.enhancement === 'No Enhancement' ? null : card.enhancement,
      edition: toEdition(card.edition),
      seal: card.seal === 'No Seal' ? null : card.seal,
    });
    card.delete();
  }
  vec.delete();
  return items;
}

function toJoker(jd: JokerDataHandle): Item {
  const st = jd.stickers;
  const stickers = { eternal: st.eternal, perishable: st.perishable, rental: st.rental };
  st.delete();
  const legendary = jd.rarity === '4' ? { rarity: 'Legendary' as const } : {};
  return { kind: 'joker', name: jd.joker, edition: toEdition(jd.edition), stickers, ...legendary };
}

function consumable(name: string, fallback: ConsumableKind): Item {
  return { kind: ALWAYS_SPECTRAL.has(name) ? 'spectral' : fallback, name };
}

function packsForAnte(ante: number): number {
  return ante === 1 ? 4 : 6;
}
