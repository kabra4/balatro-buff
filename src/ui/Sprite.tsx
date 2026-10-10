import type { Edition } from '../engine/types';
import { editionLayer, spriteStyle, type Layer } from './sprites';

const BASE_URL = import.meta.env.BASE_URL;

export interface SpriteProps {
  layers: Layer[];
  scale?: number;
  edition?: Edition;
  label: string;
  className?: string;
}

/** Layered CSS sprite. Falls back to a labelled placeholder when the name has no sprite. */
export function Sprite({ layers, scale = 1, edition = null, label, className = '' }: SpriteProps) {
  const overlay = editionLayer(edition);
  if (layers.length === 0) {
    return (
      <div class={`sprite sprite-missing ${className}`} style={{ width: `${71 * scale}px`, height: `${95 * scale}px` }}>
        {label}
      </div>
    );
  }
  return (
    <div
      class={`sprite ${edition === 'Negative' ? 'sprite-negative' : ''} ${className}`}
      style={spriteStyle(layers, BASE_URL, scale)}
      role="img"
      aria-label={label}
      title={label}
    >
      {overlay.length > 0 && <div class="sprite-edition" style={spriteStyle(overlay, BASE_URL, scale)} />}
    </div>
  );
}
