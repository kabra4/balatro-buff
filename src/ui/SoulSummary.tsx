import type { SoulLocation } from '../engine/types';
import { ALL_OWNED_NOTE } from './soulText';
import { Sprite } from './Sprite';
import { jokerLayers } from './sprites';

export interface SoulSummaryProps {
  souls: SoulLocation[];
  maxAnte: number;
  onJump: (ante: number) => void;
}

export function SoulSummary({ souls, maxAnte, onJump }: SoulSummaryProps) {
  return (
    <section class="souls" aria-label="The Soul summary">
      <h2 class="souls-title">The Soul ★ {souls.length}</h2>
      {souls.length === 0 ? (
        <p class="empty">No Soul cards in antes 1–{maxAnte}.</p>
      ) : (
        <ol class="souls-list">
          {souls.map((s) => (
            <li key={s.index}>
              <button type="button" class="soul-chip" onClick={() => onJump(s.ante)}>
                <Sprite layers={jokerLayers(s.legendary)} edition={s.edition} scale={0.5} label={s.legendary} />
                <span>
                  <span class="soul-chip-head">
                    #{s.index} · Ante {s.ante} · {s.where}
                  </span>
                  <span class="soul-chip-legendary">
                    → {s.legendary}
                    {s.edition && <span class="soul-chip-edition"> ({s.edition})</span>}
                  </span>
                  {s.allOwned && <span class="soul-chip-head">{ALL_OWNED_NOTE}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
