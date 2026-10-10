import { useState } from 'preact/hooks';
import { normalizeSeed, randomSeed, SEED_MAX_LENGTH } from '../engine/seed';
import type { Settings } from '../engine/types';
import { CopyLinkButton } from './CopyLinkButton';
import { SettingsFields, type SelectKey } from './SettingsFields';

export type EngineStatus = 'loading' | 'analyzing' | 'ready' | 'error';

export interface SettingsBarProps {
  settings: Settings;
  status: EngineStatus;
  onChange: (patch: Partial<Settings>) => void;
}

const ANALYZER_SELECTS: readonly SelectKey[] = ['deck', 'stake', 'version', 'maxAnte', 'cardsPerAnte'];

const STATUS_TEXT: Record<EngineStatus, string> = {
  loading: 'Loading engine…',
  analyzing: 'Analyzing…',
  ready: 'Up to date',
  error: 'Engine error',
};

export function SettingsBar({ settings, status, onChange }: SettingsBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

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
        <SettingsFields settings={settings} selects={ANALYZER_SELECTS} onChange={onChange} />
        <CopyLinkButton />
      </div>
    </div>
  );
}
