import { useState } from 'preact/hooks';

type CopyState = 'idle' | 'ok' | 'fail';

/** Copies the current page URL (which carries the shareable state). */
export function CopyLinkButton() {
  const [copied, setCopied] = useState<CopyState>('idle');
  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(
      () => flash(setCopied, 'ok'),
      () => flash(setCopied, 'fail'),
    );
  };
  return (
    <button type="button" class="btn-small" onClick={copyLink}>
      {copied === 'ok' ? 'Copied!' : copied === 'fail' ? 'Copy failed' : 'Copy link'}
    </button>
  );
}

function flash(set: (v: CopyState) => void, value: 'ok' | 'fail'): void {
  set(value);
  window.setTimeout(() => set('idle'), 1500);
}
