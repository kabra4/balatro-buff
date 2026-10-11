import { CHIPS, type Filter } from './filter';

export interface FilterBarProps {
  filter: Filter;
  onChange: (filter: Filter) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function FilterBar({ filter, onChange, onExpandAll, onCollapseAll }: FilterBarProps) {
  return (
    <div class="filter-bar">
      <div class="chips" role="group" aria-label="Filters">
        {CHIPS.map((chip) => {
          const on = filter.chips.includes(chip.id);
          return (
            <button
              key={chip.id}
              type="button"
              class={`chip ${on ? 'chip-on' : ''}`}
              aria-pressed={on}
              onClick={() => onChange({ ...filter, chips: toggle(filter.chips, chip.id) })}
            >
              {chip.label}
            </button>
          );
        })}
      </div>
      <div class="filter-actions">
        <button type="button" class="btn-small" onClick={onExpandAll}>
          Expand all
        </button>
        <button type="button" class="btn-small" onClick={onCollapseAll}>
          Collapse all
        </button>
      </div>
    </div>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}
