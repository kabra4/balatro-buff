/**
 * CSS-sprite model: an item is drawn as a stack of sheet cells (background layers).
 * Sheet geometry and overlay positions follow TheSoul's UI.js.
 */
import type { Edition, Item, ItemKind, ItemOf, Stickers } from '../engine/types';
import { BOSS_POS, JOKER_POS, TAG_POS, TAROT_POS, VOUCHER_POS } from './spriteTables';

export type Pos = readonly [number, number];

export interface Sheet {
  file: string;
  cellW: number;
  cellH: number;
  width: number;
  height: number;
}

export const SHEETS = {
  jokers: { file: 'Jokers.png', cellW: 71, cellH: 95, width: 710, height: 1520 },
  tarots: { file: 'Tarots.png', cellW: 71, cellH: 95, width: 710, height: 570 },
  vouchers: { file: 'Vouchers.png', cellW: 71, cellH: 95, width: 639, height: 380 },
  deck: { file: '8BitDeck.png', cellW: 71, cellH: 95, width: 923, height: 380 },
  enhancers: { file: 'Enhancers.png', cellW: 71, cellH: 95, width: 497, height: 475 },
  editions: { file: 'Editions.png', cellW: 71, cellH: 94, width: 355, height: 94 },
  stickers: { file: 'stickers.png', cellW: 71, cellH: 95, width: 355, height: 285 },
  tags: { file: 'tags.png', cellW: 34, cellH: 34, width: 204, height: 170 },
  bosses: { file: 'BlindChips.png', cellW: 34, cellH: 34, width: 714, height: 1054 },
} as const satisfies Record<string, Sheet>;

export type SheetId = keyof typeof SHEETS;

export interface Layer {
  sheet: SheetId;
  pos: Pos;
}

/** Legendary jokers (and Hologram) draw a floating "soul" face one row below their card. */
const JOKER_SOUL_POS: Record<string, Pos> = {
  Canio: [3, 9],
  Triboulet: [4, 9],
  Yorick: [5, 9],
  Chicot: [6, 9],
  Perkeo: [7, 9],
  Hologram: [2, 9],
};

const EDITION_CELL: Record<Exclude<Edition, null>, Pos | null> = {
  Foil: [1, 0],
  Holographic: [2, 0],
  Polychrome: [3, 0],
  Negative: null,
};

const STICKER_POS: Record<keyof Stickers, Pos> = {
  eternal: [0, 0],
  perishable: [0, 2],
  rental: [1, 2],
};

const ENHANCER_POS: Record<string, Pos> = {
  Bonus: [1, 1],
  Mult: [2, 1],
  Wild: [3, 1],
  Glass: [5, 1],
  Steel: [6, 1],
  Stone: [5, 0],
  Gold: [6, 0],
  Lucky: [4, 1],
};
const BLANK_CARD: Pos = [1, 0];

const SEAL_POS: Record<string, Pos> = {
  'Gold Seal': [2, 0],
  'Purple Seal': [4, 4],
  'Red Seal': [5, 4],
  'Blue Seal': [6, 4],
};

const RANK_COL: Record<string, number> = {
  '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, Jack: 9, Queen: 10, King: 11, Ace: 12,
};
const SUIT_ROW: Record<string, number> = { Hearts: 0, Clubs: 1, Diamonds: 2, Spades: 3 };

/** Bottom-to-top layers per item kind. */
const ITEM_LAYERS: { [K in ItemKind]: (item: ItemOf<K>) => Layer[] } = {
  joker: (j) => [...jokerLayers(j.name), ...stickerLayers(j.stickers)],
  tarot: (c) => cell('tarots', TAROT_POS[c.name]),
  planet: (c) => cell('tarots', TAROT_POS[c.name]),
  spectral: (c) => cell('tarots', TAROT_POS[c.name]),
  playing: (c) => [
    { sheet: 'enhancers', pos: (c.enhancement && ENHANCER_POS[c.enhancement]) || BLANK_CARD },
    ...cell('deck', cardPos(c.rank, c.suit)),
    ...cell('enhancers', c.seal ? SEAL_POS[c.seal] : undefined),
  ],
};

export function itemLayers(item: Item): Layer[] {
  return (ITEM_LAYERS[item.kind] as (i: Item) => Layer[])(item);
}

export function jokerLayers(name: string): Layer[] {
  return [...cell('jokers', JOKER_POS[name]), ...cell('jokers', JOKER_SOUL_POS[name])];
}

/** Just the floating face of a legendary (falls back to the full card for other jokers). */
export function jokerSoulLayers(name: string): Layer[] {
  const face = JOKER_SOUL_POS[name];
  return face ? [{ sheet: 'jokers', pos: face }] : jokerLayers(name);
}

export function voucherLayers(name: string): Layer[] {
  return cell('vouchers', VOUCHER_POS[name]);
}

export function tagLayers(name: string): Layer[] {
  return cell('tags', TAG_POS[name]);
}

export function bossLayers(name: string): Layer[] {
  return cell('bosses', BOSS_POS[name]);
}

export function editionLayer(edition: Edition): Layer[] {
  return edition ? cell('editions', EDITION_CELL[edition] ?? undefined) : [];
}

/** Inline style drawing `layers` (bottom-to-top) at `scale`, sized to the first layer's cell. */
export function spriteStyle(layers: Layer[], baseUrl: string, scale = 1): Record<string, string> {
  const base = layers[0];
  if (!base) return {};
  const { cellW, cellH } = SHEETS[base.sheet];
  const top = [...layers].reverse();
  return {
    width: `${cellW * scale}px`,
    height: `${cellH * scale}px`,
    backgroundImage: top.map((l) => `url("${baseUrl}images/${SHEETS[l.sheet].file}")`).join(', '),
    backgroundPosition: top.map((l) => layerPosition(l, scale)).join(', '),
    backgroundSize: top.map((l) => `${SHEETS[l.sheet].width * scale}px ${SHEETS[l.sheet].height * scale}px`).join(', '),
    backgroundRepeat: 'no-repeat',
  };
}

function layerPosition({ sheet, pos }: Layer, scale: number): string {
  const { cellW, cellH } = SHEETS[sheet];
  return `${-pos[0] * cellW * scale}px ${-pos[1] * cellH * scale}px`;
}

function stickerLayers(stickers: Stickers): Layer[] {
  return (Object.keys(STICKER_POS) as (keyof Stickers)[])
    .filter((k) => stickers[k])
    .map((k) => ({ sheet: 'stickers', pos: STICKER_POS[k] }));
}

function cardPos(rank: string, suit: string): Pos | undefined {
  const x = RANK_COL[rank];
  const y = SUIT_ROW[suit];
  return x === undefined || y === undefined ? undefined : [x, y];
}

function cell(sheet: SheetId, pos: Pos | undefined): Layer[] {
  return pos ? [{ sheet, pos }] : [];
}
