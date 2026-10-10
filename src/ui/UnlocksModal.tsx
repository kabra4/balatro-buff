import { useEffect, useState } from 'preact/hooks';
import { UNLOCK_OPTIONS } from '../engine/constants';
import { orderedUnlocks } from '../state/url';

export interface UnlocksModalProps {
  locked: string[];
  onChange: (locked: string[]) => void;
  onClose: () => void;
}

export function UnlocksModal({ locked, onChange, onClose }: UnlocksModalProps) {
  const [query, setQuery] = useState('');
  const lockedSet = new Set(locked);
  const q = query.trim().toLowerCase();
  const shown = UNLOCK_OPTIONS.filter((o) => o.toLowerCase().includes(q));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const setUnlocked = (name: string, unlocked: boolean) => {
    const next = new Set(lockedSet);
    if (unlocked) next.delete(name);
    else next.add(name);
    onChange(orderedUnlocks(next));
  };

  return (
    <div class="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="unlocks-title">
        <header class="modal-head">
          <h2 id="unlocks-title">Unlocked items</h2>
          <span class="modal-sub">
            {UNLOCK_OPTIONS.length - locked.length} / {UNLOCK_OPTIONS.length} unlocked
          </span>
          <button type="button" class="btn-icon" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </header>
        <div class="modal-tools">
          <input
            type="search"
            placeholder="Search unlocks…"
            aria-label="Search unlocks"
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            autoFocus
          />
          <button type="button" class="btn-small" onClick={() => onChange([...UNLOCK_OPTIONS])}>
            Lock all
          </button>
          <button type="button" class="btn-small" onClick={() => onChange([])}>
            Unlock all
          </button>
        </div>
        <div class="unlock-grid">
          {shown.map((name) => (
            <label key={name} class="unlock-item">
              <input
                type="checkbox"
                checked={!lockedSet.has(name)}
                onChange={(e) => setUnlocked(name, (e.currentTarget as HTMLInputElement).checked)}
              />
              {name}
            </label>
          ))}
          {shown.length === 0 && <p class="empty">Nothing matches “{query}”.</p>}
        </div>
        <footer class="modal-foot">
          <button type="button" class="btn" onClick={onClose}>
            Done
          </button>
        </footer>
      </div>
    </div>
  );
}
