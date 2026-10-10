import { useState } from 'preact/hooks';
import { DECKS, STAKES, VERSIONS } from '../engine/constants';
import { normalizeSeed, randomSeed, SEED_MAX_LENGTH } from '../engine/seed';
import type { Settings } from '../engine/types';
import { CARDS_PER_ANTE_OPTIONS, MAX_ANTE_OPTIONS } from '../state/settings';
import { UnlocksModal } from './UnlocksModal';

export type EngineStatus = 'loading' | 'analyzing' | 'ready' | 'error';

export interface SettingsBarProps {
  settings: Settings;
  status: EngineStatus;
  onChange: (patch: Partial<Settings>) => void;
}

interface SelectField {
  key: 'deck' | 'stake' | 'version' | 'maxAnte' | 'cardsPerAnte';
  label: string;
  options: readonly { value: string | number; label: string }[];
}

const SELECTS: readonly SelectField[] = [
  { key: 'deck', label: 'Deck', options: DECKS.map(plain) },
  { key: 'stake', label: 'Stake', options: STAKES.map(plain) },
  { key: 'version', label: 'Version', options: VERSIONS },
  { key: 'maxAnte', label: 'Antes', options: MAX_ANTE_OPTIONS.map(plain) },
  { key: 'cardsPerAnte', label: 'Cards/ante', options: CARDS_PER_ANTE_OPTIONS.map(plain) },
];

const STATUS_TEXT: Record<EngineStatus, string> = {
  loading: 'Loading engine…',
  analyzing: 'Analyzing…',
  ready: 'Up to date',
  error: 'Engine error',
};

export function SettingsBar({ settings, status, onChange }: SettingsBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unlocksOpen, setUnlocksOpen] = useState(false);
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle');

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => flash(setCopied, 'ok'),
      () => flash(setCopied, 'fail'),
    );
  };

  return (
    <div class={`settings ${drawerOpen ? 'settings-open' : ''}`}>
      <div class="settings-main">
        <label class="field field-seed">
          <span class="field-label">Seed</span>
          <span class="seed-input">
            <input
              type="text"
              value={settings.seed}
              maxLength={SEED_MAX_LENGTH}
              spellcheck={false}
              autoComplete="off"
              placeholder="SEED"
              aria-label="Seed"
              onInput={(e) => {
                const input = e.currentTarget as HTMLInputElement;
                const seed = normalizeSeed(input.value);
                input.value = seed;
                onChange({ seed });
              }}
            />
            <button type="button" class="btn-icon" title="Random seed" aria-label="Random seed" onClick={() => onChange({ seed: randomSeed() })}>
              🎲
            </button>
          </span>
        </label>
        <span class={`status status-${status}`} role="status">
          {STATUS_TEXT[status]}
        </span>
        <button
          type="button"
          class="btn-small drawer-toggle"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(!drawerOpen)}
        >
          {drawerOpen ? 'Close' : 'Settings'}
        </button>
      </div>
      <div class="settings-fields">
        {SELECTS.map((f) => (
          <label key={f.key} class="field">
            <span class="field-label">{f.label}</span>
            <select
              value={String(settings[f.key])}
              onChange={(e) => onChange(selectPatch(f.key, (e.currentTarget as HTMLSelectElement).value))}
            >
              {f.options.map((o) => (
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
        <button type="button" class="btn-small" onClick={copyLink}>
          {copied === 'ok' ? 'Copied!' : copied === 'fail' ? 'Copy failed' : 'Copy link'}
        </button>
      </div>
      {unlocksOpen && (
        <UnlocksModal locked={settings.locked} onChange={(locked) => onChange({ locked })} onClose={() => setUnlocksOpen(false)} />
      )}
    </div>
  );
}

function selectPatch(key: SelectField['key'], value: string): Partial<Settings> {
  return key === 'deck' || key === 'stake' ? { [key]: value } : { [key]: Number(value) };
}

function plain<T extends string | number>(value: T): { value: T; label: string } {
  return { value, label: String(value) };
}

function flash(set: (v: 'idle' | 'ok' | 'fail') => void, value: 'ok' | 'fail'): void {
  set(value);
  window.setTimeout(() => set('idle'), 1500);
}
