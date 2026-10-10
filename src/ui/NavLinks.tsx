export type Page = 'analyzer' | 'finder';

const PAGES: readonly { page: Page; href: string; label: string }[] = [
  { page: 'analyzer', href: './', label: 'Analyzer' },
  { page: 'finder', href: './finder.html', label: 'Finder' },
];

/** Header links between the two pages (relative, so they work under any base path). */
export function NavLinks({ current }: { current: Page }) {
  return (
    <nav class="nav" aria-label="Pages">
      {PAGES.map(({ page, href, label }) => (
        <a key={page} href={href} class={`nav-link ${page === current ? 'nav-current' : ''}`} aria-current={page === current ? 'page' : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
