import type { Item, ItemKind, ItemOf, SoulResult, Stickers } from '../engine/types';
import { Sprite } from './Sprite';
import { soulLabel } from './soulText';
import { itemLayers, jokerSoulLayers } from './sprites';

interface CardText {
  title: string;
  mods: string[];
}

const STICKER_LABELS: Record<keyof Stickers, string> = {
  eternal: 'Eternal',
  perishable: 'Perishable',
  rental: 'Rental',
};

const CARD_TEXT: { [K in ItemKind]: (item: ItemOf<K>) => CardText } = {
  joker: (j) => ({ title: j.name, mods: compact([j.edition, ...stickerLabels(j.stickers)]) }),
  tarot: (c) => ({ title: c.name, mods: [] }),
  planet: (c) => ({ title: c.name, mods: [] }),
  spectral: (c) => ({ title: c.name, mods: [] }),
  playing: (c) => ({ title: `${c.rank} of ${c.suit}`, mods: compact([c.edition, c.enhancement, c.seal]) }),
};

export interface ItemCardProps {
  item: Item;
  number?: number;
}

export function ItemCard({ item, number }: ItemCardProps) {
  const { title, mods } = (CARD_TEXT[item.kind] as (i: Item) => CardText)(item);
  const edition = item.kind === 'joker' || item.kind === 'playing' ? item.edition : null;
  const soul = item.kind !== 'joker' && item.kind !== 'playing' ? item.soul : undefined;
  return (
    <figure class={`card card-${item.kind} ${edition ? `ed-${edition.toLowerCase()}` : ''} ${soul ? 'card-soul' : ''}`}>
      {number !== undefined && <span class="card-num">{number}</span>}
      <div class="card-art">
        <Sprite layers={itemLayers(item)} edition={edition} label={title} />
        {soul && <SoulFace soul={soul} />}
      </div>
      <figcaption>
        <span class="card-title">{title}</span>
        {mods.length > 0 && <span class="card-mods">{mods.join(' · ')}</span>}
        {soul && <span class="card-soul-label">{soulLabel(soul)}</span>}
      </figcaption>
    </figure>
  );
}

function SoulFace({ soul }: { soul: SoulResult }) {
  return (
    <Sprite
      className="card-soul-face"
      layers={jokerSoulLayers(soul.legendary)}
      scale={0.8}
      label={`Soul #${soul.index}: ${soul.legendary}`}
    />
  );
}

function stickerLabels(stickers: Stickers): string[] {
  return (Object.keys(STICKER_LABELS) as (keyof Stickers)[]).filter((k) => stickers[k]).map((k) => STICKER_LABELS[k]);
}

function compact(values: (string | null)[]): string[] {
  return values.filter((v): v is string => v !== null);
}
