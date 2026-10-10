/** Settings controls shared by the analyzer and the finder: selects, Showman, Unlocks… */
import { useState } from 'preact/hooks';
import { DECKS, STAKES, VERSIONS } from '../engine/constants';
import type { Settings } from '../engine/types';
import { CARDS_PER_ANTE_OPTIONS, MAX_ANTE_OPTIONS } from '../state/settings';
import { UnlocksModal } from './UnlocksModal';

export type SelectKey = 'deck' | 'stake' | 'version' | 'maxAnte' | 'cardsPerAnte';

/** The fields these controls edit (the finder has no seed / ante count). */
export type FieldSettings = Omit<Settings, 'seed' | 'maxAnte'> & Partial<Pick<Settings, 'maxAnte'>>;

export interface SettingsFieldsProps {
  settings: FieldSettings;
  /** Which selects to show, in order. */
  selects: readonly SelectKey[];
  onChange: (patch: Partial<Settings>) => void;
}

interface SelectField {
  label: string;
  options: readonly { value: string | number; label: string }[];
}

const SELECTS: Record<SelectKey, SelectField> = {
  deck: { label: 'Deck', options: DECKS.map(plain) },
  stake: { label: 'Stake', options: STAKES.map(plain) },
  version: { label: 'Version', options: VERSIONS },
  maxAnte: { label: 'Antes', options: MAX_ANTE_OPTIONS.map(plain) },
  cardsPerAnte: { label: 'Cards/ante', options: CARDS_PER_ANTE_OPTIONS.map(plain) },
};

export function SettingsFields({ settings, selects, onChange }: SettingsFieldsProps) {
  const [unlocksOpen, setUnlocksOpen] = useState(false);
  return (
    <>
      {selects.map((key) => (
        <label key={key} class="field">
          <span class="field-label">{SELECTS[key].label}</span>
          <select
            value={String(settings[key])}
            onChange={(e) => onChange(selectPatch(key, (e.currentTarget as HTMLSelectElement).value))}
          >
            {SELECTS[key].options.map((o) => (
              <option key={o.value} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <label class="field field-check">
        <input type="checkbox" checked={settings.showman} onChange={(e) => onChange({ showman: (e.currentTarget as HTMLInputElement).checked })} />
        <span class="field-label">Showman</span>
      </label>
      <button type="button" class="btn-small" onClick={() => setUnlocksOpen(true)}>
        Unlocks…{settings.locked.length > 0 && ` (${settings.locked.length} locked)`}
      </button>
      {unlocksOpen && (
        <UnlocksModal locked={settings.locked} onChange={(locked) => onChange({ locked })} onClose={() => setUnlocksOpen(false)} />
      )}
    </>
  );
}

function selectPatch(key: SelectKey, value: string): Partial<Settings> {
  return key === 'deck' || key === 'stake' ? { [key]: value } : { [key]: Number(value) };
}

function plain<T extends string | number>(value: T): { value: T; label: string } {
  return { value, label: String(value) };
}
