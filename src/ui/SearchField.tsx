import { useRef } from 'preact/hooks';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Header search box with a ✕ clear button; Escape also clears. */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const input = useRef<HTMLInputElement>(null);
  const clear = () => {
    onChange('');
    input.current?.focus();
  };

  return (
    <div class="search-field">
      <input
        ref={input}
        type="search"
        class="search-input"
        placeholder="Search cards, vouchers, tags, bosses…"
        aria-label="Search"
        value={value}
        onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            clear();
          }
        }}
      />
      {value && (
        <button type="button" class="search-clear" title="Clear search" aria-label="Clear search" onClick={clear}>
          ✕
        </button>
      )}
    </div>
  );
}
