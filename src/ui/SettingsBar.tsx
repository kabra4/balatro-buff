import { useEffect, useRef, useState } from 'preact/hooks';
import { normalizeSeed, randomSeed, SEED_MAX_LENGTH, seedFromText } from '../engine/seed';
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

const PASTE_NOTE_MS = 3000;

/** Transient paste failure message; `id` re-arms the hide timer when the same message repeats. */
interface PasteNote {
  text: string;
  id: number;
}

const STATUS_TEXT: Record<EngineStatus, string> = {
  loading: 'Loading engine…',
  analyzing: 'Analyzing…',
  ready: 'Up to date',
  error: 'Engine error',
};

export function SettingsBar({ settings, status, onChange }: SettingsBarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pasteNote, setPasteNote] = useState<PasteNote | null>(null);
  const seedInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!pasteNote) return;
    const timer = setTimeout(() => setPasteNote(null), PASTE_NOTE_MS);
    return () => clearTimeout(timer);
  }, [pasteNote]);

  const pasteSeed = async () => {
    const text = await readClipboardText();
    const seed = text === null ? null : seedFromText(text);
    if (seed) {
      setPasteNote(null);
      onChange({ seed });
      return;
    }
    if (text === null) {
      setPasteNote({ text: 'Clipboard blocked: press Ctrl/⌘+V', id: Date.now() });
      seedInput.current?.select();
    } else {
      setPasteNote({ text: 'No seed in clipboard', id: Date.now() });
    }
  };

  return (
    <div class={`settings ${drawerOpen ? 'settings-open' : ''}`}>
      <div class="settings-main">
        <label class="field field-seed">
          <span class="field-label">Seed</span>
          <span class="seed-input">
            <input
              ref={seedInput}
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
              onPaste={(e) => {
                const text = e.clipboardData?.getData('text') ?? '';
                if (isPlainSeedFragment(text)) return; // native paste + onInput normalisation
                const seed = seedFromText(text);
                if (!seed) return;
                e.preventDefault();
                onChange({ seed });
              }}
            />
            <button type="button" class="btn-icon" title="Random seed" aria-label="Random seed" onClick={() => onChange({ seed: randomSeed() })}>
              🎲
            </button>
            <button type="button" class="btn-icon" title="Paste seed from clipboard" aria-label="Paste seed from clipboard" onClick={pasteSeed}>
              📋
            </button>
          </span>
        </label>
        <span class={`status status-${pasteNote ? 'error' : status}`} role="status">
          {pasteNote?.text ?? STATUS_TEXT[status]}
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

/** Clipboard text, or null when the browser refuses (no permission, insecure context, unsupported). */
async function readClipboardText(): Promise<string | null> {
  try {
    return (await navigator.clipboard?.readText()) ?? null;
  } catch {
    return null;
  }
}

/** Partial seed (shorter than a full one, seed characters only): let the browser paste it at the caret. */
function isPlainSeedFragment(text: string): boolean {
  return text.length < SEED_MAX_LENGTH && /^[A-Za-z0-9]*$/.test(text);
}
