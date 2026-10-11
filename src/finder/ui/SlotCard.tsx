import { blankSlot, SLOT_KIND_IDS, SLOT_KINDS, slotSources, whereEnabled } from '../slotKinds';
import { MAX_BY_ANTE, type EditionReq, type FinderSettings, type Slot, type SlotKind, type Where } from '../types';
import { ItemPicker } from './ItemPicker';

export const EDITION_OPTIONS: readonly { value: EditionReq; label: string }[] = [
  { value: 'any', label: 'Any edition' },
  { value: 'none', label: 'No edition' },
  { value: 'Foil', label: 'Foil' },
  { value: 'Holographic', label: 'Holographic' },
  { value: 'Polychrome', label: 'Polychrome' },
  { value: 'Negative', label: 'Negative' },
];

export const WHERE_OPTIONS: readonly { value: Where; label: string }[] = [
  { value: 'any', label: 'Shop or packs' },
  { value: 'shop', label: 'Shop' },
  { value: 'packs', label: 'Packs' },
];

/** "By shop slot" choices (the Cards/ante setting hides deeper ones). */
export const SHOP_SLOT_OPTIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200];

const ANTES = Array.from({ length: MAX_BY_ANTE }, (_, i) => i + 1);

export interface SlotCardProps {
  slot: Slot;
  settings: FinderSettings;
  problem: string | null;
  onChange: (slot: Slot) => void;
  onRemove: () => void;
}

export function SlotCard({ slot, settings, problem, onChange, onRemove }: SlotCardProps) {
  const spec = SLOT_KINDS[slot.kind];
  const patch = (p: Partial<Slot>) => onChange({ ...slot, ...p });
  return (
    <div class={`slot-card ${problem ? 'slot-invalid' : ''}`} data-kind={slot.kind}>
      <div class="slot-head">
        <select
          class="slot-kind"
          aria-label="Requirement kind"
          value={slot.kind}
          onChange={(e) => onChange(blankSlot(slot.id, (e.currentTarget as HTMLSelectElement).value as SlotKind, slot.byAnte))}
        >
          {SLOT_KIND_IDS.map((kind) => (
            <option key={kind} value={kind}>
              {SLOT_KINDS[kind].label}
            </option>
          ))}
        </select>
        <button type="button" class="btn-icon slot-remove" aria-label="Remove requirement" title="Remove" onClick={onRemove}>
          ✕
        </button>
      </div>
      <ItemPicker kind={slot.kind} value={slot.item} onChange={(item) => patch({ item })} />
      {spec.hasEdition && (
        <label class="slot-field">
          <span class="field-label">Edition</span>
          <select value={slot.edition} onChange={(e) => patch({ edition: (e.currentTarget as HTMLSelectElement).value as EditionReq })}>
            {EDITION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      {spec.hasWhere && (
        <label class="slot-field">
          <span class="field-label">Where</span>
          <select value={slot.where} onChange={(e) => patch({ where: (e.currentTarget as HTMLSelectElement).value as Where })}>
            {WHERE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} disabled={!whereEnabled(slot, o.value, settings)}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label class="slot-field">
        <span class="field-label">By ante</span>
        <select value={String(slot.byAnte)} onChange={(e) => patch({ byAnte: Number((e.currentTarget as HTMLSelectElement).value) })}>
          {ANTES.map((a) => (
            <option key={a} value={String(a)}>
              {a}
            </option>
          ))}
        </select>
      </label>
      {slotSources(slot, settings).shop !== null && (
        <label class="slot-field">
          <span class="field-label">By shop slot</span>
          <select
            value={slot.shopSlot === null ? '' : String(slot.shopSlot)}
            onChange={(e) => patch({ shopSlot: shopSlotValue((e.currentTarget as HTMLSelectElement).value) })}
          >
            <option value="">Any</option>
            {shopSlotOptions(slot.shopSlot, settings.cardsPerAnte).map((n) => (
              <option key={n} value={String(n)}>
                #{n}
              </option>
            ))}
          </select>
        </label>
      )}
      {problem && <p class="slot-problem">{problem}</p>}
    </div>
  );
}

/** Options up to Cards/ante, plus the current value (e.g. from a link) so it never silently vanishes. */
function shopSlotOptions(current: number | null, cardsPerAnte: number): number[] {
  const options = SHOP_SLOT_OPTIONS.filter((n) => n <= cardsPerAnte);
  if (current !== null && !options.includes(current)) options.push(current);
  return options.sort((a, b) => a - b);
}

function shopSlotValue(raw: string): number | null {
  return raw === '' ? null : Number(raw);
}
