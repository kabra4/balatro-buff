/**
 * Slot ⇄ occurrence matching. Every slot needs its own occurrence: solved as a bipartite
 * matching (Kuhn's augmenting paths), never greedily.
 */
import type { Blind, Edition } from '../engine/types';
import { hasShopSlot, SLOT_KINDS } from './slotKinds';
import type { EditionReq, Slot, SlotKind } from './types';

/**
 * One concrete item at a concrete place, as seen by one slot kind. A card can have several
 * facets (a Soul is a `soul`, a `joker` via its legendary, and a `spectral` card): they share
 * `id`, and a matching uses each id at most once.
 */
export interface Occurrence {
  id: number;
  kind: SlotKind;
  name: string;
  edition: Edition;
  ante: number;
  /** Voucher and tags count as 'shop' (their slots ignore `where`). */
  where: 'shop' | 'packs';
  /** "Shop #7" | "Jumbo Arcana Pack (pack 3)" | "Charm Tag (skip Small Blind)" | "Small blind tag" … */
  place: string;
  /** Shop items only: 1-based position in the ante's shop (the 7 in "Shop #7"). */
  shopIndex?: number;
  /**
   * Tag packs only: the blind whose skip gives this pack. A preview (blind not skipped on the analyzed
   * line) is matched as if that skip were the only change — the verifier checks the skips together.
   */
  skip?: { ante: number; blind: Blind };
}

export function slotAccepts(slot: Slot, o: Occurrence): boolean {
  const spec = SLOT_KINDS[slot.kind];
  return (
    o.kind === slot.kind &&
    o.ante <= slot.byAnte &&
    (slot.item === null || o.name === slot.item) &&
    (!spec.hasEdition || editionMatches(slot.edition, o.edition)) &&
    (!spec.hasWhere || slot.where === 'any' || slot.where === o.where) &&
    withinShopSlot(slot, o)
  );
}

/** A distinct occurrence for every slot (keyed by slot id), or null when impossible. */
export function matchSlots(slots: readonly Slot[], occ: readonly Occurrence[]): Map<string, Occurrence> | null {
  const options = slots.map((slot) => acceptedById(slot, occ));
  if (options.some((byId) => byId.size === 0)) return null;
  const owner = new Map<number, number>();
  for (let s = 0; s < slots.length; s++) {
    if (!augment(s, options, owner, new Set())) return null;
  }
  const result = new Map<string, Occurrence>();
  for (const [id, s] of owner) {
    const slot = slots[s];
    const facet = options[s]?.get(id);
    if (slot && facet) result.set(slot.id, facet);
  }
  return result;
}

/** Shop items must sit within the slot's first `shopSlot` shop cards; other occurrences are unaffected. */
function withinShopSlot(slot: Slot, o: Occurrence): boolean {
  return slot.shopSlot === null || o.shopIndex === undefined || !hasShopSlot(slot.kind) || o.shopIndex <= slot.shopSlot;
}

function editionMatches(req: EditionReq, edition: Edition): boolean {
  if (req === 'any') return true;
  if (req === 'none') return edition === null;
  return edition === req;
}

/** Occurrences the slot accepts, one facet per physical id (first wins). */
function acceptedById(slot: Slot, occ: readonly Occurrence[]): Map<number, Occurrence> {
  const byId = new Map<number, Occurrence>();
  for (const o of occ) {
    if (!byId.has(o.id) && slotAccepts(slot, o)) byId.set(o.id, o);
  }
  return byId;
}

/** Kuhn's augmenting path from slot `s`; `owner` maps occurrence id → slot index. */
function augment(s: number, options: Map<number, Occurrence>[], owner: Map<number, number>, seen: Set<number>): boolean {
  for (const id of options[s]?.keys() ?? []) {
    if (seen.has(id)) continue;
    seen.add(id);
    const current = owner.get(id);
    if (current === undefined || augment(current, options, owner, seen)) {
      owner.set(id, s);
      return true;
    }
  }
  return false;
}
