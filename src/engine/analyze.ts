/**
 * Port of TheSoul's `performAnalysis` loop (index.html), extended with the player's run choices
 * (see run.ts). Engine calls within each RNG stream happen in the same order as TheSoul's — the
 * streams are order-sensitive — so with no actions and `theSoulCompat` the output is TheSoul's.
 */
import { SPECTRAL_CARDS, TAG_PACKS } from './constants';
import { toEdition } from './editions';
import { createInstance, withHandle } from './instance';
import type { CardHandle, EmVector, EngineInstance, ImmolateModule, JokerDataHandle } from './loader';
import { anteChoices, anteEvents, BLINDS, createVoucherState, SHOP_PACKS_PER_VISIT, shopPackCount, voucherUpgrades, type VoucherState } from './run';
import { normalizeSeed } from './seed';
import { resolveSouls } from './souls';
import type { Analysis, AnteResult, Blind, ConsumableKind, Item, Pack, RunAction, Settings, ShopCaps, TagPreview } from './types';

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

/** Spectral cards are Spectral wherever they appear (The Soul / Black Hole in packs, Omen Globe's in Arcana packs). */
const SPECTRAL_NAMES: ReadonlySet<string> = new Set(SPECTRAL_CARDS);

const RANKS: Record<string, string> = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
const SUITS: Record<string, string> = { C: 'Clubs', S: 'Spades', D: 'Diamonds', H: 'Hearts' };

/** TheSoul's cap: 15 shop cards in ante 1. */
export const ANALYZER_SHOP_CAPS: ShopCaps = { 1: 15 };

export interface AnalysisStepper {
  /** Analyzes the next ante (1, 2, …), or returns null once `maxAnte` is done. */
  next(): AnteResult | null;
  /** Deletes the engine Instance. Idempotent. */
  dispose(): void;
}

/** Shop cards rolled in `ante`: the Cards/ante setting, capped per ante by `caps`. */
export function cardsForAnte(ante: number, cardsPerAnte: number, caps: ShopCaps = ANALYZER_SHOP_CAPS): number {
  return Math.min(caps[ante] ?? cardsPerAnte, cardsPerAnte);
}

export function analyze(engine: ImmolateModule, s: Settings): Analysis {
  const settings: Settings = { ...s, seed: normalizeSeed(s.seed), locked: [...s.locked] };
  const antes = analyzeAntes(engine, settings);
  const souls = resolveSouls(engine, settings, antes);
  attachTagPreviews(engine, settings, antes);
  return { settings, antes, souls };
}

/** Ante-by-ante analysis on one Instance (TheSoul's call order). Souls are not resolved here. */
export function createAnalysisStepper(engine: ImmolateModule, s: Settings): AnalysisStepper {
  const settings: Settings = { ...s, seed: normalizeSeed(s.seed) };
  let inst: EngineInstance | null = createInstance(engine, settings);
  try {
    const vouchers = createVoucherState(voucherUpgrades(engine), settings);
    let ante = 0;
    return {
      next: () => {
        if (inst === null || ante >= settings.maxAnte) return null;
        ante++;
        return analyzeAnte(engine, inst, ante, settings, vouchers);
      },
      dispose: () => {
        inst?.delete();
        inst = null;
      },
    };
  } catch (err) {
    inst?.delete();
    throw err;
  }
}

/** Rolls the contents of a pack of base `type` (from `packInfo`). Unknown types yield no cards, like TheSoul. */
export function readPackItems(inst: EngineInstance, type: string, size: number, ante: number): Item[] {
  const reader = PACK_READERS[type];
  return reader ? reader(inst, size, ante) : [];
}

function analyzeAntes(engine: ImmolateModule, settings: Settings): AnteResult[] {
  const stepper = createAnalysisStepper(engine, settings);
  const antes: AnteResult[] = [];
  try {
    for (let ante = stepper.next(); ante !== null; ante = stepper.next()) antes.push(ante);
  } finally {
    stepper.dispose();
  }
  return antes;
}

function analyzeAnte(engine: ImmolateModule, inst: EngineInstance, a: number, s: Settings, vouchers: VoucherState): AnteResult {
  const choices = anteChoices(s.actions, a);
  inst.initUnlocks(a, false);
  const boss = inst.nextBoss(a);
  const voucher = vouchers.roll(inst, a, choices.voucherBought);
  const tags: [string, string] = [inst.nextTag(a), inst.nextTag(a)];

  const shopSize = cardsForAnte(a, s.cardsPerAnte, s.shopCaps);
  const names = drawPackNames(inst, a, shopPackCount(a, choices.skipped));
  const shop: Item[] = [];
  const packs: Pack[] = [];
  let visits = 0;
  let next = 0;
  for (const event of anteEvents(choices.skipped)) {
    if (event.kind === 'tagPack') {
      const pack = openTagPack(engine, inst, a, tags, event.blind);
      if (pack) packs.push(pack);
      continue;
    }
    if (visits++ === 0) {
      // The voucher is bought after the cards shown on entry, so they roll with the earlier vouchers only.
      const entry = Math.min(vouchers.shopSlots(), shopSize);
      for (let q = 0; q < shopSize; q++) {
        if (q === entry) vouchers.activatePending(inst);
        shop.push(readShopItem(inst, a));
      }
      vouchers.activatePending(inst);
    }
    for (let k = 0; k < SHOP_PACKS_PER_VISIT && next < names.length; k++, next++) {
      packs.push(openShopPack(engine, inst, a, names[next]!, next, choices.unopened));
    }
  }
  return { ante: a, boss, voucher, tags, shop, packs, voucherSkipped: !choices.voucherBought, skipped: [...choices.skipped] };
}

/**
 * For each pack tag whose blind isn't skipped: the pack it would give if it were. Each preview is
 * a variant analysis (antes 1..a, that skip added, no shop cards) with its Souls resolved, so it is
 * exactly what toggling the skip would show — including Omen Globe's Arcana/Spectral coupling.
 * No shop cards is safe: shop rolls touch no pack stream and lock nothing, and never yield a Soul.
 */
function attachTagPreviews(engine: ImmolateModule, s: Settings, antes: AnteResult[]): void {
  for (const ante of antes) {
    const previews: TagPreview[] = [];
    BLINDS.forEach((blind, i) => {
      const tag = ante.tags[i]!;
      if (TAG_PACKS[tag] === undefined || ante.skipped?.includes(blind)) return;
      const pack = previewTagPack(engine, s, ante.ante, blind);
      if (pack) previews.push({ blind, tag, pack });
    });
    ante.tagPreviews = previews;
  }
}

function previewTagPack(engine: ImmolateModule, s: Settings, a: number, blind: Blind): Pack | undefined {
  const skip: RunAction = { kind: 'skipBlind', ante: a, blind };
  const variant: Settings = { ...s, maxAnte: a, cardsPerAnte: 0, actions: [...(s.actions ?? []), skip] };
  const antes = analyzeAntes(engine, variant);
  resolveSouls(engine, variant, antes);
  return antes[a - 1]?.packs.find((p) => p.tag?.blind === blind);
}

/** The ante's shop pack queue (names only; contents are rolled when a pack is opened). */
function drawPackNames(inst: EngineInstance, a: number, count: number): string[] {
  return Array.from({ length: count }, () => inst.nextPack(a));
}

/** The pack a skipped blind's tag gives, or null when the tag gives no pack. */
function openTagPack(engine: ImmolateModule, inst: EngineInstance, a: number, tags: [string, string], blind: Blind): Pack | null {
  const tag = tags[BLINDS.indexOf(blind)]!;
  const name = TAG_PACKS[tag];
  if (name === undefined) return null;
  const info = packInfo(engine, name);
  return { name, ...info, items: readPackItems(inst, info.type, info.size, a), tag: { name: tag, blind } };
}

function openShopPack(engine: ImmolateModule, inst: EngineInstance, a: number, name: string, index: number, unopened: ReadonlySet<number>): Pack {
  const info = packInfo(engine, name);
  if (unopened.has(index)) return { name, ...info, items: [], queueIndex: index, unopened: true };
  return { name, ...info, items: readPackItems(inst, info.type, info.size, a), queueIndex: index };
}

function packInfo(engine: ImmolateModule, name: string): { type: string; size: number; choices: number } {
  return withHandle(engine.packInfo(name), (info) => ({ type: info.type, size: info.size, choices: info.choices }));
}

function readShopItem(inst: EngineInstance, a: number): Item {
  return withHandle(inst.nextShopItem(a), (raw) =>
    raw.type === 'Joker'
      ? withHandle(raw.jokerData, toJoker)
      : consumable(raw.item, SHOP_CONSUMABLE_KINDS[raw.type] ?? 'tarot'),
  );
}

function readConsumables(vec: EmVector<string>, kind: ConsumableKind): Item[] {
  return withHandle(vec, (v) => vectorItems(v, (name) => consumable(name, kind)));
}

function readJokers(vec: EmVector<JokerDataHandle>): Item[] {
  return withHandle(vec, (v) => vectorItems(v, (jd) => withHandle(jd, toJoker)));
}

function readCards(vec: EmVector<CardHandle>): Item[] {
  return withHandle(vec, (v) => vectorItems(v, (card) => withHandle(card, toPlayingCard)));
}

function toPlayingCard(card: CardHandle): Item {
  return {
    kind: 'playing',
    rank: RANKS[card.base[2] ?? ''] ?? card.base[2] ?? '',
    suit: SUITS[card.base[0] ?? ''] ?? '',
    enhancement: card.enhancement === 'No Enhancement' ? null : card.enhancement,
    edition: toEdition(card.edition),
    seal: card.seal === 'No Seal' ? null : card.seal,
  };
}

function toJoker(jd: JokerDataHandle): Item {
  const stickers = withHandle(jd.stickers, (st) => ({ eternal: st.eternal, perishable: st.perishable, rental: st.rental }));
  const legendary = jd.rarity === '4' ? { rarity: 'Legendary' as const } : {};
  return { kind: 'joker', name: jd.joker, edition: toEdition(jd.edition), stickers, ...legendary };
}

/** Reads every element of an embind vector in order. */
function vectorItems<T>(vec: EmVector<T>, read: (value: T) => Item): Item[] {
  const items: Item[] = [];
  for (let c = 0; c < vec.size(); c++) items.push(read(vec.get(c)));
  return items;
}

function consumable(name: string, fallback: ConsumableKind): Item {
  return { kind: SPECTRAL_NAMES.has(name) ? 'spectral' : fallback, name };
}
