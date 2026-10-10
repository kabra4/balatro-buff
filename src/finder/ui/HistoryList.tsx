import type { VerifiedHit } from '../searchController';

export interface HistoryListProps {
  hits: VerifiedHit[];
  current: VerifiedHit | null;
  onSelect: (hit: VerifiedHit) => void;
}

/** Seeds found this session (newest first). */
export function HistoryList({ hits, current, onSelect }: HistoryListProps) {
  if (hits.length === 0) return null;
  return (
    <section class="history" aria-label="Found seeds">
      <h2 class="history-title">Found this session · {hits.length}</h2>
      <ol class="history-list">
        {hits.map((hit) => (
          <li key={hit.id}>
            <button type="button" class={`history-item ${hit === current ? 'history-current' : ''}`} onClick={() => onSelect(hit)}>
              <span class="history-seed">{hit.seed}</span>
              <span class="history-meta">
                {hit.query.settings.deck} · {hit.query.slots.length} requirement{hit.query.slots.length === 1 ? '' : 's'}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
