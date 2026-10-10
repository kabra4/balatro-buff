export type Edition = 'Foil' | 'Holographic' | 'Polychrome' | 'Negative' | null;

export interface Stickers {
  eternal: boolean;
  perishable: boolean;
  rental: boolean;
}

/** 1-based order of appearance across the whole run. */
export interface SoulResult {
  index: number;
  legendary: string;
  edition: Edition;
}

export type ConsumableKind = 'tarot' | 'planet' | 'spectral';

export type Item =
  | { kind: 'joker'; name: string; edition: Edition; stickers: Stickers; rarity?: 'Legendary' }
  /** `soul` is set when `name === 'The Soul'`. */
  | { kind: ConsumableKind; name: string; soul?: SoulResult }
  | {
      kind: 'playing';
      rank: string;
      suit: string;
      enhancement: string | null;
      edition: Edition;
      seal: string | null;
    };

export type ItemKind = Item['kind'];

/** The Item variant(s) with the given kind. */
export type ItemOf<K extends ItemKind> = Item & { kind: K };

export interface Pack {
  /** Full pack name as rolled, e.g. "Jumbo Arcana Pack". */
  name: string;
  /** Base pack type from `packInfo`, e.g. "Arcana Pack". */
  type: string;
  size: number;
  choices: number;
  items: Item[];
}

export interface AnteResult {
  ante: number;
  boss: string;
  voucher: string;
  tags: [string, string];
  shop: Item[];
  packs: Pack[];
}

export interface Settings {
  seed: string;
  deck: string;
  stake: string;
  version: number;
  maxAnte: number;
  cardsPerAnte: number;
  showman: boolean;
  /** Items from the Unlocks list the player has NOT unlocked yet. */
  locked: string[];
}

export interface SoulLocation extends SoulResult {
  ante: number;
  /** Human-readable origin, e.g. "Mega Arcana Pack (pack 3)". */
  where: string;
}

export interface Analysis {
  settings: Settings;
  antes: AnteResult[];
  souls: SoulLocation[];
}
