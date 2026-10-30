/** Renders an Analysis as TheSoul's plain-text output (used for parity tests and text export). */
import type { Analysis, AnteResult, Item, ItemKind, ItemOf, Pack } from './types';

const ITEM_TEXT: { [K in ItemKind]: (item: ItemOf<K>) => string } = {
  joker: (j) => prefixed([...stickerWords(j.stickers), j.edition], j.name),
  tarot: (c) => c.name,
  planet: (c) => c.name,
  spectral: (c) => c.name,
  playing: (c) => prefixed([c.seal, c.edition, c.enhancement], `${c.rank} of ${c.suit}`),
};

export function formatAsTheSoulText(analysis: Analysis): string {
  return analysis.antes.map(formatAnte).join('');
}

export function itemText(item: Item): string {
  return (ITEM_TEXT[item.kind] as (i: Item) => string)(item);
}

/** "Mega Arcana Pack", or "Charm Tag → Mega Arcana Pack" for a skipped blind's tag pack. */
export function packTitle(pack: Pack): string {
  return pack.tag ? `${pack.tag.name} → ${pack.name}` : pack.name;
}

function formatAnte(a: AnteResult): string {
  let out = `==ANTE ${a.ante}==\n`;
  out += `Boss: ${a.boss}\n`;
  out += `Voucher: ${a.voucher}\n`;
  out += `Tags: ${a.tags[0]}, ${a.tags[1]}\n`;
  out += 'Shop Queue: \n';
  a.shop.forEach((item, i) => {
    out += `${i + 1}) ${itemText(item)}\n`;
  });
  out += '\nPacks: \n';
  for (const pack of a.packs) {
    out += `${packTitle(pack)} - ${pack.unopened ? '(not opened)' : pack.items.map(itemText).join(', ')}\n`;
  }
  return out + '\n';
}

function stickerWords(st: { eternal: boolean; perishable: boolean; rental: boolean }): string[] {
  return [st.eternal && 'Eternal', st.perishable && 'Perishable', st.rental && 'Rental'].filter(
    (w): w is string => typeof w === 'string',
  );
}

function prefixed(words: (string | null)[], name: string): string {
  return [...words.filter((w): w is string => w !== null), name].join(' ');
}
