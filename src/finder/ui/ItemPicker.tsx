/** Searchable item select with sprite thumbnails (options come from the slot-kind registry). */
import { useEffect, useRef, useState } from 'preact/hooks';
import { Sprite } from '../../ui/Sprite';
import { SHEETS } from '../../ui/sprites';
import { anyLabel, SLOT_KINDS } from '../slotKinds';
import type { SlotKind } from '../types';

const THUMB_HEIGHT = 34;

export interface ItemPickerProps {
  kind: SlotKind;
  value: string | null;
  onChange: (item: string | null) => void;
}

export function ItemPicker({ kind, value, onChange }: ItemPickerProps) {
  const spec = SLOT_KINDS[kind];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const q = query.trim().toLowerCase();
  const options: (string | null)[] = [
    ...(spec.allowsAny && anyLabel(kind).toLowerCase().includes(q) ? [null] : []),
    ...spec.itemOptions.filter((o) => o.toLowerCase().includes(q)),
  ];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const choose = (item: string | null) => {
    onChange(item);
    setOpen(false);
    setQuery('');
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActive((a) => Math.min(options.length - 1, Math.max(0, a + step)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = options[active];
      if (item !== undefined) choose(item);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div class="picker" ref={root}>
      <button
        type="button"
        class={`picker-button ${value === null && !spec.allowsAny ? 'picker-empty' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          setOpen(!open);
          setActive(0);
        }}
      >
        <Thumb kind={kind} item={value} />
        <span class="picker-label">{value ?? (spec.allowsAny ? anyLabel(kind) : `Choose ${spec.label.toLowerCase()}…`)}</span>
        <span class="picker-caret">▾</span>
      </button>
      {open && (
        <div class="picker-pop">
          <input
            type="search"
            placeholder={`Search ${spec.label.toLowerCase()}…`}
            aria-label={`Search ${spec.label.toLowerCase()}`}
            value={query}
            autoFocus
            onInput={(e) => {
              setQuery((e.currentTarget as HTMLInputElement).value);
              setActive(0);
            }}
            onKeyDown={onKey}
          />
          <ul class="picker-list" role="listbox">
            {options.map((item, i) => (
              <li
                key={item ?? '*'}
                role="option"
                aria-selected={item === value}
                class={`picker-option ${i === active ? 'picker-active' : ''}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
              >
                <Thumb kind={kind} item={item} />
                <span>{item ?? anyLabel(kind)}</span>
              </li>
            ))}
            {options.length === 0 && <li class="empty">Nothing matches “{query}”.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function Thumb({ kind, item }: { kind: SlotKind; item: string | null }) {
  if (item === null) return <span class="thumb-any">?</span>;
  const layers = SLOT_KINDS[kind].itemLayers(item);
  const first = layers[0];
  const scale = first ? THUMB_HEIGHT / SHEETS[first.sheet].cellH : 1;
  return <Sprite layers={layers} scale={scale} label={item} className="thumb" />;
}
