import { useState } from 'preact/hooks';
import { Sprite } from '../../ui/Sprite';
import type { Occurrence } from '../match';
import { analyzerHref } from '../query';
import type { VerifiedHit } from '../searchController';
import { anyLabel, shopSlotApplies, SLOT_KINDS } from '../slotKinds';
import type { FinderSettings, Slot } from '../types';
import { EDITION_OPTIONS, WHERE_OPTIONS } from './SlotCard';

export function ResultPanel({ hit }: { hit: VerifiedHit }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(hit.seed).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    }, () => undefined);
  return (
    <section class="result" aria-label="Current match">
      <div class="result-head">
        <span class="result-seed" data-testid="result-seed">{hit.seed}</span>
        <button type="button" class="btn-small" onClick={copy}>
          {copied ? 'Copied!' : 'Copy seed'}
        </button>
        <a class="btn-small result-open" href={analyzerHref(hit.query, hit.seed)} target="_blank" rel="noopener">
          Open in analyzer ↗
        </a>
      </div>
      <ul class="result-matches">
        {hit.query.slots.map((slot) => {
          const o = hit.matches.get(slot.id);
          return o ? <MatchLine key={slot.id} slot={slot} settings={hit.query.settings} occurrence={o} /> : null;
        })}
      </ul>
    </section>
  );
}

/** "Joker: Blueprint · Negative · shop · by ante 3 · by shop slot #5" */
export function describeSlot(slot: Slot, settings: FinderSettings): string {
  const spec = SLOT_KINDS[slot.kind];
  const parts = [`${spec.label}: ${slot.item ?? anyLabel(slot.kind)}`];
  if (spec.hasEdition && slot.edition !== 'any') parts.push(labelOf(EDITION_OPTIONS, slot.edition));
  if (spec.hasWhere && slot.where !== 'any') parts.push(labelOf(WHERE_OPTIONS, slot.where).toLowerCase());
  parts.push(`by ante ${slot.byAnte}`);
  if (shopSlotApplies(slot, settings)) parts.push(`by shop slot #${slot.shopSlot}`);
  return parts.join(' · ');
}

function MatchLine({ slot, settings, occurrence: o }: { slot: Slot; settings: FinderSettings; occurrence: Occurrence }) {
  return (
    <li class="match">
      <Sprite layers={SLOT_KINDS[o.kind].itemLayers(o.name)} edition={o.edition} scale={0.5} label={o.name} />
      <span class="match-text">
        <span class="match-slot">{describeSlot(slot, settings)}</span>
        <span class="match-found">
          matched: {o.name}
          {o.edition && ` (${o.edition})`} · Ante {o.ante} · {o.place}
        </span>
      </span>
    </li>
  );
}

function labelOf<T extends string>(options: readonly { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
