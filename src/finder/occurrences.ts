/**
 * Turns analysis output into occurrences, driven by the slot-kind registry. Shared by the fast
 * path (fed only the sources it rolled) and the full-analysis reference / hit verification.
 */
import type { Analysis, Item } from '../engine/types';
import type { Occurrence } from './match';
import { SLOT_KIND_IDS, SLOT_KINDS, type ItemSource } from './slotKinds';
import { ANTE_SOURCE_IDS, ANTE_SOURCES, type AnteSource, type PackType } from './sources';
import type { SlotKind } from './types';

type KindSource = readonly [SlotKind, ItemSource];

const ANTE_KINDS = anteKinds();
const SHOP_KINDS: KindSource[] = SLOT_KIND_IDS.flatMap((kind) => {
  const shop = SLOT_KINDS[kind].occurrenceSources.shop;
  return shop ? [[kind, shop] as const] : [];
});
const PACK_KINDS = packKinds();

export class OccurrenceCollector {
  readonly list: Occurrence[] = [];
  private nextId = 1;

  /** The values one ante source rolled for `ante`, in place order. */
  anteValues(ante: number, source: AnteSource, names: readonly string[]): void {
    const places = ANTE_SOURCES[source].places;
    names.forEach((name, i) => this.anteValue(ante, source, name, places[i] ?? source));
  }

  /** `index` is 0-based in the shop queue. */
  shopItem(ante: number, index: number, item: Item): void {
    this.item(SHOP_KINDS, item, { ante, where: 'shop', place: `Shop #${index + 1}` });
  }

  /** `packIndex` is 0-based within the ante; `type` is the base pack type from `packInfo`. */
  packItem(ante: number, packIndex: number, packName: string, type: string, item: Item): void {
    const kinds = PACK_KINDS.get(type as PackType);
    if (kinds) this.item(kinds, item, { ante, where: 'packs', place: `${packName} (pack ${packIndex + 1})` });
  }

  private anteValue(ante: number, source: AnteSource, name: string, place: string): void {
    const id = this.nextId++;
    for (const kind of ANTE_KINDS.get(source) ?? []) {
      this.list.push({ id, kind, name, edition: null, ante, where: 'shop', place });
    }
  }

  private item(kinds: readonly KindSource[], item: Item, at: Pick<Occurrence, 'ante' | 'where' | 'place'>): void {
    let id = 0;
    for (const [kind, source] of kinds) {
      const facet = source.facet(item);
      if (facet === null) continue;
      id ||= this.nextId++;
      this.list.push({ id, kind, ...facet, ...at });
    }
  }
}

/** Every occurrence in a full analysis (Souls must already be resolved, as `analyze` does). */
export function occurrencesFrom(analysis: Analysis): Occurrence[] {
  const collector = new OccurrenceCollector();
  for (const anteResult of analysis.antes) {
    const { ante, shop, packs } = anteResult;
    for (const source of ANTE_SOURCE_IDS) collector.anteValues(ante, source, ANTE_SOURCES[source].fromAnte(anteResult));
    shop.forEach((item, q) => collector.shopItem(ante, q, item));
    packs.forEach((pack, p) => {
      for (const item of pack.items) collector.packItem(ante, p, pack.name, pack.type, item);
    });
  }
  return collector.list;
}

function anteKinds(): Map<AnteSource, SlotKind[]> {
  const map = new Map<AnteSource, SlotKind[]>();
  for (const kind of SLOT_KIND_IDS) {
    for (const source of SLOT_KINDS[kind].occurrenceSources.ante ?? []) map.set(source, [...(map.get(source) ?? []), kind]);
  }
  return map;
}

function packKinds(): Map<PackType, KindSource[]> {
  const map = new Map<PackType, KindSource[]>();
  for (const kind of SLOT_KIND_IDS) {
    const packs = SLOT_KINDS[kind].occurrenceSources.packs ?? {};
    for (const [type, source] of Object.entries(packs) as [PackType, ItemSource][]) {
      map.set(type, [...(map.get(type) ?? []), [kind, source]]);
    }
  }
  return map;
}
