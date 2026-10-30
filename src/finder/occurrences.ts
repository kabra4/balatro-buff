/**
 * Turns analysis output into occurrences, driven by the slot-kind registry. Shared by the fast
 * path (fed only the sources it rolled) and the full-analysis reference / hit verification.
 */
import { packPlace, tagPackPlace } from '../engine/souls';
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
    this.item(SHOP_KINDS, item, { ante, where: 'shop', place: `Shop #${index + 1}`, shopIndex: index + 1 });
  }

  /** `place`: the pack's label (souls.ts `packPlace`); `type`: its base type from `packInfo`; `skip`: tag packs only. */
  packItem(ante: number, place: string, type: string, item: Item, skip?: Occurrence['skip']): void {
    const kinds = PACK_KINDS.get(type as PackType);
    if (kinds) this.item(kinds, item, { ante, where: 'packs', place, ...(skip && { skip }) });
  }

  private anteValue(ante: number, source: AnteSource, name: string, place: string): void {
    const id = this.nextId++;
    for (const kind of ANTE_KINDS.get(source) ?? []) {
      this.list.push({ id, kind, name, edition: null, ante, where: 'shop', place });
    }
  }

  private item(kinds: readonly KindSource[], item: Item, at: Pick<Occurrence, 'ante' | 'where' | 'place' | 'shopIndex' | 'skip'>): void {
    let id = 0;
    for (const [kind, source] of kinds) {
      const facet = source.facet(item);
      if (facet === null) continue;
      id ||= this.nextId++;
      this.list.push({ id, kind, ...facet, ...at });
    }
  }
}

/**
 * Every occurrence in a full analysis (Souls must already be resolved, as `analyze` does): opened
 * packs (shop and skipped blinds' tags) and tag-pack previews of the blinds not skipped.
 */
export function occurrencesFrom(analysis: Analysis): Occurrence[] {
  const collector = new OccurrenceCollector();
  for (const anteResult of analysis.antes) {
    const { ante, shop, packs, tagPreviews = [] } = anteResult;
    for (const source of ANTE_SOURCE_IDS) collector.anteValues(ante, source, ANTE_SOURCES[source].fromAnte(anteResult));
    shop.forEach((item, q) => collector.shopItem(ante, q, item));
    packs.forEach((pack, p) => {
      const skip = pack.tag && { ante, blind: pack.tag.blind };
      for (const item of pack.items) collector.packItem(ante, packPlace(pack, p), pack.type, item, skip);
    });
    for (const { blind, tag, pack } of tagPreviews) {
      for (const item of pack.items) collector.packItem(ante, tagPackPlace(tag, blind), pack.type, item, { ante, blind });
    }
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
