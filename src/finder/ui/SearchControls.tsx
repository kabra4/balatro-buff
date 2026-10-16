import type { SearchSnapshot } from '../searchController';

export interface SearchControlsProps {
  snapshot: SearchSnapshot;
  /** Validation problems; searching is disabled while there are any. */
  problems: string[];
  onSearch: () => void;
  onFindNext: () => void;
  onStop: () => void;
}

const STATUS_TEXT: Record<SearchSnapshot['status'], string> = {
  idle: 'Ready',
  running: 'Searching…',
  verifying: 'Verifying hit…',
  paused: 'Match found',
  error: 'Error',
};

export function SearchControls({ snapshot: s, problems, onSearch, onFindNext, onStop }: SearchControlsProps) {
  const active = s.status === 'running' || s.status === 'verifying' || s.status === 'paused';
  return (
    <section class="search-controls" aria-label="Search">
      <div class="search-buttons">
        <button type="button" class="btn" disabled={problems.length > 0 || s.status === 'running' || s.status === 'verifying'} onClick={onSearch}>
          ▶ Search
        </button>
        <button type="button" class="btn btn-alt" disabled={s.status !== 'paused'} onClick={onFindNext}>
          Find next
        </button>
        <button type="button" class="btn btn-stop" disabled={!active} onClick={onStop}>
          ■ Stop
        </button>
        <span class={`status status-search-${s.status}`} role="status">
          {STATUS_TEXT[s.status]}
        </span>
      </div>
      <p class="search-stats" data-testid="search-stats">
        Checked {formatCount(s.checked)} · {formatCount(Math.round(s.seedsPerSecond))} seeds/s · {formatDuration(s.elapsedMs)} · found {s.found}
        {s.workers > 0 && ` · ${s.workers} worker${s.workers === 1 ? '' : 's'}`}
        {s.rejected > 0 && ` · ${s.rejected} unreachable (skipping those blinds loses a shop)`}
      </p>
      {s.error && <p class="error">{s.error}</p>}
      {problems.length > 0 && (
        <ul class="search-problems">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatCount(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e4) return `${(n / 1e3).toFixed(1)}k`;
  return n.toLocaleString('en-US');
}

function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
