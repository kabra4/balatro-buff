import { isSoulCard } from '../engine/souls';
import type { AnteResult, Item } from '../engine/types';
import { isFilterActive, matches, matchesLabel, type Filter, type LabelKind } from './filter';
import { ItemCard } from './ItemCard';
import { Sprite } from './Sprite';
import { bossLayers, tagLayers, voucherLayers, type Layer } from './sprites';

export interface AnteSectionProps {
  ante: AnteResult;
  filter: Filter;
  open: boolean;
  onToggle: (open: boolean) => void;
}

export function AnteSection({ ante, filter, open, onToggle }: AnteSectionProps) {
  const active = isFilterActive(filter);
  const souls = countItems(ante, isSoulCard);
  const negatives = countItems(ante, (i) => (i.kind === 'joker' || i.kind === 'playing') && i.edition === 'Negative');
  return (
    <details
      id={`ante-${ante.ante}`}
      class="ante"
      open={open}
      onToggle={(e) => onToggle((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary class="ante-summary">
        <span class="ante-title">Ante {ante.ante}</span>
        <Label kind="boss" name={ante.boss} layers={bossLayers(ante.boss)} filter={filter} active={active} />
        <Label kind="voucher" name={ante.voucher} layers={voucherLayers(ante.voucher)} filter={filter} active={active} />
        {ante.tags.map((tag, i) => (
          <Label key={i} kind="tag" name={tag} layers={tagLayers(tag)} filter={filter} active={active} />
        ))}
        <span class="ante-badges">
          {souls > 0 && <span class="badge badge-soul" title="The Soul cards">★ {souls}</span>}
          {negatives > 0 && <span class="badge badge-negative" title="Negative cards">◆ {negatives}</span>}
        </span>
      </summary>
      {open && <AnteBody ante={ante} filter={filter} active={active} />}
    </details>
  );
}

/** Items + header labels in this ante that pass the filter. */
export function countMatches(ante: AnteResult, filter: Filter): number {
  const labels: [LabelKind, string][] = [['boss', ante.boss], ['voucher', ante.voucher], ...ante.tags.map((t): [LabelKind, string] => ['tag', t])];
  return labels.filter(([kind, name]) => matchesLabel(kind, name, filter)).length + countItems(ante, (i) => matches(i, filter));
}

function AnteBody({ ante, filter, active }: { ante: AnteResult; filter: Filter; active: boolean }) {
  const shop = ante.shop.map((item, i) => ({ item, n: i + 1 })).filter(({ item }) => !active || matches(item, filter));
  const packs = ante.packs
    .map((pack, i) => ({ pack, n: i + 1, items: pack.items.filter((item) => !active || matches(item, filter)) }))
    .filter(({ items }) => !active || items.length > 0);
  return (
    <div class="ante-body">
      <h3 class="row-title">Shop</h3>
      <div class="card-row">
        {shop.length === 0 ? <p class="empty">No matching shop cards</p> : shop.map(({ item, n }) => <ItemCard key={n} item={item} number={n} />)}
      </div>
      <h3 class="row-title">Packs</h3>
      <div class="packs">
        {packs.length === 0 && <p class="empty">No matching packs</p>}
        {packs.map(({ pack, n, items }) => (
          <section key={n} class="pack">
            <header class="pack-name">
              <span>{pack.name}</span>
              <span class="pack-meta">choose {pack.choices} of {pack.size}</span>
            </header>
            <div class="card-row">
              {items.map((item, i) => (
                <ItemCard key={i} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

interface LabelProps {
  kind: LabelKind;
  name: string;
  layers: Layer[];
  filter: Filter;
  active: boolean;
}

function Label({ kind, name, layers, filter, active }: LabelProps) {
  const hit = active && matchesLabel(kind, name, filter);
  return (
    <span class={`ante-label label-${kind} ${hit ? 'hit' : ''}`}>
      <Sprite layers={layers} scale={kind === 'voucher' ? 0.36 : 0.75} label={name} />
      <span class="ante-label-text">{name}</span>
    </span>
  );
}

function countItems(ante: AnteResult, test: (item: Item) => boolean): number {
  let n = ante.shop.filter(test).length;
  for (const pack of ante.packs) n += pack.items.filter(test).length;
  return n;
}
